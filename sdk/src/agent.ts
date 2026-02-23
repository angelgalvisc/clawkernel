/**
 * @clawkernel/sdk — Agent Class
 *
 * Stateful agent with JSON-RPC 2.0 routing, lifecycle state machine,
 * and extension points for L2 (tools) and L3 (memory, swarm).
 */

import { createStdioTransport, type Transport } from "./transport.js";
import { sendOk, sendError, parseError, invalidRequest, methodNotFound, invalidParams, versionMismatch } from "./errors.js";
import { type AgentOptions, type LifecycleState, type ConformanceLevel, type TelemetryHandler, CKP_ERROR_CODES } from "./types.js";
import { ToolExecutor } from "./tools.js";
import { MemoryExecutor } from "./memory.js";
import { SwarmExecutor } from "./swarm.js";

const PROTOCOL_VERSION = "0.2.0";
const MIN_HEARTBEAT_MS = 1000;

/** Methods that require READY state (post-initialize). */
const READY_ONLY_METHODS = new Set([
  "claw.tool.call",
  "claw.tool.approve",
  "claw.tool.deny",
  "claw.memory.store",
  "claw.memory.query",
  "claw.memory.compact",
  "claw.swarm.delegate",
  "claw.swarm.discover",
  "claw.swarm.report",
  "claw.swarm.broadcast",
  "claw.status",
  "claw.shutdown",
]);

export type MethodHandler = (id: string | number | null, params: Record<string, unknown>) => void | Promise<void>;

export class Agent {
  private state: LifecycleState = "INIT";
  private transport: Transport;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private initTime: number | null = null;
  private options: AgentOptions;
  private methodHandlers: Map<string, MethodHandler> = new Map();
  private toolExecutor: ToolExecutor | null = null;
  private memoryExecutor: MemoryExecutor | null = null;
  private swarmExecutor: SwarmExecutor | null = null;
  private telemetry: TelemetryHandler | null = null;

  constructor(options: AgentOptions) {
    this.options = options;
    this.transport = createStdioTransport();

    // Register L1 handlers
    this.methodHandlers.set("claw.initialize", (id, params) => this.handleInitialize(id, params));
    this.methodHandlers.set("claw.initialized", (_id, _params) => this.handleInitialized());
    this.methodHandlers.set("claw.status", (id) => this.handleStatus(id));
    this.methodHandlers.set("claw.shutdown", (id) => this.handleShutdown(id));

    // Register L2 handlers if tools configured
    if (options.tools || options.policy || options.sandbox || options.quota) {
      this.toolExecutor = new ToolExecutor(this.transport, options);
      this.methodHandlers.set("claw.tool.call", (id, params) => this.toolExecutor!.handleToolCall(id, params));
      this.methodHandlers.set("claw.tool.approve", (id, params) => this.toolExecutor!.handleApprove(id, params));
      this.methodHandlers.set("claw.tool.deny", (id, params) => this.toolExecutor!.handleDeny(id, params));
    }

    // Register L3 handlers if memory configured
    if (options.memory) {
      this.memoryExecutor = new MemoryExecutor(this.transport, options.memory);
      this.methodHandlers.set("claw.memory.store", (id, params) => this.memoryExecutor!.handleStore(id, params));
      this.methodHandlers.set("claw.memory.query", (id, params) => this.memoryExecutor!.handleQuery(id, params));
      this.methodHandlers.set("claw.memory.compact", (id, params) => this.memoryExecutor!.handleCompact(id, params));
    }

    // Register L3 handlers if swarm configured
    if (options.swarm) {
      this.swarmExecutor = new SwarmExecutor(this.transport, options.swarm);
      this.methodHandlers.set("claw.swarm.delegate", (id, params) => this.swarmExecutor!.handleDelegate(id, params));
      this.methodHandlers.set("claw.swarm.discover", (id, params) => this.swarmExecutor!.handleDiscover(id, params));
      this.methodHandlers.set("claw.swarm.report", (id, params) => this.swarmExecutor!.handleReport(id, params));
      this.methodHandlers.set("claw.swarm.broadcast", (_id, params) => this.swarmExecutor!.handleBroadcast(params));
    }

    // Telemetry — optional at all levels, emit-only (no JSON-RPC methods)
    if (options.telemetry) {
      this.telemetry = options.telemetry;
    }
  }

  // ── Telemetry ─────────────────────────────────────────────────────────

  /** Fire-and-forget telemetry emit. Never throws, never blocks. */
  private emitTelemetry(event_type: "tool_call" | "memory_op" | "swarm_op" | "lifecycle" | "error", details: Record<string, unknown>): void {
    if (!this.telemetry) return;
    try {
      this.telemetry.emit({
        timestamp: new Date().toISOString(),
        event_type,
        details,
      });
    } catch {
      // Telemetry MUST NOT affect core agent functionality — swallow errors silently
    }
  }

  // ── Public ─────────────────────────────────────────────────────────────

  listen(): void {
    this.transport.onMessage((raw) => this.handleMessage(raw));
  }

  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.transport.close();
  }

  // ── Message Router ─────────────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parseError(this.transport);
      return;
    }

    // Validate JSON-RPC 2.0 envelope
    if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      invalidRequest(this.transport, (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null);
      return;
    }

    const method = msg.method;
    const id = (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null;

    // Validate params type (must be object or undefined, not array/primitive)
    if (msg.params !== undefined && (typeof msg.params !== "object" || msg.params === null || Array.isArray(msg.params))) {
      invalidParams(this.transport, id, "params must be an object");
      return;
    }
    const params = (msg.params as Record<string, unknown>) ?? {};

    // Strict lifecycle enforcement: claw.initialize MUST be first.
    if (this.state === "INIT" && method !== "claw.initialize") {
      if (id !== null) {
        invalidRequest(this.transport, id);
        this.emitTelemetry("error", {
          code: CKP_ERROR_CODES.INVALID_REQUEST,
          method,
          reason: "claw.initialize required first",
        });
      }
      return;
    }

    const handler = this.methodHandlers.get(method);
    if (!handler) {
      // Only send error for requests (with id), not notifications
      if (id !== null) {
        methodNotFound(this.transport, id, method);
        this.emitTelemetry("error", { code: CKP_ERROR_CODES.METHOD_NOT_FOUND, method });
      }
      return;
    }

    // Execute handler (may be async)
    const result = handler(id, params);
    if (result instanceof Promise) {
      result.catch((err: unknown) => {
        if (id !== null) {
          sendError(this.transport, id, -32603, `Internal error: ${err instanceof Error ? err.message : String(err)}`);
          this.emitTelemetry("error", { code: -32603, method, error: err instanceof Error ? err.message : String(err) });
        }
      });
    }
  }

  // ── L1 Handlers ────────────────────────────────────────────────────────

  private handleInitialize(id: string | number | null, params: Record<string, unknown>): void {
    // Validate required params with type guard
    const clientVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
    if (!clientVersion) {
      invalidParams(this.transport, id, "Missing required param: protocolVersion");
      return;
    }

    // Version negotiation: major must match
    const clientMajor = clientVersion.split(".")[0];
    const serverMajor = PROTOCOL_VERSION.split(".")[0];
    if (clientMajor !== serverMajor) {
      versionMismatch(this.transport, id);
      return;
    }

    this.state = "STARTING";
    this.initTime = Date.now();
    this.emitTelemetry("lifecycle", { transition: "INIT → STARTING" });

    // Determine conformance level based on configured handlers
    let conformanceLevel: ConformanceLevel = "level-1";
    if (this.toolExecutor) conformanceLevel = "level-2";
    if (this.memoryExecutor && this.swarmExecutor) conformanceLevel = "level-3";

    this.state = "READY";
    this.emitTelemetry("lifecycle", { transition: "STARTING → READY", conformanceLevel });

    // Start heartbeat (with minimum bound to prevent CPU saturation)
    const rawInterval = this.options.heartbeatInterval ?? 30000;
    const interval = rawInterval > 0 ? Math.max(rawInterval, MIN_HEARTBEAT_MS) : 0;
    if (interval > 0) {
      this.heartbeatTimer = setInterval(() => {
        this.transport.send({
          jsonrpc: "2.0",
          method: "claw.heartbeat",
          params: {
            state: this.state,
            uptime_ms: this.initTime ? Date.now() - this.initTime : 0,
            timestamp: new Date().toISOString(),
          },
        });
      }, interval);
    }

    sendOk(this.transport, id, {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: { name: this.options.name, version: this.options.version },
      conformanceLevel,
      capabilities: {},
    });
  }

  private handleInitialized(): void {
    // Notification — no response. Agent acknowledges client is ready.
  }

  private handleStatus(id: string | number | null): void {
    sendOk(this.transport, id, {
      state: this.state,
      uptime_ms: this.initTime ? Date.now() - this.initTime : 0,
    });
  }

  private handleShutdown(id: string | number | null): void {
    this.state = "STOPPING";
    this.emitTelemetry("lifecycle", { transition: "READY → STOPPING" });

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.state = "STOPPED";
    this.emitTelemetry("lifecycle", { transition: "STOPPING → STOPPED", uptime_ms: this.initTime ? Date.now() - this.initTime : 0 });

    sendOk(this.transport, id, { drained: true });
    // Do NOT exit process — per CKP spec, shutdown is graceful
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createAgent(options: AgentOptions): Agent {
  return new Agent(options);
}
