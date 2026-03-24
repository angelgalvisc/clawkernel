/**
 * @clawkernel/sdk — Type Definitions
 *
 * Snapshot of types from clawkernel/schema/0.3.0/schema.ts
 * plus SDK-specific types (AgentOptions, handlers, etc.)
 */

import type { Transport } from "./transport.js";

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

export type MemoryRole = "sensory" | "working" | "episodic" | "semantic" | "procedural";
export type MemoryAcquisitionMode = "event-driven" | "continuous" | "manual";
export type MemoryConsolidationMode = "none" | "summarize" | "merge" | "adaptive";
export type MemoryRetrievalMode = "exact" | "semantic" | "contextual" | "hybrid";
export type MemoryForgettingStrategy = "none" | "decay" | "summarize" | "adaptive";
export type ConfidenceDecayMode = "optional" | "none" | "adaptive";

export interface MemoryLifecyclePolicy {
  acquisition?: MemoryAcquisitionMode;
  consolidation?: MemoryConsolidationMode;
  retrieval?: MemoryRetrievalMode;
}

export interface MemoryForgettingPolicy {
  strategy?: MemoryForgettingStrategy;
  signals?: string[];
}

export interface MemorySaliencePolicy {
  enabled?: boolean;
  signals?: string[];
}

export interface MemoryConfidencePolicy {
  source_tracking?: boolean;
  decay?: ConfidenceDecayMode;
}

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

// ── Optional WorldModel Types ──────────────────────────────────────────────

export type WorldModelParadigm = "implicit" | "explicit" | "simulator" | "hybrid";
export type WorldModelScope = "agent-wide" | "task-scoped";
export type WorldModelBackendType = "tool" | "provider" | "custom";
export type WorldModelPlanningHorizon = "adaptive" | "bounded" | "fixed";
export type WorldModelUncertaintyMode = "none" | "bounded" | "calibrated";
export type WorldModelFallback = "conservative" | "retry" | "escalate";
export type WorldModelUpdateMode = "online" | "batch" | "hybrid";
export type WorldModelEvidence = "observations" | "observations+outcomes";

export interface WorldModelBackend {
  type: WorldModelBackendType;
  ref: string;
}

export interface WorldModelPredicts {
  state?: boolean;
  observation?: boolean;
  risk?: boolean;
  cost?: boolean;
}

export interface WorldModelPlanning {
  horizon?: WorldModelPlanningHorizon;
  uncertainty_mode?: WorldModelUncertaintyMode;
  fallback?: WorldModelFallback;
}

export interface WorldModelUpdate {
  mode?: WorldModelUpdateMode;
  evidence?: WorldModelEvidence;
}

export interface WorldModelConstraints {
  policy_ref?: string;
}

export interface WorldModelSpec {
  paradigm: WorldModelParadigm;
  scope?: WorldModelScope;
  memory_ref?: string;
  backend: WorldModelBackend;
  predicts?: WorldModelPredicts;
  planning?: WorldModelPlanning;
  update?: WorldModelUpdate;
  constraints?: WorldModelConstraints;
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
  delegate: (
    taskId: string,
    task: SwarmTask,
    context: SwarmContext,
  ) => Promise<{ acknowledged: boolean }>;
  discover: (swarmName?: string) => Promise<{ peers: SwarmPeer[] }>;
  report: (
    taskId: string,
    status: string,
    result: Record<string, unknown>,
  ) => Promise<{ acknowledged: boolean }>;
  broadcast: (swarmName: string, message: Record<string, unknown>) => void;
}

// ── A2A Interop: Task Types (experimental) ────────────────────────────────

export type TaskState =
  | "submitted"
  | "working"
  | "input_required"
  | "auth_required"
  | "completed"
  | "failed"
  | "canceled"
  | "rejected";

export interface TaskMessage {
  role: string;
  content: ContentBlock[];
  metadata?: Record<string, unknown>;
}

export interface TaskArtifact {
  id?: string;
  name?: string;
  mime_type?: string;
  data?: unknown;
  uri?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRecord {
  task_id: string;
  state: TaskState;
  messages?: TaskMessage[];
  artifacts?: TaskArtifact[];
  metadata?: Record<string, unknown>;
}

export interface TaskCreateParams {
  task_id?: string;
  message?: TaskMessage;
  messages?: TaskMessage[];
  metadata?: Record<string, unknown>;
}

export interface TaskListFilter {
  state?: TaskState;
  cursor?: string;
  limit?: number;
}

export interface TaskSubscribeResult {
  task_id: string;
  subscribed: boolean;
  state?: TaskState;
}

export interface TaskHandler {
  create: (params: TaskCreateParams) => Promise<TaskRecord>;
  get: (taskId: string) => Promise<TaskRecord | null>;
  list: (filter?: TaskListFilter) => Promise<TaskRecord[]>;
  cancel: (taskId: string, reason?: string) => Promise<TaskRecord | null>;
  subscribe: (taskId: string) => Promise<TaskSubscribeResult>;
}

// ── Telemetry Types (optional at all levels) ──────────────────────────────

export type TelemetryEventType =
  | "tool_call"
  | "memory_op"
  | "world_model_op"
  | "planning_op"
  | "swarm_op"
  | "task_op"
  | "lifecycle"
  | "error";

export interface TelemetryEvent {
  /** ISO 8601 UTC timestamp. */
  timestamp: string;
  /** Event category. */
  event_type: TelemetryEventType;
  /** Trace correlation ID. */
  request_id?: string;
  /** Event-specific details (tool name, duration_ms, status, error code, etc.). */
  details: Record<string, unknown>;
}

export interface TelemetryHandler {
  /** Emit a telemetry event to configured exporters. */
  emit: (event: TelemetryEvent) => void;
}

// ── Agent Options ──────────────────────────────────────────────────────────

export interface AgentOptions {
  name: string;
  version: string;
  /** Heartbeat interval in milliseconds. Default: 30000. Set to 0 to disable. */
  heartbeatInterval?: number;
  /** Optional custom transport (advanced/testing). Defaults to stdio transport. */
  transport?: Transport;
  // L2
  tools?: Record<string, ToolDefinition>;
  policy?: PolicyEvaluator;
  sandbox?: SandboxChecker;
  approval?: ApprovalConfig;
  quota?: QuotaChecker;
  // L3
  memory?: MemoryHandler;
  swarm?: SwarmHandler;
  // A2A interop (experimental)
  tasks?: TaskHandler;
  // Optional at all levels
  telemetry?: TelemetryHandler;
}
