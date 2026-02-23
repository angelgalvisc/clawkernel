/**
 * @clawkernel/sdk — CKP Agent SDK
 *
 * Build CKP-conformant agents with minimal code.
 */

export { createAgent, Agent } from "./agent.js";
export type { Transport } from "./transport.js";
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
} from "./types.js";
export { CKP_ERROR_CODES } from "./types.js";
