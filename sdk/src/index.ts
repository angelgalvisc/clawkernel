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
  TaskState,
  TaskMessage,
  TaskArtifact,
  TaskRecord,
  TaskCreateParams,
  TaskListFilter,
  TaskSubscribeResult,
  TaskHandler,
  TelemetryHandler,
  TelemetryEvent,
  TelemetryEventType,
} from "./types.js";
export { CKP_ERROR_CODES } from "./types.js";

// ── A2A Adapter (experimental) ────────────────────────────────────────────
export {
  projectAgentCard,
  projectSkillToA2A,
  mapA2ATaskStateToCkp,
  mapCkpTaskStateToA2A,
  isSupportedA2ATaskState,
  mapA2APartToCkpContent,
  mapCkpContentToA2APart,
  mapA2AMessageToCkpTaskMessage,
  mapCkpTaskMessageToA2AMessage,
} from "./a2a.js";
export type {
  CkpSkillProjection,
  CkpAgentProjectionInput,
  A2ASupportedInterface,
  A2AAgentSkill,
  A2AAgentCard,
  A2ATaskState,
  CkpTaskState,
  A2ATextPart,
  A2ADataPart,
  A2AUrlPart,
  A2ARawPart,
  A2APart,
  A2AMessage,
  CkpTaskMessage,
} from "./a2a.js";

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
