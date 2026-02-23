# NanoClaw CKP Compatibility Assessment

**Date:** 2026-02-23
**Assessed by:** @clawkernel/ckp-test v0.2.0
**NanoClaw version:** latest (commit as of assessment date)
**CKP version:** 0.2.0
**Source:** https://github.com/qwibitai/nanoclaw

---

## Status: Compatibility Assessment (pre-conformance)

This document maps NanoClaw's architecture to CKP primitives and methods. This is a **compatibility assessment**, not a conformance report. A conformance report requires running `ckp-test` against a live target with passing vectors.

---

## Primitive Mapping

| CKP Primitive | NanoClaw Equivalent | Status | Key Files |
|---|---|---|---|
| **Identity** | `CLAUDE.md` per group + `ASSISTANT_NAME` env var + `config.ts` | **Implemented** | `groups/*/CLAUDE.md`, `src/config.ts` |
| **Provider** | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | **Implemented** | `container/agent-runner/src/index.ts` |
| **Channel** | WhatsApp via baileys + extensible via skills | **Implemented** | `src/channels/whatsapp.ts` |
| **Tool** | SDK built-in tools (bash, web, files) + browser automation | **Implemented** | `container/agent-runner/`, `container/skills/agent-browser/` |
| **Skill** | Skills engine with YAML manifests + code transforms | **Implemented** | `skills-engine/`, `.claude/skills/` |
| **Memory** | 3-tier: SQLite + CLAUDE.md + filesystem per group | **Implemented** | `src/db.ts`, `groups/*/CLAUDE.md` |
| **Sandbox** | Docker / Apple Container with mount security | **Implemented** | `src/container-runner.ts`, `src/mount-security.ts` |
| **Policy** | Implicit role-based (main=admin, others=isolated) | **Partial** | `src/group-folder.ts`, `src/ipc.ts` |
| **Swarm** | Agent Teams via SDK (per-group, not cross-container) | **Partial** | `container/agent-runner/src/index.ts` |

**Primitive coverage:** 7/9 Implemented, 2/9 Partial

---

## Method Compatibility Table

| CKP Method | NanoClaw Status | Evidence | Notes |
|---|---|---|---|
| `claw.initialize` | **Implemented** | `src/index.ts` startup sequence | Boot reads config, loads groups, starts channel |
| `claw.initialized` | **Not supported** | — | No handshake notification; boot is fire-and-forget |
| `claw.status` | **Partial** | No JSON-RPC endpoint | State exists internally but not exposed via protocol |
| `claw.shutdown` | **Implemented** | Signal handling (SIGINT/SIGTERM) | Graceful shutdown with container cleanup |
| `claw.heartbeat` | **Not supported** | — | No proactive liveness signal |
| `claw.tool.call` | **Implemented** | Agent SDK `query()` → tool execution | Tools invoked by SDK, not via JSON-RPC |
| `claw.tool.approve` | **Not supported** | — | No approval gates; all tools execute immediately |
| `claw.tool.deny` | **Not supported** | — | No denial mechanism |
| `claw.swarm.delegate` | **Partial** | Agent Teams via SDK | Per-group only; no cross-container delegation |
| `claw.swarm.report` | **Partial** | Agent Teams results | Results returned inline, not via protocol |
| `claw.swarm.broadcast` | **Not supported** | — | No peer broadcast mechanism |
| `claw.swarm.discover` | **Not supported** | — | No peer discovery |
| `claw.memory.store` | **Implemented** | `db.ts` + CLAUDE.md writes | SQLite inserts + file writes |
| `claw.memory.query` | **Partial** | SQLite queries, no semantic search | Key-value and time-range only; no vector search |
| `claw.memory.compact` | **Not supported** | — | No compaction; conversations grow unbounded |

**Method support:** 6/15 Implemented, 4/15 Partial, 5/15 Not supported

---

## Conformance Level Prediction

| Level | Required Methods | Supported | Prediction |
|---|---|---|---|
| **L1 Core** | initialize, status, shutdown, heartbeat | 2 full + 1 partial + 1 missing | **PARTIAL** |
| **L2 Standard** | + tool.call, tool.approve, tool.deny | +1 full + 2 missing | **NON-CONFORMANT** |
| **L3 Full** | + swarm.*, memory.* | +2 partial + 3 missing | **NON-CONFORMANT** |

**Bridge required for L1:** Expose `claw.status` as JSON-RPC + add `claw.heartbeat` notification.
**Bridge required for L2:** Add approval workflow (`claw.tool.approve` / `claw.tool.deny`).

---

## Architecture Mapping

### Message Flow

```
WhatsApp (baileys)
  |
  v
src/index.ts (router)           <-- claw.initialize happens here
  |
  v
GroupQueue (per-group)
  |
  v
container-runner.ts              <-- claw.tool.call happens here
  |
  v
container/agent-runner           <-- Provider (Claude SDK) + Tools
  |
  v
IPC files → router → WhatsApp   <-- Channel response
```

### Security Layers (mapped to CKP)

```
Layer 1: Channel    → WhatsApp auth (baileys + pairing)
Layer 2: Policy     → Main vs non-main group isolation
Layer 3: Sandbox    → Docker/Apple Container + mount allowlist
Layer 4: Provider   → API key via env var (not mounted in container)
Layer 5: Memory     → Per-group SQLite + filesystem scoping
Layer 6: Swarm      → Per-group agent teams (no cross-group)
Layer 7: Identity   → CLAUDE.md + trigger pattern
```

---

## What a Bridge Would Need

To make NanoClaw CKP-conformant (L1), a bridge adapter (~300 lines) would:

1. **Wrap NanoClaw's startup** in a `claw.initialize` JSON-RPC handler
2. **Expose internal state** via `claw.status` JSON-RPC endpoint
3. **Add `claw.heartbeat`** notification emitter (timer-based)
4. **Add `claw.shutdown`** JSON-RPC handler that triggers graceful shutdown
5. **Listen on stdio** for JSON-RPC messages alongside WhatsApp

For L2, additionally:
6. **Intercept tool calls** and add approval gate before execution
7. **Expose `claw.tool.approve` / `claw.tool.deny`** handlers

---

## Skip Policy (for ckp-test)

```json
{
  "TV-L1-05": "NanoClaw doesn't negotiate protocol versions",
  "TV-L1-11": "No JSON-RPC listener (WhatsApp-only input)",
  "TV-L1-12": "No JSON-RPC listener (WhatsApp-only input)",
  "TV-L2-03": "No input schema validation (SDK handles)",
  "TV-L2-05": "No configurable timeout_ms per tool",
  "TV-L2-07": "No approval workflow",
  "TV-L2-09": "Sandbox constraints are mount-based, not per-request",
  "TV-L2-10": "No provider quota enforcement",
  "TV-L3-01": "Not all 9 primitives formally declared",
  "TV-L3-03": "No peer discovery",
  "TV-L3-06": "No memory compaction",
  "TV-L3-07": "No swarm broadcast"
}
```

---

*Generated by CKP Compatibility Assessment process. Not a conformance report.*
