/**
 * @clawkernel/sdk — CKP Agent SDK
 *
 * Build CKP-conformant agents with minimal code.
 * Zero runtime dependencies. L1/L2/L3 conformance support.
 */

// ── Core ──────────────────────────────────────────────────────────────────
export { createAgent, Agent } from "./agent.js";
export type { Transport } from "./transport.js";

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  AgentOptions,
  LifecycleState,
  ConformanceLevel,
  ContentBlock,
  ToolDefinition,
  ToolCallResult,
  GateResult,
  PolicyEvaluator,
  SandboxChecker,
  QuotaChecker,
  ApprovalConfig,
  MemoryHandler,
  MemoryEntry,
  MemoryQuery,
  MemoryQueryEntry,
  SwarmHandler,
  SwarmTask,
  SwarmContext,
  SwarmPeer,
  TelemetryHandler,
  TelemetryEvent,
  TelemetryEventType,
} from "./types.js";
export { CKP_ERROR_CODES } from "./types.js";

// ── Error Helpers (for custom handlers & advanced usage) ──────────────────
export {
  sendOk,
  sendError,
  parseError,
  invalidRequest,
  methodNotFound,
  invalidParams,
  versionMismatch,
  sandboxDenied,
  policyDenied,
  approvalTimeout,
  approvalDenied,
  toolTimeout,
  quotaExceeded,
  ToolTimeoutError,
} from "./errors.js";
