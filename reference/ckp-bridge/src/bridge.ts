#!/usr/bin/env node

/**
 * CKP L1 Reference Bridge
 *
 * Standalone JSON-RPC 2.0 agent implementing CKP v0.2.0 L1 lifecycle methods.
 * Transport: stdin/stdout (line-delimited JSON).
 * Conformance target: L1 CONFORMANT (13/13 vectors, 0 skips, 0 fails).
 *
 * Methods:
 *   claw.initialize   (Operator → Agent, Request)
 *   claw.initialized  (Operator → Agent, Notification)
 *   claw.status        (Operator → Agent, Request)
 *   claw.shutdown      (Operator → Agent, Request)
 *   claw.heartbeat     (Agent → Operator, Notification)
 */

import { createInterface } from "node:readline";

// ── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_VERSION = "0.2.0";
const SUPPORTED_MAJOR = 0;
const HEARTBEAT_INTERVAL_MS = 30_000;

const ERR_PARSE_ERROR = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_VERSION_MISMATCH = -32001;

type LifecycleState = "INIT" | "STARTING" | "READY" | "STOPPING" | "STOPPED" | "ERROR";

// ── Agent State ──────────────────────────────────────────────────────────────

let state: LifecycleState = "INIT";
let initTime: number | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function getUptimeMs(): number {
  return initTime === null ? 0 : Date.now() - initTime;
}

// ── JSON-RPC Helpers ─────────────────────────────────────────────────────────

function send(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function ok(id: string | number | null, result: unknown): void {
  send({ jsonrpc: "2.0", id, result });
}

function err(
  id: string | number | null,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): void {
  const error: Record<string, unknown> = { code, message };
  if (data) error.data = data;
  send({ jsonrpc: "2.0", id, error });
}

// ── Method Handlers ──────────────────────────────────────────────────────────

function handleInitialize(id: string | number | null, params: Record<string, unknown>): void {
  // Validate required params
  if (
    !params.protocolVersion ||
    typeof params.protocolVersion !== "string" ||
    !params.clientInfo ||
    !params.manifest ||
    !("capabilities" in params)
  ) {
    err(id, ERR_INVALID_PARAMS, "Missing required initialize params (protocolVersion, clientInfo, manifest, capabilities)");
    return;
  }

  // Version negotiation: accept same major version
  const parts = (params.protocolVersion as string).split(".");
  const major = parseInt(parts[0] ?? "", 10);
  if (isNaN(major) || major !== SUPPORTED_MAJOR) {
    err(id, ERR_VERSION_MISMATCH, "Protocol version not supported", {
      supported: [PROTOCOL_VERSION],
    });
    return;
  }

  // Transition: INIT → STARTING → READY
  state = "STARTING";
  initTime = Date.now();
  state = "READY";

  ok(id, {
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: "ckp-bridge", version: PROTOCOL_VERSION },
    conformanceLevel: "level-1",
    capabilities: { tools: {}, swarm: {}, memory: {} },
  });
}

function handleInitialized(): void {
  // Start heartbeat timer after initialization handshake completes
  if (state === "READY" && !heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (state === "READY") {
        send({
          jsonrpc: "2.0",
          method: "claw.heartbeat",
          params: {
            state,
            uptime_ms: getUptimeMs(),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
    // Don't keep process alive just for heartbeat
    heartbeatTimer.unref();
  }
}

function handleStatus(id: string | number | null): void {
  ok(id, { state, uptime_ms: getUptimeMs() });
}

function handleShutdown(id: string | number | null): void {
  // Stop heartbeat
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  state = "STOPPING";

  // No in-flight operations in reference bridge → always drained
  ok(id, { drained: true });

  state = "STOPPED";
  // NOTE: Do NOT call process.exit() here.
  // The test runner may send more vectors after shutdown.
  // Process exits when stdin closes (readline 'close' event).
}

// ── Request Router ───────────────────────────────────────────────────────────

function handleLine(raw: string): void {
  // 1. Parse JSON
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    err(null, ERR_PARSE_ERROR, "Parse error");
    return;
  }

  // 2. Validate JSON-RPC 2.0 envelope
  if (typeof msg !== "object" || msg === null || msg.jsonrpc !== "2.0") {
    err(null, ERR_INVALID_REQUEST, "Invalid request: missing or wrong jsonrpc field");
    return;
  }

  if (typeof msg.method !== "string") {
    const id = ("id" in msg ? msg.id : null) as string | number | null;
    err(id, ERR_INVALID_REQUEST, "Invalid request: missing method field");
    return;
  }

  // 3. Route by method
  const method = msg.method as string;
  const id = ("id" in msg ? msg.id : null) as string | number | null;
  const params = (msg.params ?? {}) as Record<string, unknown>;

  switch (method) {
    case "claw.initialize":
      handleInitialize(id, params);
      break;

    case "claw.initialized":
      handleInitialized();
      // Notification — no response
      break;

    case "claw.status":
      handleStatus(id);
      break;

    case "claw.shutdown":
      handleShutdown(id);
      break;

    case "claw.heartbeat":
      // Agent→Operator direction; silently accept if received as input
      break;

    default:
      err(id, ERR_METHOD_NOT_FOUND, `Method not found: ${method}`);
      break;
  }
}

// ── Main Loop ────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (trimmed) handleLine(trimmed);
});

rl.on("close", () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  process.exit(0);
});
