# Claw Kernel Protocol Runtime Profile

**Version:** 0.2.0
**Date:** February 2026
**Status:** Informative Companion Document
**Companion to:** Claw Kernel Protocol Specification (`clawkernel-spec.md`)

---

## Scope

This document provides RECOMMENDED practices for CKP runtime implementers. It is entirely **informative** — implementations MAY deviate based on their target environment. These recommendations promote consistency across the ecosystem but are not required for conformance.

The normative specification is defined in `clawkernel-spec.md`. Where this document and the specification conflict, the specification takes precedence.

---

## Table of Contents

1. [Default Values](#1-default-values)
2. [Inline Primitive Name Generation](#2-inline-primitive-name-generation)
3. [Implicit CLI Channel](#3-implicit-cli-channel)
4. [Extended Error Catalog](#4-extended-error-catalog)
5. [Retry Semantics](#5-retry-semantics)
6. [Transport Extensions](#6-transport-extensions)
7. [Secret Resolution](#7-secret-resolution)
8. [Memory Consistency](#8-memory-consistency)
9. [Policy Composition](#9-policy-composition)
10. [Tool Execution Lifecycle](#10-tool-execution-lifecycle)

---

## 1. Default Values

When optional fields are omitted from primitive definitions, runtimes SHOULD apply the following defaults:

| Primitive | Field | Recommended Default |
|-----------|-------|-------------------|
| Identity | `autonomy` | `"supervised"` |
| Identity | `locale` | `"en-US"` |
| Provider | `streaming` | `false` |
| Channel | `access_control.mode` | Implementation-defined (RECOMMENDED: `allowlist` for remote channels) |
| Sandbox | `runtime` | Inferred from `level` (e.g., `container` → `docker`) |
| Policy | `prompt_injection.detection` | `"pattern"` |

---

## 2. Inline Primitive Name Generation

When `metadata.name` is omitted in an inline primitive, runtimes SHOULD generate names deterministically:

1. For Identity: name = parent Claw `metadata.name`
2. For array items (Provider, Channel, Tool, Skill, Policy): name = `{kind}-{zero-indexed-position}` (e.g., `provider-0`, `tool-2`)
3. If an explicit `name` field exists inside the inline block, use it as `metadata.name`
4. If a generated or explicit name collides with another primitive of the same kind, the runtime SHOULD reject the manifest with a descriptive error

---

## 3. Implicit CLI Channel

When no Channel primitive is declared in the manifest, runtimes SHOULD expose a default stdio-based CLI channel restricted to the local process owner:

```yaml
# Implicit channel (not serialized in manifest)
type: "cli"
transport: "stdio"
```

This implicit channel SHOULD NOT open any network listeners. The `stdio` transport inherently limits access to the OS session that launched the agent. For this implicit channel, runtimes SHOULD NOT serialize an `access_control.mode`; access is transport-scoped to the local process owner.

---

## 4. Extended Error Catalog

The core error codes are defined normatively in the specification (Section 9.4). This section provides the **extended catalog** for runtime-specific errors only. Runtimes SHOULD use these codes for interoperability:

| Code | Name | Meaning | Retryable |
|------|------|---------|-----------|
| `-32020` | Provider unavailable | LLM endpoint unreachable | Yes |
| `-32030` | Memory backend error | Memory store unreachable | Yes |
| `-32031` | Memory query failed | Query execution error | Yes |
| `-32040` | Peer unreachable | Swarm peer not responding | Yes |
| `-32041` | Peer task failed | Delegated task returned failure | No |
| `-32050` | Channel auth failed | Platform authentication failure | Yes |
| `-32051` | Channel rate limited | Platform rate limit exceeded | After cooldown |
| `-32060` | Manifest invalid | Manifest validation failed | No |
| `-32061` | Primitive not found | Referenced file or URI not resolvable | No |

---

## 5. Retry Semantics

For errors marked retryable, runtimes SHOULD implement exponential backoff:

```
delay = min(initial_delay_ms * 2^attempt, max_delay_ms)
```

Recommended values: `initial_delay_ms = 1000`, `max_delay_ms = 30000`, `max_attempts = 3`.

For idempotent retry safety, runtimes SHOULD include a `request_id` (UUID) in `claw.tool.call`, `claw.memory.store`, and `claw.swarm.delegate` messages, and deduplicate on the receiving side.

### Idempotency Contract

- Requests with the same `request_id` SHOULD return the same result without re-execution.
- The deduplication window SHOULD be at least 5 minutes.
- After the window expires, runtimes MAY treat the `request_id` as new.

---

## 6. Transport Extensions

The specification defines stdio and HTTP/SSE as MCP-compatible transports. This section provides framing guidance for the three extension transports.

### 6.1 WebSocket

WebSocket is the RECOMMENDED transport for real-time bidirectional communication, particularly swarm coordination.

- Implementations SHOULD use the `claw` WebSocket subprotocol (`Sec-WebSocket-Protocol: claw`).
- Each WebSocket message SHOULD contain exactly one complete JSON-RPC message as a text frame.
- Ping/pong frames SHOULD be used for keepalive with an interval not exceeding 30 seconds.
- Recommended close codes: `1000` for normal shutdown, `4001` for protocol error, `4002` for authentication failure.
- On unexpected disconnect, the client SHOULD attempt reconnection with exponential backoff.

### 6.2 Message Queue (NATS, Redis Streams, etc.)

Message queues are RECOMMENDED for distributed swarms where agents run on separate hosts.

- Messages SHOULD be serialized as complete JSON-RPC payloads.
- Recommended queue naming: `claw.{swarm_name}.{agent_identity}.{inbox|outbox}`.
- Implementations SHOULD support at-least-once delivery semantics.
- Exactly-once delivery MAY be achieved via `request_id` deduplication.
- The specific MQ technology (NATS, Redis Streams, RabbitMQ, etc.) is implementation-defined.

### 6.3 Filesystem

Filesystem transport is RECOMMENDED for container-to-container IPC in environments where network connectivity is restricted.

- Messages SHOULD be written as individual files to a shared directory.
- Recommended file naming: `{timestamp_ns}-{request_id}.json`.
- Writers SHOULD use a `.tmp` suffix and atomically rename to `.json` to prevent partial reads.
- Readers SHOULD poll the directory or use filesystem watches (e.g., inotify, kqueue, FSEvents).
- Processed message files SHOULD be moved to an `archive/` subdirectory or deleted.

---

## 7. Secret Resolution

The specification's `secret_ref` field references a secret by name. Runtimes SHOULD resolve secrets using the following precedence order:

1. **Runtime-specific secret store** (e.g., HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
2. **Environment variable** matching the `secret_ref` value
3. **File** at `$CLAW_SECRETS_DIR/{secret_ref}` (if the `CLAW_SECRETS_DIR` environment variable is set)

### Security Guidelines

- If a `secret_ref` cannot be resolved, the runtime SHOULD fail the operation that depends on it with a descriptive error.
- The runtime SHOULD NOT silently proceed with a null or empty secret.
- Secret values SHOULD NOT be logged, included in error messages, or transmitted in JSON-RPC messages.
- The `secret_ref` name (not value) MAY appear in logs for debugging purposes.

---

## 8. Memory Consistency

Memory stores provide **eventual consistency** by default:

- A `claw.memory.store` that returns successfully guarantees the entry is durable but MAY not be immediately visible to `claw.memory.query`.
- For `key-value` stores, `claw.memory.store` with an existing key SHOULD overwrite the previous value (last-writer-wins).
- For `conversation` stores, entries SHOULD be ordered by insertion time. `claw.memory.query` with `type: time-range` SHOULD return entries in chronological order.
- For `semantic` stores, newly stored entries SHOULD be queryable within 5 seconds (actual latency depends on embedding generation).

### Concurrent Access

- When multiple agent instances access the same memory store, runtimes SHOULD use optimistic concurrency (request_id-based deduplication) rather than distributed locks.
- If a write conflict is detected, the runtime SHOULD return an error rather than silently overwriting.

---

## 9. Policy Composition

When multiple Policy primitives are referenced in a manifest's `policies` array, the runtime SHOULD evaluate them as described in the specification's Policy Validation Rules (Section 5.8): a single concatenated rule list in manifest order, with first-match-wins semantics.

### Multi-Policy Patterns

**Separation of concerns:** Use separate policies for security rules and spending rules:

```yaml
policies:
  - "./policies/security.yaml"    # Security rules evaluated first
  - "./policies/spending.yaml"    # Cost rules evaluated second
```

**Override pattern:** A more specific policy placed first overrides a general policy:

```yaml
policies:
  - "./policies/project-exceptions.yaml"   # Specific exceptions
  - "./policies/organization-baseline.yaml" # General rules
```

---

## 10. Tool Execution Lifecycle

### Synchronous Execution (Default)

Tool execution is synchronous by default: `claw.tool.call` blocks until the response is returned.

### Timeout Behavior

If a tool specifies `timeout_ms` and execution exceeds it, the runtime SHOULD:

1. Terminate the tool process (SIGTERM, then SIGKILL after a grace period)
2. Return error code `-32014` to the caller
3. Log the timeout event for audit purposes

### Progress Notifications (OPTIONAL)

For long-running tools, runtimes MAY support progress notifications:

```json
{
  "jsonrpc": "2.0",
  "method": "claw.tool.progress",
  "params": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "progress": 0.45,
    "message": "Processing page 45 of 100"
  }
}
```

This is a notification (no response expected). Support for `claw.tool.progress` is OPTIONAL — runtimes that do not support it SHOULD silently ignore these notifications.

### Approval Flow

When a Policy rule evaluates to `require-approval`:

1. The runtime SHOULD emit a human-readable prompt through the active Channel
2. The runtime SHOULD NOT execute the tool until `claw.tool.approve` or `claw.tool.deny` is received, or the timeout expires
3. If the timeout expires, the runtime SHOULD apply the `default_if_timeout` action from the policy rule

---

## 11. Release Checklist (Informative)

Before tagging a new specification version, verify:

1. No normative contradictions (each error code maps to exactly one meaning)
2. All methods have explicit params/result contracts with field tables
3. TypeScript schema is published and consistent with prose
4. Conformance test vectors (see `clawkernel-test-vectors.md`) pass for all declared levels (L1/L2/L3)
5. No references to previous version strings remain in examples
6. Normative keywords (must, should, may per RFC 2119) are used consistently and only in capitalized form
7. No project-specific marketing language in normative sections
8. ABNF grammar in Section 7 of the specification covers all URI examples used in manifests and wire messages
9. Error code table in Section 9.4 has no duplicate codes
10. `clawkernel-runtime-profile.md` is synchronized with any normative changes

---

## Appendix: Ecosystem Context (Informative)

The following content provides background context on the Claw ecosystem and is not part of the normative specification.

### Comparison Matrix: MCP vs CKP

| Dimension | MCP | CKP |
|-----------|-----|-------------|
| **Primary focus** | Tool/resource discovery for LLM hosts | Complete autonomous agent definition |
| **Architecture** | Client-Host-Server (tool-centric) | Agent-centric (identity-first) |
| **Primitives** | 6 (Tools, Resources, Prompts, Sampling, Roots, Elicitation) | 9 (Identity, Provider, Channel, Tool, Skill, Memory, Sandbox, Policy, Swarm) |
| **Agent identity** | None (server has name/version only) | First-class: personality, context files, autonomy level |
| **Communication** | Host-mediated (server cannot initiate contact) | Multi-channel: 16+ platform types |
| **Security** | Host enforces policies (not specified in protocol) | Declarative: Sandbox + Policy as first-class primitives |
| **Memory** | Session-scoped (stateful but ephemeral) | Persistent: conversation, semantic, key-value, workspace |
| **Multi-agent** | None (servers are isolated by design) | Swarm primitive with 5 topologies |
| **Tool execution** | Atomic call/response | Sandboxed, policy-governed, approval-gated |
| **Skill composition** | Not supported (host orchestrates opaquely) | First-class: Skills compose Tools with LLM instructions |
| **Cost governance** | Not addressed | Provider limits + Policy rate limits + Swarm cost caps |
| **Wire format** | JSON-RPC 2.0 | JSON-RPC 2.0 (compatible) |
| **Transport** | stdio, Streamable HTTP | stdio, HTTP/SSE, WebSocket, Message Queue, Filesystem |
| **Complementary?** | — | Yes. MCP tools are first-class CKP tool sources |

### The February 2026 Claw Landscape

| Project | Language | Key Innovation |
|---------|----------|----------------|
| **OpenClaw** | TypeScript | Pioneered the category; 15+ channels, skills marketplace |
| **ZeroClaw** | Rust | Trait-driven architecture; runs on $10 hardware |
| **PicoClaw** | Go | 95% AI-generated; cross-architecture (x86, ARM, RISC-V) |
| **TinyClaw** | TypeScript | CLI-delegated agents; SQLite-WAL message queue |
| **NanoClaw** | TypeScript | Agent Swarms; OS-level container isolation |
| **IronClaw** | Rust | WASM sandbox; dynamic tool generation; zero telemetry |
| **ZeptoClaw** | Rust | 8-layer security; ~4MB binary; 2,300+ tests |
| **Clawlet** | Python | Identity-aware (SOUL.md); 18+ LLM providers |
| **Moltis** | Rust | Auditable ~5K-line agent loop; WebAuthn; lifecycle hooks |

### Convergence Points

Despite independent development, all projects converge on the same fundamental needs — each addressed by a CKP primitive:

| Need | CKP Primitive |
|------|----------------------|
| Agent personality/identity | **Identity** |
| Multi-LLM abstraction | **Provider** |
| Messaging platform adapters | **Channel** |
| Tool execution | **Tool** |
| Composed workflows | **Skill** |
| Persistent memory | **Memory** |
| Execution isolation | **Sandbox** |
| Behavioral rules | **Policy** |
| Multi-agent coordination | **Swarm** |

---

## Acknowledgments

This specification is informed by the architectural innovations of:

- **OpenClaw** (Peter Steinberger) — Pioneered the Claw category
- **ZeroClaw** (zeroclaw-labs) — Demonstrated trait-driven, sub-5MB agents on minimal hardware
- **PicoClaw** (Sipeed) — Proved AI agents can run on $10 RISC-V boards
- **TinyClaw** (jlia0) — Introduced CLI-delegated multi-agent coordination
- **NanoClaw** (qwibitai) — Established Agent Swarms and OS-level isolation
- **IronClaw** (NEAR AI) — Advanced WASM sandboxing and zero-telemetry privacy
- **ZeptoClaw** (qhkm) — Set the benchmark for security hardening
- **Clawlet** (Kxrbx) — Brought identity awareness and Python accessibility
- **Moltis** (moltis-org) — Demonstrated auditable agent loops and lifecycle hooks
- **Model Context Protocol** (Anthropic) — Established the gold standard for tool/resource interoperability

---

*This document is part of the Claw Kernel Protocol specification suite and is released under the Apache 2.0 License.*
