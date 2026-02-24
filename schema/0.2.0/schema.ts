/**
 * Claw Kernel Protocol (CKP) v0.2.0 — TypeScript Type Definitions
 *
 * Canonical source of truth for all type definitions in this specification.
 * Where the prose specification and these types conflict, these types take precedence.
 *
 * @see https://github.com/angelgalvisc/clawkernel/blob/main/spec/clawkernel-spec.md
 * @license Apache-2.0
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Semantic version string (MAJOR.MINOR.PATCH[-prerelease]). */
export type Semver = string;

/** Kebab-case name: 1-63 chars, ALPHA / DIGIT / hyphen. Per ABNF 'name' production. */
export type KebabName = string;

/** Duration string (e.g., '30d', '24h', '90s', '5m'). */
export type DurationString = string;

/** Environment variable or secret store key. */
export type SecretRef = string;

/** All valid CKP primitive kinds + Claw manifest kind. */
export type Kind =
  | "Identity"
  | "Provider"
  | "Channel"
  | "Tool"
  | "Skill"
  | "Memory"
  | "Sandbox"
  | "Policy"
  | "Swarm"
  | "Telemetry"
  | "Claw";

/** Common metadata envelope present in every primitive and manifest. */
export interface Metadata {
  name: KebabName;
  version?: Semver;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

/** Common envelope for all primitive documents. */
export interface PrimitiveEnvelope<K extends Kind, S> {
  claw: "0.2.0";
  kind: K;
  metadata: Metadata;
  spec: S;
}

// ---------------------------------------------------------------------------
// 5.1 Identity
// ---------------------------------------------------------------------------

export type AutonomyLevel = "observer" | "supervised" | "autonomous";

export interface IdentitySpec {
  /** REQUIRED. Natural-language description of the agent's personality. */
  personality: string;
  /** Persistent context files maintained across sessions. */
  context_files?: Record<string, string>;
  /** Default locale (e.g., 'en-US'). */
  locale?: string;
  /** Declared high-level capabilities (informational). */
  capabilities?: string[];
  /** Autonomy level. Default: 'supervised'. */
  autonomy?: AutonomyLevel;
}

export type Identity = PrimitiveEnvelope<"Identity", IdentitySpec>;

// ---------------------------------------------------------------------------
// 5.2 Provider
// ---------------------------------------------------------------------------

export type ProviderProtocol = "openai-compatible" | "anthropic-native" | "custom";
export type AuthType = "bearer" | "api-key-header" | "oauth2" | "none";
export type BackoffStrategy = "exponential" | "linear" | "constant";

export interface ProviderAuth {
  type: AuthType;
  /** REQUIRED when type !== 'none'. */
  secret_ref?: SecretRef;
}

export interface ProviderHints {
  cost_priority?: number;
  speed_priority?: number;
  intelligence_priority?: number;
}

export interface ProviderFallback {
  provider_ref: string;
}

export interface ProviderLimits {
  tokens_per_day?: number;
  tokens_per_request?: number;
  requests_per_minute?: number;
  max_context_window?: number;
}

export interface RetryConfig {
  max_attempts?: number;
  backoff?: BackoffStrategy;
  initial_delay_ms?: number;
}

/** Modalities supported by a provider. */
export type ProviderCapability = "text" | "image" | "audio" | "video" | "realtime";

/** Transport protocol for provider communication. */
export type ProviderTransport = "http" | "websocket" | "webrtc" | "grpc";

export interface ProviderSpec {
  /** REQUIRED. Protocol for communicating with the LLM endpoint. */
  protocol: ProviderProtocol;
  /** REQUIRED. Base URL for the inference API. */
  endpoint: string;
  /** REQUIRED. Model identifier. */
  model: string;
  /** REQUIRED. Authentication configuration. */
  auth: ProviderAuth;
  streaming?: boolean;
  hints?: ProviderHints;
  fallback?: ProviderFallback[];
  limits?: ProviderLimits;
  retry?: RetryConfig;
  /** Modalities supported by this provider. Default: ['text']. */
  capabilities?: ProviderCapability[];
  /** Transport protocol. Default: 'http'. Use 'websocket'/'webrtc' for streaming multimedia. */
  transport?: ProviderTransport;
}

export type Provider = PrimitiveEnvelope<"Provider", ProviderSpec>;

// ---------------------------------------------------------------------------
// 5.3 Channel
// ---------------------------------------------------------------------------

export type ChannelType =
  | "telegram" | "discord" | "whatsapp" | "slack" | "email"
  | "webhook" | "cli" | "voice" | "web" | "lark" | "matrix"
  | "line" | "wechat" | "qq" | "dingtalk"
  | "cron" | "queue" | "imap" | "db-trigger"
  | "custom";

export type TransportType = "polling" | "webhook" | "websocket" | "stdio";
export type AccessControlMode = "open" | "allowlist" | "pairing" | "role-based";
export type ChannelRole = "admin" | "user" | "viewer";

export interface PairingConfig {
  code_expiry_minutes: number;
  max_pending: number;
}

export interface RoleAssignment {
  id: string;
  role: ChannelRole;
}

export interface AccessControl {
  mode: AccessControlMode;
  allowed_ids?: string[];
  pairing?: PairingConfig;
  roles?: RoleAssignment[];
}

export interface RateLimit {
  messages_per_minute?: number;
  burst?: number;
}

export interface ChannelProcessing {
  max_message_length?: number;
  rate_limit?: RateLimit;
  typing_indicator?: boolean;
  read_receipts?: boolean;
}

export interface ChannelFeatures {
  voice?: boolean;
  files?: boolean;
  reactions?: boolean;
  threads?: boolean;
  inline_images?: boolean;
}

/** Trigger configuration for event-driven channel types (cron, queue, imap, db-trigger). */
export interface ChannelTrigger {
  /** Cron expression. REQUIRED for type 'cron'. */
  schedule?: string;
  /** Queue/topic name. REQUIRED for type 'queue'. */
  queue_name?: string;
  /** IMAP mailbox name. REQUIRED for type 'imap'. */
  mailbox?: string;
  /** Database table to watch. REQUIRED for type 'db-trigger'. */
  table?: string;
  /** Database events to react to. Applicable for type 'db-trigger'. */
  events?: ("INSERT" | "UPDATE" | "DELETE")[];
  /** Optional per-channel trigger concurrency limit. Default: 1. */
  max_parallel?: number;
  /** Optional overlap policy when saturated. Default: 'skip'. */
  overlap_policy?: "skip" | "queue" | "allow";
}

export interface ChannelSpec {
  /** REQUIRED. Channel type. */
  type: ChannelType;
  /** REQUIRED. Transport mechanism. */
  transport: TransportType;
  /** REQUIRED. Authentication for the channel platform. */
  auth: { secret_ref: SecretRef };
  access_control?: AccessControl;
  processing?: ChannelProcessing;
  features?: ChannelFeatures;
  /** Trigger configuration for event-driven channels (cron, queue, imap, db-trigger). */
  trigger?: ChannelTrigger;
}

export type Channel = PrimitiveEnvelope<"Channel", ChannelSpec>;

// ---------------------------------------------------------------------------
// 5.4 Tool
// ---------------------------------------------------------------------------

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface McpSource {
  uri: string;
  tool_name?: string;
}

export interface ToolSpec {
  /** REQUIRED when mcp_source is absent. */
  description?: string;
  /** REQUIRED when mcp_source is absent. JSON Schema object. */
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  sandbox_ref?: string;
  policy_ref?: string;
  mcp_source?: McpSource;
  annotations?: ToolAnnotations;
  timeout_ms?: number;
  retry?: { max_attempts?: number; backoff?: BackoffStrategy };
  /** If true, this tool wraps a Skill workflow. Gates apply to each sub-tool. */
  composite?: boolean;
  /** Reference to the Skill this composite tool wraps. REQUIRED when composite is true. */
  skill_ref?: string;
}

export type Tool = PrimitiveEnvelope<"Tool", ToolSpec>;

// ---------------------------------------------------------------------------
// 5.5 Skill
// ---------------------------------------------------------------------------

export type FilesystemPermission = "none" | "read-only" | "write-workspace" | "full";

export interface SkillPermissions {
  network?: boolean;
  filesystem?: FilesystemPermission;
  approval_required?: boolean;
}

export interface SkillEstimates {
  avg_tokens?: number;
  avg_duration_seconds?: number;
  avg_tool_calls?: number;
}

export interface SkillSpec {
  /** REQUIRED. Human-readable description. */
  description: string;
  /** REQUIRED. Tools this skill needs to function. */
  tools_required: string[];
  /** REQUIRED. Natural-language instructions for the LLM. */
  instruction: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  permissions?: SkillPermissions;
  estimates?: SkillEstimates;
}

export type Skill = PrimitiveEnvelope<"Skill", SkillSpec>;

// ---------------------------------------------------------------------------
// 5.6 Memory
// ---------------------------------------------------------------------------

export type MemoryStoreType = "conversation" | "semantic" | "key-value" | "workspace" | "checkpoint";
export type MemoryBackend = "sqlite" | "postgresql" | "filesystem" | "sqlite-vec" | "pgvector" | "qdrant" | "custom";
export type CompactionStrategy = "summarize" | "truncate" | "sliding-window";
export type SearchStrategy = "vector-only" | "fts-only" | "hybrid";
export type SearchFusion = "reciprocal-rank" | "linear-combination";
export type MemoryScope = "global" | "per-identity" | "per-channel";
export type WorkspaceIsolation = "shared" | "per-identity" | "per-channel";

export interface Retention {
  max_age?: DurationString;
  max_entries?: number;
}

export interface Compaction {
  enabled?: boolean;
  strategy?: CompactionStrategy;
}

export interface Embedding {
  provider_ref: string;
  model: string;
  dimensions: number;
}

export interface SearchConfig {
  strategy?: SearchStrategy;
  fusion?: SearchFusion;
  top_k?: number;
}

/** Checkpoint configuration for type 'checkpoint' stores. */
export interface CheckpointConfig {
  /** Maximum number of checkpoint snapshots retained per task. */
  max_snapshots?: number;
  /** Time-to-live for checkpoint entries before automatic cleanup. */
  ttl?: DurationString;
}

export interface MemoryStore {
  name: string;
  type: MemoryStoreType;
  backend?: MemoryBackend;
  retention?: Retention;
  compaction?: Compaction;
  embedding?: Embedding;
  search?: SearchConfig;
  scope?: MemoryScope;
  encryption?: boolean;
  path?: string;
  isolation?: WorkspaceIsolation;
  max_size_mb?: number;
  /** Checkpoint configuration. Applicable when type is 'checkpoint'. */
  checkpoint?: CheckpointConfig;
}

export interface MemorySpec {
  /** REQUIRED. At least one memory store. */
  stores: MemoryStore[];
}

export type Memory = PrimitiveEnvelope<"Memory", MemorySpec>;

// ---------------------------------------------------------------------------
// 5.7 Sandbox
// ---------------------------------------------------------------------------

export type IsolationLevel = "none" | "process" | "wasm" | "container" | "vm";
export type SandboxRuntime = "docker" | "apple-container" | "wasmtime" | "firecracker" | "gvisor" | "native";
export type NetworkMode = "deny" | "allowlist" | "allow-all";
export type FilesystemMode = "deny" | "read-only" | "scoped" | "full";
export type SecretInjection = "host-boundary" | "environment" | "file-mount";
export type ShellMode = "deny" | "restricted" | "full";

export interface SsrfProtection {
  enabled?: boolean;
  block_private_ips?: boolean;
  dns_pinning?: boolean;
}

export interface NetworkCapability {
  mode?: NetworkMode;
  allowed_hosts?: string[];
  ssrf_protection?: SsrfProtection;
}

export interface MountPath {
  path: string;
  permissions: "ro" | "rw";
}

export interface FilesystemCapability {
  mode?: FilesystemMode;
  mount_paths?: MountPath[];
  denied_paths?: string[];
}

export interface SecretsCapability {
  injection?: SecretInjection;
  encryption?: string;
  leak_detection?: { enabled?: boolean; patterns?: number };
}

export interface ShellCapability {
  mode?: ShellMode;
  blocked_commands?: string[];
  blocked_patterns?: string[];
}

export interface SandboxCapabilities {
  network?: NetworkCapability;
  filesystem?: FilesystemCapability;
  secrets?: SecretsCapability;
  shell?: ShellCapability;
}

export interface ResourceLimits {
  memory_mb?: number;
  cpu_shares?: number;
  max_processes?: number;
  max_open_files?: number;
  timeout_ms?: number;
  max_output_bytes?: number;
}

export interface SandboxSpec {
  /** REQUIRED. Isolation level. */
  level: IsolationLevel;
  runtime?: SandboxRuntime;
  capabilities?: SandboxCapabilities;
  resource_limits?: ResourceLimits;
}

export type Sandbox = PrimitiveEnvelope<"Sandbox", SandboxSpec>;

// ---------------------------------------------------------------------------
// 5.8 Policy
// ---------------------------------------------------------------------------

export type PolicyAction = "allow" | "deny" | "require-approval" | "audit-only";
export type PolicyScope = "tool" | "category" | "all";
export type PromptInjectionDetection = "pattern" | "llm-based" | "hybrid" | "none";
export type PromptInjectionAction = "block-and-log" | "warn" | "log-only" | "ignore";
export type SecretScanningScope = "input" | "output" | "both";
export type SecretScanningAction = "redact" | "block" | "warn";
export type AuditDestination = "file" | "sqlite" | "webhook" | "syslog";

export interface PolicyRule {
  id: string;
  action: PolicyAction;
  scope: PolicyScope;
  match?: {
    annotations?: Record<string, unknown>;
    category?: string;
  };
  reason?: string;
  approval?: {
    timeout_seconds?: number;
    default_if_timeout?: "deny" | "allow";
  };
  conditions?: {
    path_within?: string;
    [key: string]: unknown;
  };
  rate_limit?: {
    cost_per_day_usd?: number;
    tokens_per_day?: number;
  };
}

export interface PromptInjectionConfig {
  detection?: PromptInjectionDetection;
  pattern_engine?: string;
  pattern_count?: number;
  action?: PromptInjectionAction;
}

export interface SecretScanningConfig {
  enabled?: boolean;
  scope?: SecretScanningScope;
  patterns?: number;
  action?: SecretScanningAction;
}

export interface InputValidationConfig {
  max_size_bytes?: number;
  null_byte_detection?: boolean;
  whitespace_analysis?: boolean;
  encoding?: string;
}

export interface PolicyRateLimits {
  tool_calls_per_minute?: number;
  tokens_per_hour?: number;
  cost_per_day_usd?: number;
}

export interface AuditConfig {
  log_inputs?: boolean;
  log_outputs?: boolean;
  log_approvals?: boolean;
  retention?: DurationString;
  destination?: AuditDestination;
}

export interface PolicySpec {
  /** REQUIRED. Ordered list of rules (first match wins). */
  rules: PolicyRule[];
  prompt_injection?: PromptInjectionConfig;
  secret_scanning?: SecretScanningConfig;
  input_validation?: InputValidationConfig;
  rate_limits?: PolicyRateLimits;
  audit?: AuditConfig;
}

export type Policy = PrimitiveEnvelope<"Policy", PolicySpec>;

// ---------------------------------------------------------------------------
// 5.9 Swarm
// ---------------------------------------------------------------------------

export type SwarmTopology = "leader-worker" | "peer-to-peer" | "pipeline" | "broadcast" | "hierarchical";
export type MessagePassing = "queue" | "shared-memory" | "event-bus" | "direct";
export type CoordinationBackend = "sqlite-wal" | "redis" | "nats" | "in-process";
export type AggregationStrategy = "leader-decides" | "majority-vote" | "merge" | "chain" | "best-of-n";

export interface SwarmAgent {
  identity_ref: string;
  role: string;
  provider_ref?: string;
  count?: number;
}

export interface Concurrency {
  max_parallel?: number;
  sequential_within_agent?: boolean;
}

export interface SwarmCoordination {
  message_passing: MessagePassing;
  backend: CoordinationBackend;
  concurrency: Concurrency;
}

export interface SwarmAggregation {
  strategy: AggregationStrategy;
  cost_aware?: boolean;
  timeout_ms?: number;
}

export interface DeadLetter {
  enabled?: boolean;
  max_retries?: number;
}

export interface CircuitBreaker {
  failure_threshold?: number;
  reset_timeout_ms?: number;
}

export interface SwarmFailure {
  retry_per_agent?: number;
  dead_letter?: DeadLetter;
  circuit_breaker?: CircuitBreaker;
}

export interface SwarmResourceLimits {
  max_total_tokens?: number;
  max_total_cost_usd?: number;
  max_duration_ms?: number;
}

export interface SwarmSpec {
  /** REQUIRED. Coordination topology. */
  topology: SwarmTopology;
  /** REQUIRED. Participating agents. */
  agents: SwarmAgent[];
  /** REQUIRED. How agents exchange messages. */
  coordination: SwarmCoordination;
  /** REQUIRED. How results are combined. */
  aggregation: SwarmAggregation;
  failure?: SwarmFailure;
  resource_limits?: SwarmResourceLimits;
}

export type Swarm = PrimitiveEnvelope<"Swarm", SwarmSpec>;

// ---------------------------------------------------------------------------
// 5.10 Telemetry (OPTIONAL at all conformance levels)
// ---------------------------------------------------------------------------

export type TelemetryExporterType = "otlp" | "file" | "sqlite" | "webhook" | "console";

export interface TelemetryBatch {
  max_size?: number;
  flush_interval_ms?: number;
}

export interface TelemetryExporter {
  type: TelemetryExporterType;
  endpoint?: string;
  path?: string;
  auth?: { secret_ref?: SecretRef };
  batch?: TelemetryBatch;
}

export interface TelemetryEvents {
  tool_calls?: boolean;
  memory_ops?: boolean;
  swarm_ops?: boolean;
  lifecycle?: boolean;
  errors?: boolean;
}

export interface TelemetryMetrics {
  token_usage?: boolean;
  cost_usd?: boolean;
  latency_histogram?: boolean;
}

export interface TelemetrySampling {
  rate?: number;
}

export interface TelemetryRedaction {
  strip_arguments?: boolean;
  strip_results?: boolean;
}

export interface TelemetrySpec {
  /** REQUIRED. At least one telemetry exporter. */
  exporters: TelemetryExporter[];
  /** Which event categories to emit. */
  events?: TelemetryEvents;
  /** Which metrics to collect. */
  metrics?: TelemetryMetrics;
  /** Sampling configuration. */
  sampling?: TelemetrySampling;
  /** Data redaction settings. The runtime MUST NEVER emit raw prompts or CoT. */
  redaction?: TelemetryRedaction;
}

export type Telemetry = PrimitiveEnvelope<"Telemetry", TelemetrySpec>;

// ---------------------------------------------------------------------------
// 6. Claw Manifest
// ---------------------------------------------------------------------------

export type PrimitiveRef = string; // file path or claw:// URI

export interface InlineIdentity {
  inline: Omit<IdentitySpec, never>;
}

export interface InlineProvider {
  inline: Omit<ProviderSpec, never> & { name?: string };
}

export interface ClawManifestSpec {
  /** REQUIRED. File path, claw:// URI, or inline Identity. */
  identity: PrimitiveRef | InlineIdentity;
  /** REQUIRED. At least one Provider. */
  providers: (PrimitiveRef | InlineProvider)[];
  channels?: (PrimitiveRef | { inline: ChannelSpec & { name?: string } })[];
  tools?: (PrimitiveRef | { inline: ToolSpec & { name?: string } })[];
  skills?: (PrimitiveRef | { inline: SkillSpec & { name?: string } })[];
  memory?: PrimitiveRef | { inline: MemorySpec };
  sandbox?: PrimitiveRef | { inline: SandboxSpec };
  policies?: (PrimitiveRef | { inline: PolicySpec & { name?: string } })[];
  swarm?: PrimitiveRef | { inline: SwarmSpec };
  /** OPTIONAL. Telemetry configuration. Valid at all conformance levels. */
  telemetry?: PrimitiveRef | { inline: TelemetrySpec };
}

export type ClawManifest = PrimitiveEnvelope<"Claw", ClawManifestSpec>;

// ---------------------------------------------------------------------------
// 8. Lifecycle
// ---------------------------------------------------------------------------

export type LifecycleState = "INIT" | "STARTING" | "READY" | "STOPPING" | "STOPPED" | "ERROR";

// ---------------------------------------------------------------------------
// 9. JSON-RPC Methods — Request/Response Types
// ---------------------------------------------------------------------------

export type ConformanceLevel = "level-1" | "level-2" | "level-3";

/** claw.initialize — Request params */
export interface InitializeParams {
  protocolVersion: string;
  clientInfo: { name: string; version: string };
  manifest: Record<string, unknown>;
  capabilities: {
    tools?: Record<string, unknown>;
    swarm?: Record<string, unknown>;
    memory?: Record<string, unknown>;
  };
}

/** claw.initialize — Response result */
export interface InitializeResult {
  protocolVersion: string;
  agentInfo: { name: string; version: string };
  conformanceLevel: ConformanceLevel;
  capabilities: {
    tools?: Record<string, unknown>;
    swarm?: Record<string, unknown>;
    memory?: Record<string, unknown>;
  };
}

/** claw.status — Response result */
export interface StatusResult {
  state: LifecycleState;
  uptime_ms: number;
}

/** claw.heartbeat — Notification params (Agent → Operator) */
export interface HeartbeatParams {
  state: LifecycleState;
  uptime_ms: number;
  timestamp: string;
}

/** claw.shutdown — Request params */
export interface ShutdownParams {
  reason?: string;
  timeout_ms?: number;
}

/** claw.shutdown — Response result */
export interface ShutdownResult {
  drained: boolean;
}

/** claw.tool.call — Request params */
export interface ToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
  context: {
    request_id: string;
    identity: string;
    sandbox?: string;
    policy?: string;
  };
}

/** Content block (MCP-compatible). */
export interface ContentBlock {
  type: "text" | "image" | "resource";
  text?: string;
  [key: string]: unknown;
}

/** claw.tool.call — Response result */
export interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;
}

/** claw.tool.approve / claw.tool.deny — Request params */
export interface ToolApprovalParams {
  request_id: string;
  reason?: string;
}

/** claw.tool.approve / claw.tool.deny — Response result */
export interface AcknowledgeResult {
  acknowledged: boolean;
}

/** claw.swarm.delegate — Request params */
export interface SwarmDelegateParams {
  task_id: string;
  task: {
    description: string;
    input?: Record<string, unknown>;
  };
  context: {
    request_id: string;
    swarm: string;
  };
}

/** claw.swarm.report — Request params */
export interface SwarmReportParams {
  task_id: string;
  status: "completed" | "failed" | "partial";
  result: Record<string, unknown>;
  token_usage?: number;
  duration_ms?: number;
}

/** claw.swarm.broadcast — Notification params */
export interface SwarmBroadcastParams {
  swarm: string;
  message: Record<string, unknown>;
}

/** claw.swarm.discover — Request params */
export interface SwarmDiscoverParams {
  swarm?: string;
}

/** claw.swarm.discover — Response result */
export interface SwarmDiscoverResult {
  peers: Array<{
    identity: string;
    uri: string;
    status: "ready" | "busy" | "unavailable";
  }>;
}

/** claw.memory.query — Request params */
export interface MemoryQueryParams {
  store: string;
  query: {
    type: "semantic" | "key" | "time-range";
    text?: string;
    key?: string;
    time_range?: { from: string; to: string };
    top_k?: number;
  };
}

/** claw.memory.query — Response result */
export interface MemoryQueryResult {
  entries: Array<{
    id: string;
    content: string | Record<string, unknown>;
    score?: number;
    timestamp?: string;
  }>;
}

/** claw.memory.store — Request params */
export interface MemoryStoreParams {
  store: string;
  entries: Array<{
    content: string | Record<string, unknown>;
    key?: string;
    metadata?: Record<string, unknown>;
  }>;
  context: {
    request_id: string;
  };
}

/** claw.memory.store — Response result */
export interface MemoryStoreResult {
  stored: number;
  ids: string[];
}

/** claw.memory.compact — Request params */
export interface MemoryCompactParams {
  store: string;
}

/** claw.memory.compact — Response result */
export interface MemoryCompactResult {
  entries_before: number;
  entries_after: number;
}

// ---------------------------------------------------------------------------
// 9.4 Error Codes
// ---------------------------------------------------------------------------

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

export type CkpErrorCode = (typeof CKP_ERROR_CODES)[keyof typeof CKP_ERROR_CODES];

/** JSON-RPC 2.0 error object. */
export interface JsonRpcError {
  code: CkpErrorCode | number;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Union types
// ---------------------------------------------------------------------------

export type CkpPrimitive = Identity | Provider | Channel | Tool | Skill | Memory | Sandbox | Policy | Swarm | Telemetry;
export type CkpDocument = CkpPrimitive | ClawManifest;
