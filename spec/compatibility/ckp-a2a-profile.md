# CKP-A2A Compatibility Profile

**Profile Version:** 0.1.0-draft  
**Date:** 2026-02-24  
**Status:** Draft (implementation profile)  
**Scope:** CKP runtime interoperability with A2A task/discovery surfaces, while preserving CKP core primitives and MCP compatibility.

---

## 1. Version Targets

This profile targets the following protocol baselines:

- **CKP:** `v0.2.0` (released)
- **A2A:** latest released `0.3.0` (spec site currently labels latest spec as Release Candidate v1.0)
- **MCP:** protocol revision `2025-11-25`

This profile is designed to be additive and non-breaking for CKP `v0.2.x` runtimes.

---

## 2. Design Goal

Enable a CKP runtime to interoperate with A2A clients/servers for agent-to-agent task collaboration without changing CKP primitive names or weakening CKP runtime governance (`Policy`, `Sandbox`, `Memory`, `Telemetry`).

---

## 3. Compatibility Boundary

### 3.1 In Scope

- Discovery/capabilities projection (`Identity`/`Skill` -> `AgentCard`/`AgentSkill`)
- Task lifecycle bridge (A2A operations <-> CKP task namespace)
- Payload and status mapping
- Transport/binding compatibility at adapter boundary

### 3.2 Out of Scope (v0.1.0-draft)

- Renaming CKP core primitives
- Replacing CKP `claw.swarm.*` methods
- Forcing A2A-native security model into CKP internals
- Modifying MCP compatibility semantics (`Tool` + `mcp_source`)

---

## 4. Lexicon Policy (Critical)

### 4.1 CKP Core Terms (MUST remain canonical in CKP manifests)

- `Identity`, `Provider`, `Channel`, `Tool`, `Skill`, `Memory`, `Sandbox`, `Policy`, `Swarm`, `Telemetry`

### 4.2 A2A Terms (MUST be used at A2A boundary)

- `AgentCard`, `AgentSkill`, `Task`, `TaskState`, `Message`, `Part`, `Artifact`

### 4.3 Renaming Policy

- CKP runtimes **MUST NOT** rename `Identity` to `Card` in CKP schema.
- CKP runtimes **MUST** emit an A2A `AgentCard` projection when A2A compatibility mode is enabled.
- CKP runtimes **SHOULD** add a dedicated task namespace (`claw.task.*`) for A2A lifecycle bridging.

Rationale: keep CKP stable and map to A2A at the interop boundary.

---

## 5. Discovery & Capability Mapping

### 5.1 CKP -> A2A: AgentCard

| CKP Source | A2A Target | Rule |
|---|---|---|
| `Identity.metadata.name` | `AgentCard.name` | Copy verbatim |
| `Identity.metadata.version` | `AgentCard.version` | Copy; if absent use runtime version |
| `Identity.spec.personality` | `AgentCard.description` | Summarized projection (not full prompt dump) |
| Runtime endpoint config | `AgentCard.supported_interfaces[]` | Populate `url`, `protocol_binding`, `protocol_version` |
| Runtime capabilities | `AgentCard.capabilities` | Map streaming/push support |
| Runtime security config | `AgentCard.security_schemes` / `security_requirements` | Project per interface/tenant |
| Runtime media defaults | `default_input_modes` / `default_output_modes` | Project configured modes |
| CKP skills | `AgentCard.skills[]` | See 5.2 |

### 5.2 CKP Skill -> A2A AgentSkill

| CKP Source | A2A Target | Rule |
|---|---|---|
| `Skill.metadata.name` | `AgentSkill.id` | Stable identifier |
| `Skill.metadata.name` | `AgentSkill.name` | Humanized if needed |
| `Skill.spec.description` | `AgentSkill.description` | Copy |
| `Skill.metadata.labels` + `tools_required` | `AgentSkill.tags[]` | Flatten labels and dependencies into tags |
| `Skill.spec.input_schema` | `AgentSkill.examples` or extension params | A2A has no schema field; attach via extension metadata |
| Skill I/O mode hints | `input_modes` / `output_modes` | Optional override |

---

## 6. Task Lifecycle Interoperability

### 6.1 CKP Namespace Extension

CKP runtimes enabling A2A compatibility SHOULD implement:

- `claw.task.create`
- `claw.task.get`
- `claw.task.list`
- `claw.task.cancel`
- `claw.task.subscribe`

`claw.swarm.*` remains valid for CKP-native orchestration.

### 6.2 Operation Mapping

| A2A Operation | CKP Interop Method | Notes |
|---|---|---|
| `SendMessage` | `claw.task.create` | May create task or return direct result |
| `SendStreamingMessage` | `claw.task.create` + stream | Stream status/artifact updates |
| `GetTask` | `claw.task.get` | Return current state + outputs |
| `ListTasks` | `claw.task.list` | Filterable task list |
| `CancelTask` | `claw.task.cancel` | Best-effort cancellation semantics |
| `SubscribeToTask` | `claw.task.subscribe` | Streaming updates |

### 6.3 Status Mapping

CKP interop status model SHOULD include these states:

- `submitted`
- `working`
- `input_required`
- `auth_required`
- `completed`
- `failed`
- `canceled`
- `rejected`

A2A mapping is 1:1 against corresponding `TaskState` values.

---

## 7. Payload Mapping

| A2A Model | CKP Interop Model | Notes |
|---|---|---|
| `Message` | task message envelope | include role + metadata |
| `Part.text` | text content block | direct map |
| `Part.raw` | binary content block | base64 or byte channel per transport |
| `Part.url` | resource reference | preserve URI |
| `Part.data` | structured JSON block | direct map |
| `Artifact` | task output artifact/result block | support incremental updates where streaming exists |

---

## 8. Security Boundary Rules

- CKP `Policy` and `Sandbox` remain authoritative for execution control.
- A2A-originated requests are treated as untrusted external input.
- A2A security metadata maps to inbound authN/authZ checks at the `Channel`/edge layer.
- Sensitive CKP internals (raw prompts, CoT, secrets) MUST NOT be projected into `AgentCard` or task payloads.

---

## 9. MCP Non-Regression Rules

To preserve CKP-MCP interoperability, implementations following this profile MUST keep:

- `Tool` primitive semantics unchanged
- `mcp_source` behavior unchanged
- MCP proxy flow (`tools/list`, `tools/call`) unchanged

A2A compatibility is additive and MUST NOT weaken MCP compatibility.

---

## 10. Delivery Plan (Impeccable Execution)

### Phase A — Specification Artifacts

1. Add this profile file to `spec/compatibility/`.
2. Add README links to this profile.
3. Add docs references (if docs site mirrors spec navigation).

### Phase B — SDK Adapter

1. Implement `a2aAdapter` module in `@clawkernel/sdk`.
2. Implement `AgentCard` projection from CKP runtime metadata.
3. Implement `claw.task.*` bridge with status mapping.

### Phase C — Conformance

1. Add `ckp-test` compatibility suite (profile-specific vectors).
2. Validate:
   - discovery projection
   - task lifecycle
   - state transitions
   - streaming/cancel semantics
3. Publish compatibility report.

### Phase D — Rollout

1. Mark profile as `experimental` in `0.1.x`.
2. Promote to stable after two independent runtimes pass suite.

---

## 11. Acceptance Criteria

- CKP core schemas remain backward compatible.
- MCP integration tests remain green.
- A2A profile vectors pass for supported paths.
- README + docs point to authoritative profile path.
- No ambiguity in terminology (CKP core terms inside CKP, A2A terms at interop boundary).

---

## 12. Change Log

### 0.1.0-draft

- Initial CKP-A2A interoperability profile
- Field-level discovery mapping
- Task lifecycle mapping
- Lexicon/renaming policy
- MCP non-regression guarantees
