/**
 * @clawkernel/sdk — Type Definitions
 *
 * Snapshot of types from clawkernel/schema/0.2.0/schema.ts
 * plus SDK-specific types (AgentOptions, handlers, etc.)
 */

// ── Lifecycle ──────────────────────────────────────────────────────────────

export type LifecycleState = "INIT" | "STARTING" | "READY" | "STOPPING" | "STOPPED" | "ERROR";
export type ConformanceLevel = "level-1" | "level-2" | "level-3";

// ── Content Block ──────────────────────────────────────────────────────────

export interface ContentBlock {
  type: "text" | "image" | "resource";
  text?: string;
  [key: string]: unknown;
}

// ── Error Codes ────────────────────────────────────────────────────────────

export const CKP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  PROTOCOL_VERSION_NOT_SUPPORTED: -32001,
  SANDBOX_DENIED: -32010,
  POLICY_DENIED: -32011,
  APPROVAL_TIMEOUT: -32012,
  APPROVAL_DENIED: -32013,
  TOOL_EXECUTION_TIMEOUT: -32014,
  PROVIDER_QUOTA_EXCEEDED: -32021,
} as const;

// ── L2: Tool Types ─────────────────────────────────────────────────────────

export interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;
}

export interface ToolDefinition {
  /** Execute the tool with the given arguments. */
  execute: (args: Record<string, unknown>) => Promise<ToolCallResult>;
  /** Timeout in milliseconds for tool execution. */
  timeout_ms?: number;
}

export interface GateResult {
  allowed: boolean;
  code?: number;
  message?: string;
}

export interface PolicyEvaluator {
  evaluate: (toolName: string, context: Record<string, unknown>) => GateResult;
}

export interface SandboxChecker {
  check: (toolName: string, args: Record<string, unknown>) => GateResult;
}

export interface QuotaChecker {
  check: (toolName: string) => GateResult;
}

export interface ApprovalConfig {
  required: (toolName: string) => boolean;
  timeout_ms: number;
}

// ── L3: Memory Types ───────────────────────────────────────────────────────

export interface MemoryEntry {
  content: string | Record<string, unknown>;
  key?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  type: "semantic" | "key" | "time-range";
  text?: string;
  key?: string;
  time_range?: { from: string; to: string };
  top_k?: number;
}

export interface MemoryQueryEntry {
  id: string;
  content: string | Record<string, unknown>;
  score?: number;
  timestamp?: string;
}

export interface MemoryHandler {
  store: (storeName: string, entries: MemoryEntry[]) => Promise<{ stored: number; ids: string[] }>;
  query: (storeName: string, query: MemoryQuery) => Promise<{ entries: MemoryQueryEntry[] }>;
  compact: (storeName: string) => Promise<{ entries_before: number; entries_after: number }>;
}

// ── L3: Swarm Types ────────────────────────────────────────────────────────

export interface SwarmTask {
  description: string;
  input?: Record<string, unknown>;
}

export interface SwarmContext {
  request_id: string;
  swarm: string;
}

export interface SwarmPeer {
  identity: string;
  uri: string;
  status: "ready" | "busy" | "unavailable";
}

export interface SwarmHandler {
  delegate: (taskId: string, task: SwarmTask, context: SwarmContext) => Promise<{ acknowledged: boolean }>;
  discover: (swarmName?: string) => Promise<{ peers: SwarmPeer[] }>;
  report: (taskId: string, status: string, result: Record<string, unknown>) => Promise<{ acknowledged: boolean }>;
  broadcast: (swarmName: string, message: Record<string, unknown>) => void;
}

// ── Agent Options ──────────────────────────────────────────────────────────

export interface AgentOptions {
  name: string;
  version: string;
  /** Heartbeat interval in milliseconds. Default: 30000. Set to 0 to disable. */
  heartbeatInterval?: number;
  // L2
  tools?: Record<string, ToolDefinition>;
  policy?: PolicyEvaluator;
  sandbox?: SandboxChecker;
  approval?: ApprovalConfig;
  quota?: QuotaChecker;
  // L3
  memory?: MemoryHandler;
  swarm?: SwarmHandler;
}
