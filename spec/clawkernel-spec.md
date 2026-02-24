# Claw Kernel Protocol Specification

**Version:** 0.2.0
**Date:** February 2026
**Status:** Released
**URI Scheme:** `claw://`
**License:** Apache 2.0

---

## Abstract

The Claw Kernel Protocol (CKP) is an open specification for describing, composing, and interoperating autonomous AI agents ("Claws"). It defines 10 primitive units (9 core primitives plus Telemetry) that, together, form a complete declarative manifest for an agent's identity, capabilities, communication surfaces, security boundaries, memory systems, and multi-agent coordination.

CKP is **complementary to MCP** (Model Context Protocol). Where MCP standardizes how LLM hosts discover and invoke tools, resources, and prompts from external servers, CKP standardizes how autonomous agents are **assembled, secured, and orchestrated** as first-class runtime entities.

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Principles](#2-design-principles)
3. [Relationship to Existing Protocols](#3-relationship-to-existing-protocols)
4. [Architecture Overview](#4-architecture-overview)
5. [The Ten Primitives](#5-the-ten-primitives)
   - 5.1 [Identity](#51-identity)
   - 5.2 [Provider](#52-provider)
   - 5.3 [Channel](#53-channel)
   - 5.4 [Tool](#54-tool)
   - 5.5 [Skill](#55-skill)
   - 5.6 [Memory](#56-memory)
   - 5.7 [Sandbox](#57-sandbox)
   - 5.8 [Policy](#58-policy)
   - 5.9 [Swarm](#59-swarm)
6. [Claw Manifest](#6-claw-manifest)
   - 6.1 [Inline Primitives](#61-inline-primitives)
7. [URI Scheme](#7-uri-scheme)
8. [Lifecycle](#8-lifecycle)
9. [Transport & Wire Format](#9-transport--wire-format)
   - 9.0 [Actor Model](#90-actor-model)
   - 9.1 [JSON-RPC 2.0](#91-json-rpc-20)
   - 9.2 [Supported Transports](#92-supported-transports)
   - 9.3 [Methods](#93-methods)
   - 9.4 [Error Codes](#94-error-codes)
10. [Security Model](#10-security-model)
11. [Conformance Levels](#11-conformance-levels)
12. [Appendix A: Full Manifest Example](#appendix-a-full-manifest-example)
13. [Appendix B: Schema References and Precedence](#appendix-b-schema-references-and-precedence)
14. [Appendix C: Glossary](#appendix-c-glossary)
15. [Appendix D: Runtime Profile (Transition Notice)](#appendix-d-runtime-profile-transition-notice)

---

## 1. Motivation

### 1.1 The Claw Explosion

In late January 2026, the open-source release of OpenClaw (formerly Clawdbot/Moltbot) catalyzed an unprecedented wave of autonomous AI agent frameworks. Within three weeks, over 25 independent projects emerged — each reimplementing the same fundamental concepts with incompatible formats:

| Problem | Current State |
|---------|---------------|
| **Agent Identity** | `SOUL.md`, `CLAUDE.md`, identity YAML, inline strings — no common format |
| **LLM Providers** | Each project reinvents multi-provider abstraction from scratch |
| **Messaging Channels** | Telegram/Discord/WhatsApp adapters duplicated across every project |
| **Tool Definitions** | TOML manifests, JSON configs, SKILL.md files, WASM modules, CLI delegation |
| **Security Boundaries** | From zero isolation to 8-layer defense — no shared vocabulary |
| **Memory Systems** | SQLite, PostgreSQL, pgvector, flat files — each project builds its own |
| **Multi-Agent Coordination** | Swarms, teams, pipelines — no interop protocol |

This mirrors the state of web APIs before REST/OpenAPI, and LLM tool integration before MCP.

### 1.2 What MCP Does Not Cover

MCP (Model Context Protocol) solved a critical problem: standardizing how LLM hosts discover and invoke tools from external servers. However, MCP is explicitly **host-centric and tool-centric**. It does not address:

1. **Agent identity and personality** — Who is this agent? What does it remember across sessions?
2. **Communication channels** — How does a human reach this agent (Telegram, Slack, voice)?
3. **Execution security** — What sandbox constrains tool execution? What policies govern behavior?
4. **Persistent memory** — What does the agent know beyond the current session?
5. **Multi-agent coordination** — How do multiple agents collaborate, delegate, or supervise?
6. **Autonomy levels** — How much can this agent do without human approval?
7. **Skill composition** — How are atomic tools composed into higher-order workflows?

CKP fills these gaps.

### 1.3 Goal

Define a minimal, sufficient set of primitives such that:

- A skill written for one Claw implementation runs unmodified on another
- Security posture is declarative, auditable, and portable
- Multi-agent swarms can coordinate across heterogeneous implementations
- The same agent manifest can target hardware from a $10 embedded board to a cloud cluster
- MCP tools and servers remain first-class citizens within the protocol

### 1.4 Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://datatracker.ietf.org/doc/html/bcp14) [[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)] [[RFC 8174](https://datatracker.ietf.org/doc/html/rfc8174)] when, and only when, they appear in capitalized form, as shown here.

CKP uses semantic versioning (`MAJOR.MINOR.PATCH`). Versions with the same major number are backward-compatible: an Agent implementing version 0.2.x MUST accept connections from clients sending any `protocolVersion` with major version `0`. Versions with different major numbers are incompatible: the Agent MUST reject the connection with error code `-32001`.

> **Normative scope:** Sections 5–11 of this specification are normative. Sections 1–4 are informative context. Appendices are informative unless explicitly marked otherwise.

### 1.5 Versioning Policy

- **MAJOR** increments signal backward-incompatible changes to normative sections.
- **MINOR** increments signal backward-compatible additions (new methods, new optional fields).
- **PATCH** increments signal editorial corrections with no behavioral change.
- Deprecated features MUST be annotated with `(Deprecated since X.Y.Z)` and MUST remain functional for at least one minor version after deprecation.

---

## 2. Design Principles

CKP is guided by seven principles:

| Principle | Statement |
|-----------|-----------|
| **P1: Declarative Over Imperative** | Agent behavior is described, not coded. A YAML/JSON manifest declares what an agent *is* and *can do*. The runtime decides *how*. |
| **P2: Secure by Default** | Security is not an add-on. Every primitive has built-in security surfaces. A Claw with no explicit policy runs in the most restrictive mode. |
| **P3: MCP-Compatible** | CKP's Tool primitive is a strict superset of MCP's tool definition. Any MCP server can be referenced as a CKP tool source. |
| **P4: Transport-Agnostic** | CKP does not mandate a specific transport. Manifests can be exchanged over stdio, HTTP, WebSocket, message queues, or filesystem. |
| **P5: Progressive Complexity** | A valid Claw manifest can be as simple as an Identity + one Provider. Every other primitive is optional and additive. |
| **P6: Hardware-Agnostic** | The same manifest targets any runtime — from a Rust binary on embedded hardware to a TypeScript process on Kubernetes. |
| **P7: Auditable** | Every primitive produces structured telemetry. Agent behavior can be traced, replayed, and audited. |

---

## 3. Relationship to Existing Protocols

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Claw Kernel Protocol (claw://)        │   │
│  │  Identity · Channel · Skill · Memory · Sandbox ·     │   │
│  │  Policy · Swarm · Provider · Tool                    │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ extends                                     │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │              MCP (Model Context Protocol)             │   │
│  │  Tools · Resources · Prompts · Sampling ·            │   │
│  │  Elicitation · Roots                                 │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ uses                                        │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │              JSON-RPC 2.0                             │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ over                                        │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │     stdio | HTTP/SSE | WebSocket | Message Queue      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

| Protocol | Scope | CKP Relationship |
|----------|-------|--------------------------|
| **MCP** | Tool/resource discovery between LLM hosts and servers | CKP Tool is a superset of MCP Tool. MCP servers are first-class tool sources. |
| **OpenAI-compatible API** | LLM inference (chat completions, embeddings) | CKP Provider abstracts any OpenAI-compatible endpoint. |
| **OCI** | Container image packaging and distribution | CKP Sandbox can reference OCI container images for execution environments. |
| **OAuth 2.1** | Authorization flows | CKP Channel and Provider use OAuth for authentication where applicable. |
| **JSON-RPC 2.0** | Message framing | CKP adopts JSON-RPC 2.0 as its wire format, consistent with MCP. |

---

## 4. Architecture Overview

### 4.1 Conceptual Model

```
                    ┌─────────────┐
                    │   Human     │
                    └──────┬──────┘
                           │ interacts via
                    ┌──────▼──────┐
                    │  Channel(s) │  Telegram, Slack, CLI, Webhook, Voice...
                    └──────┬──────┘
                           │ routes to
                    ┌──────▼──────┐
                    │  Identity   │  Who am I? What do I know? What is my purpose?
                    └──────┬──────┘
                           │ reasons with
                    ┌──────▼──────┐
                    │  Provider   │  Claude, GPT, Gemini, Ollama, local model...
                    └──────┬──────┘
                           │ acts through
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌─────▼─────┐  ┌──▼──────┐
       │  Tool   │  │   Skill   │  │  Swarm  │
       └────┬────┘  └─────┬─────┘  └────┬────┘
            │             │              │
       ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐
       │ Sandbox │  │  Memory   │  │ Policy  │
       └─────────┘  └───────────┘  └─────────┘
```

### 4.2 Primitive Dependency Graph

```
Claw Manifest (claw.yaml)
├── Identity (required)
├── Provider (required, at least one)
├── Channel (optional, at least one for interactive use)
├── Tool[] (optional)
│   ├── references → Sandbox
│   └── references → Policy
├── Skill[] (optional)
│   └── composes → Tool[]
├── Memory (optional)
├── Sandbox (optional, defaults to most restrictive)
├── Policy[] (optional, defaults to deny-all for unconfigured categories)
└── Swarm (optional)
    └── references → Identity[] (other agents)
```

---

## 5. The Ten Primitives

Every primitive is a YAML or JSON document with a common envelope:

```yaml
claw: "0.2.0"                    # Protocol version
kind: Identity | Provider | Channel | Tool | Skill | Memory | Sandbox | Policy | Swarm | Telemetry
metadata:
  name: "string"                  # Unique within the manifest (kebab-case)
  version: "semver"               # Semantic version of this primitive instance
  labels: {}                      # Optional key-value pairs for filtering
  annotations: {}                 # Optional metadata (untrusted, not used by runtime)
spec:
  # Kind-specific fields
```

Every primitive document MUST include the `claw`, `kind`, and `metadata.name` fields. The `claw` field MUST be a valid protocol version string (semver). The `kind` field MUST be one of the eleven valid values: `Identity`, `Provider`, `Channel`, `Tool`, `Skill`, `Memory`, `Sandbox`, `Policy`, `Swarm`, `Telemetry`, or `Claw`. The `metadata.name` field MUST be unique within the manifest for primitives of the same kind. Runtimes MUST NOT interpret `annotations` for operational decisions; `labels` MAY be used for filtering and policy matching.

### 5.1 Identity

**URI:** `claw://local/identity/{name}` (alias: `claw://identity/{name}`)

The Identity primitive defines **who the agent is**: its personality, persistent context files, locale, and declared capabilities. It is the only primitive that is always required.

#### Schema

```yaml
claw: "0.2.0"
kind: Identity
metadata:
  name: "research-assistant"
  version: "1.0.0"
spec:
  # REQUIRED: Natural-language description of the agent's personality and behavior.
  # This is injected as system context to the LLM provider.
  personality: |
    You are a meticulous research assistant. You verify claims against
    multiple sources before reporting findings. You always cite sources
    and distinguish between established facts and preliminary findings.

  # OPTIONAL: Persistent context files maintained across sessions.
  # These files are read/written by the agent and survive restarts.
  context_files:
    user: "USER.md"               # User preferences and profile
    memory: "MEMORY.md"           # Accumulated knowledge
    rules: "RULES.md"             # Behavioral constraints

  # OPTIONAL: Default locale for the agent's responses.
  locale: "en-US"

  # OPTIONAL: Declared high-level capabilities (informational, not enforced).
  capabilities:
    - "web-research"
    - "document-analysis"
    - "data-visualization"

  # OPTIONAL: Autonomy level — how much the agent can do without human approval.
  autonomy: "supervised"          # "observer" | "supervised" | "autonomous"
```

#### Autonomy Levels

| Level | Description | Example |
|-------|-------------|---------|
| `observer` | Read-only. Can analyze and respond but cannot execute tools or side effects. | Monitoring dashboards, answering questions |
| `supervised` | Can execute tools but requires human approval for actions with side effects. Default. | Drafting emails (human clicks send), preparing reports |
| `autonomous` | Can execute tools and side effects without per-action approval, governed by Policy. | Scheduled data collection, automated notifications |

#### Validation Rules

- Every Claw manifest MUST include exactly one Identity primitive.
- The `personality` field is REQUIRED and MUST be a non-empty string.
- The `autonomy` field is OPTIONAL. If omitted, the runtime SHOULD default to `supervised`.
- When `autonomy` is `observer`, the runtime MUST NOT execute any tools or produce side effects.
- When `autonomy` is `supervised`, the runtime MUST request human approval before executing tools with side effects.
- When `autonomy` is `autonomous`, the runtime MAY execute tools without per-action approval, subject to Policy rules.

> **Design rationale:** The Identity primitive unifies the agent personality, context file, and graduated autonomy patterns observed across multiple Claw implementations into a single portable declaration.

---

### 5.2 Provider

**URI:** `claw://local/provider/{name}` (alias: `claw://provider/{name}`)

The Provider primitive abstracts LLM inference endpoints. A Claw can reference multiple providers with fallback chains, cost routing, and capability-based selection.

#### Schema

```yaml
claw: "0.2.0"
kind: Provider
metadata:
  name: "primary-llm"
  version: "1.0.0"
spec:
  # REQUIRED: Protocol for communicating with the LLM endpoint.
  protocol: "openai-compatible"   # "openai-compatible" | "anthropic-native" | "custom"

  # REQUIRED: Base URL for the inference API.
  endpoint: "https://api.example.com/v1"

  # REQUIRED: Model identifier.
  model: "gpt-5-turbo"

  # REQUIRED: Authentication configuration.
  auth:
    type: "bearer"                # "bearer" | "api-key-header" | "oauth2" | "none"
    secret_ref: "LLM_API_KEY"    # Environment variable or secret store key

  # OPTIONAL: Enable streaming responses.
  streaming: true

  # OPTIONAL: Model selection hints (following MCP's modelPreferences pattern).
  hints:
    cost_priority: 0.3            # 0.0 (ignore cost) to 1.0 (minimize cost)
    speed_priority: 0.5           # 0.0 (ignore speed) to 1.0 (minimize latency)
    intelligence_priority: 0.8    # 0.0 (any quality) to 1.0 (maximize quality)

  # OPTIONAL: Fallback chain — tried in order if primary fails.
  fallback:
    - provider_ref: "secondary-llm"
    - provider_ref: "local-llm"

  # OPTIONAL: Usage limits for cost governance.
  limits:
    tokens_per_day: 500000
    tokens_per_request: 32000
    requests_per_minute: 60
    max_context_window: 200000

  # OPTIONAL: Retry configuration.
  retry:
    max_attempts: 3
    backoff: "exponential"        # "exponential" | "linear" | "constant"
    initial_delay_ms: 1000
```

#### Validation Rules

- A Claw manifest MUST include at least one Provider primitive.
- The `protocol`, `endpoint`, `model`, and `auth` fields are REQUIRED.
- When `auth.type` is not `none`, `auth.secret_ref` MUST be present.
- Fallback providers, if declared, MUST be tried in array order. The runtime MUST NOT skip entries.
- If `limits.tokens_per_day` is present, the runtime MUST enforce it and reject requests that would exceed the limit with error code `-32021`.

> **Design rationale:** The Provider primitive normalizes multi-LLM abstraction, cascading fallback, cost-aware routing, and token governance into a single declaration. The `hints` field follows MCP's `modelPreferences` pattern.

---

### 5.3 Channel

**URI:** `claw://local/channel/{name}` (alias: `claw://channel/{name}`)

The Channel primitive abstracts communication surfaces — how humans (or other systems) reach the agent.

#### Schema

```yaml
claw: "0.2.0"
kind: Channel
metadata:
  name: "team-slack"
  version: "1.0.0"
spec:
  # REQUIRED: Channel type.
  type: "slack"                   # "telegram" | "discord" | "whatsapp" | "slack"
                                  # | "email" | "webhook" | "cli" | "voice" | "web"
                                  # | "lark" | "matrix" | "line" | "wechat" | "qq"
                                  # | "dingtalk" | "cron" | "queue" | "imap"
                                  # | "db-trigger" | "custom"

  # REQUIRED: Transport mechanism for this channel.
  transport: "websocket"          # "polling" | "webhook" | "websocket" | "stdio"

  # REQUIRED: Authentication for the channel platform.
  auth:
    secret_ref: "SLACK_BOT_TOKEN"

  # OPTIONAL: Access control — who can interact with the agent via this channel.
  # Fields are mode-specific (see normative note below).
  access_control:
    mode: "allowlist"             # "open" | "allowlist" | "pairing" | "role-based"

    # For "allowlist" mode — REQUIRED, list of platform user IDs:
    allowed_ids:
      - "U01ABC123"
      - "U02DEF456"

    # For "pairing" mode — REQUIRED:
    # pairing:
    #   code_expiry_minutes: 30
    #   max_pending: 10

    # For "role-based" mode — REQUIRED, list of user-role assignments:
    # roles:
    #   - id: "U01ABC123"
    #     role: "admin"           # "admin" | "user" | "viewer"
    #   - id: "U02DEF456"
    #     role: "user"

  # OPTIONAL: Message processing configuration.
  processing:
    max_message_length: 4096
    rate_limit:
      messages_per_minute: 30
      burst: 5
    typing_indicator: true
    read_receipts: true

  # OPTIONAL: Feature flags for channel-specific capabilities.
  features:
    voice: false
    files: true
    reactions: true
    threads: true
    inline_images: true

  # OPTIONAL: Trigger settings for event-driven channels.
  # Applies to type: "cron" | "queue" | "imap" | "db-trigger"
  trigger:
    schedule: "0 */6 * * *"       # REQUIRED for type "cron"
    queue_name: "agent.events"    # REQUIRED for type "queue"
    mailbox: "INBOX"              # REQUIRED for type "imap"
    table: "orders"               # REQUIRED for type "db-trigger"
    events: ["INSERT", "UPDATE"] # OPTIONAL for type "db-trigger"
    max_parallel: 2               # OPTIONAL; default 1
    overlap_policy: "queue"       # OPTIONAL; "skip" | "queue" | "allow" (default "skip")
```

#### Access Control Modes

| Mode | Description | Required Field | Observed In |
|------|-------------|----------------|-------------|
| `open` | Any user on the platform can interact. | — | PicoClaw (default for personal use) |
| `allowlist` | Only pre-approved user IDs can interact. | `allowed_ids` | ZeroClaw, PicoClaw, ZeptoClaw |
| `pairing` | Unknown users receive an approval code; admin approves. | `pairing` | TinyClaw, OpenClaw |
| `role-based` | Users are assigned roles with different permissions. | `roles` | Moltis (WebAuthn + roles) |

> **Normative:** For `allowlist` mode, `allowed_ids` is REQUIRED and `roles` MUST NOT be present. For `role-based` mode, `roles` is REQUIRED and `allowed_ids` MUST NOT be present. For `pairing` mode, `pairing` is REQUIRED. Using the wrong field for a mode is a validation error.

#### Roles (for `role-based` mode)

| Role | Permissions |
|------|------------|
| `admin` | Full access: execute all tools/skills, approve actions, modify agent config via channel |
| `user` | Standard access: interact with agent, invoke skills, trigger tools (subject to Policy) |
| `viewer` | Read-only: can see agent responses but cannot trigger tools or skills |

#### Event-Driven Trigger Semantics

The `trigger` block defines how event-driven channels schedule or enqueue work.

| Field | Required | Description |
|------|----------|-------------|
| `schedule` | REQUIRED for `type: cron` | Cron expression for periodic execution. |
| `queue_name` | REQUIRED for `type: queue` | Queue/topic name to consume from. |
| `mailbox` | REQUIRED for `type: imap` | Mailbox name to watch. |
| `table` | REQUIRED for `type: db-trigger` | Database table to watch. |
| `events` | OPTIONAL for `type: db-trigger` | Event filters: `INSERT`, `UPDATE`, `DELETE`. |
| `max_parallel` | OPTIONAL | Max concurrent runs for this channel trigger. Default `1`. |
| `overlap_policy` | OPTIONAL | Behavior when new events arrive and concurrency is saturated: `skip`, `queue`, or `allow`. Default `skip`. |

> **Normative:** For Channel types `cron`, `queue`, `imap`, and `db-trigger`, runtimes SHOULD provide a `trigger` block. If `trigger.max_parallel` is omitted, runtimes MUST default it to `1`. If `trigger.overlap_policy` is omitted, runtimes MUST default it to `skip`. Runtimes MUST NOT exceed `max_parallel` concurrent trigger executions for a single Channel.

> **Design rationale:** The Channel primitive covers synchronous messaging channels and event-driven channels under one model, so scheduled and reactive execution does not require a separate primitive.

---

### 5.4 Tool

**URI:** `claw://local/tool/{name}` (alias: `claw://tool/{name}`)

The Tool primitive defines an executable function the agent can invoke. CKP Tools are a **strict superset** of MCP Tools — every MCP tool definition is a valid CKP tool, with additional fields for sandbox binding, policy binding, and lifecycle metadata.

#### Schema

```yaml
claw: "0.2.0"
kind: Tool
metadata:
  name: "web-fetch"
  version: "1.2.0"
  labels:
    category: "network"           # Used by Policy rules for category-based control
spec:
  # REQUIRED: Human-readable description (same as MCP tool.description).
  description: "Fetch content from a URL and return the response body"

  # REQUIRED: Input parameters (JSON Schema, same as MCP tool.inputSchema).
  input_schema:
    type: "object"
    properties:
      url:
        type: "string"
        format: "uri"
        description: "The URL to fetch"
      headers:
        type: "object"
        additionalProperties:
          type: "string"
        description: "Optional HTTP headers"
    required: ["url"]

  # OPTIONAL: Output schema (extension over MCP).
  output_schema:
    type: "object"
    properties:
      status_code:
        type: "integer"
      body:
        type: "string"
      content_type:
        type: "string"

  # OPTIONAL: Sandbox reference — which sandbox this tool executes in.
  sandbox_ref: "network-sandbox"

  # OPTIONAL: Policy reference — which policy governs this tool's execution.
  policy_ref: "network-policy"

  # OPTIONAL: MCP server source — if this tool is served by an MCP server.
  mcp_source:
    uri: "stdio:///usr/local/bin/web-fetch-server"
    # OR
    # uri: "https://mcp.example.com/web-fetch"

  # OPTIONAL: Annotations (same as MCP tool annotations, untrusted).
  annotations:
    readOnlyHint: false
    destructiveHint: false
    idempotentHint: true
    openWorldHint: true

  # OPTIONAL: Timeout for tool execution.
  timeout_ms: 30000

  # OPTIONAL: Retry configuration for transient failures.
  retry:
    max_attempts: 2
    backoff: "exponential"
```

#### MCP Compatibility

Any MCP tool can be referenced directly:

```yaml
claw: "0.2.0"
kind: Tool
metadata:
  name: "filesystem-read"
spec:
  mcp_source:
    uri: "stdio:///path/to/mcp-filesystem-server"
    tool_name: "read_file"        # Specific tool from the MCP server
  sandbox_ref: "fs-sandbox"
  policy_ref: "readonly-policy"
```

The runtime MUST:
1. Connect to the MCP server using standard MCP handshake
2. Map the CKP `sandbox_ref` and `policy_ref` as execution constraints
3. Proxy `tools/call` through the declared sandbox and policy

> **Normative:** The `mcp://` URI scheme is RESERVED and MUST NOT be used. MCP server references MUST use the `mcp_source` field with native MCP transport URIs (`stdio:///`, `https://`).

#### Validation Rules

- When `mcp_source` is **absent**, both `description` and `input_schema` are REQUIRED.
- When `mcp_source` is **present**, `description` and `input_schema` are OPTIONAL (the runtime MUST obtain them from the MCP server via `tools/list`).
- The `input_schema` field, when present, MUST be a valid JSON Schema object. The runtime MUST validate tool call arguments against it before execution; invalid arguments MUST be rejected with error code `-32602`.
- If `timeout_ms` is specified and the tool execution exceeds it, the runtime MUST terminate the execution and return error code `-32014`.

> **Design rationale:** The Tool primitive is a strict superset of MCP's tool definition. `input_schema` maps to MCP's `inputSchema`, `mcp_source` enables seamless bridging, and `sandbox_ref`/`policy_ref` bind security directly to tool definitions.

---

### 5.5 Skill

**URI:** `claw://local/skill/{name}` (alias: `claw://skill/{name}`)

The Skill primitive defines a **composed workflow** — a higher-order capability built from multiple tools, with natural-language instructions for the LLM to follow.

#### Schema

```yaml
claw: "0.2.0"
kind: Skill
metadata:
  name: "deep-research"
  version: "2.0.0"
  labels:
    domain: "research"
spec:
  # REQUIRED: Human-readable description of what this skill accomplishes.
  description: |
    Conduct deep research on a given topic by searching multiple sources,
    cross-referencing findings, and producing a structured report with
    citations and confidence assessments.

  # REQUIRED: Tools this skill needs to function.
  tools_required:
    - "web-search"
    - "web-fetch"
    - "file-write"
    - "file-read"

  # REQUIRED: Natural-language instructions for the LLM.
  # This is the core of the skill — it tells the LLM how to orchestrate the tools.
  instruction: |
    When the user requests deep research:
    1. Use web-search to find 5-10 relevant sources for the topic
    2. Use web-fetch to retrieve the content of each source
    3. Analyze and cross-reference the findings
    4. Identify areas of consensus and disagreement
    5. Use file-write to save the structured report
    6. Present a summary with confidence levels for each finding

    Always cite sources. Distinguish between primary research and commentary.
    If sources contradict each other, present both perspectives.

  # OPTIONAL: Input parameters the user provides when invoking this skill.
  input_schema:
    type: "object"
    properties:
      topic:
        type: "string"
        description: "The research topic"
      depth:
        type: "string"
        enum: ["quick", "standard", "exhaustive"]
        default: "standard"
        description: "How thorough the research should be"
      max_sources:
        type: "integer"
        default: 10
        description: "Maximum number of sources to consult"
    required: ["topic"]

  # OPTIONAL: Expected output structure.
  output_schema:
    type: "object"
    properties:
      summary:
        type: "string"
      findings:
        type: "array"
        items:
          type: "object"
          properties:
            claim: { type: "string" }
            confidence: { type: "number", minimum: 0, maximum: 1 }
            sources: { type: "array", items: { type: "string" } }
      report_path:
        type: "string"

  # OPTIONAL: Permission requirements for this skill.
  permissions:
    network: true                 # Needs network access
    filesystem: "write-workspace" # "none" | "read-only" | "write-workspace" | "full"
    approval_required: false      # Whether human approval is needed before execution

  # OPTIONAL: Estimated resource usage (informational).
  estimates:
    avg_tokens: 15000
    avg_duration_seconds: 120
    avg_tool_calls: 25
```

#### Skill vs Tool

| Dimension | Tool | Skill |
|-----------|------|-------|
| Granularity | Atomic function | Composed workflow |
| Execution | Single invocation, deterministic | Multi-step, LLM-guided |
| Instructions | Parameter schema only | Natural language + schema |
| Dependencies | Standalone | Requires other tools |
| MCP equivalent | `tools/call` | No MCP equivalent |

> **Design rationale:** The Skill primitive formalizes composed workflows with portable natural-language instructions. The `instruction` field travels with the skill definition, making skills reusable across runtimes. `permissions` enables security vetting before installation.

---

### 5.6 Memory

**URI:** `claw://local/memory/{name}` (alias: `claw://memory/{name}`)

The Memory primitive defines how the agent persists and retrieves information across sessions. It supports multiple storage backends and search strategies.

#### Schema

```yaml
claw: "0.2.0"
kind: Memory
metadata:
  name: "hybrid-memory"
  version: "1.0.0"
spec:
  # REQUIRED: At least one memory store.
  stores:
    # Conversation history — recent interactions.
    - name: "conversations"
      type: "conversation"        # "conversation" | "semantic" | "key-value" | "workspace"
      backend: "sqlite"           # "sqlite" | "postgresql" | "filesystem" | "custom"
      retention:
        max_age: "30d"            # Duration string
        max_entries: 10000
      compaction:
        enabled: true
        strategy: "summarize"     # "summarize" | "truncate" | "sliding-window"

    # Semantic memory — vector embeddings for knowledge retrieval.
    - name: "knowledge"
      type: "semantic"
      backend: "sqlite-vec"       # "sqlite-vec" | "pgvector" | "qdrant" | "custom"
      embedding:
        provider_ref: "embedding-provider"   # References a Provider primitive
        model: "text-embedding-3-small"
        dimensions: 1536
      search:
        strategy: "hybrid"        # "vector-only" | "fts-only" | "hybrid"
        fusion: "reciprocal-rank" # "reciprocal-rank" | "linear-combination"
        top_k: 10

    # Key-value store — persistent facts and preferences.
    - name: "facts"
      type: "key-value"
      backend: "sqlite"
      scope: "per-identity"       # "global" | "per-identity" | "per-channel"
      encryption: false

    # Workspace — file-based context for the agent's working directory.
    - name: "workspace"
      type: "workspace"
      path: "~/.claw/workspaces/{identity_name}/"
      isolation: "per-channel"    # "shared" | "per-identity" | "per-channel"
      max_size_mb: 500
```

Path values MAY contain template variables in `{variable}` syntax. The runtime MUST resolve these before filesystem access. Standard variables: `{identity_name}`, `{tenant_id}`.

#### Memory Types

| Type | Purpose | Query Pattern | Observed In |
|------|---------|---------------|-------------|
| `conversation` | Chat history, interaction logs | Sequential, time-based | All claws |
| `semantic` | Knowledge base, long-term facts | Vector similarity + full-text | IronClaw (pgvector+RRF), ZeroClaw (SQLite-vec), Moltis (hybrid) |
| `key-value` | Persistent settings, user preferences | Exact key lookup | ZeptoClaw, Clawlet |
| `workspace` | Files, documents, generated artifacts | Filesystem operations | TinyClaw, NanoClaw (per-group) |

> **Design rationale:** The Memory primitive supports four store types (conversation, semantic, key-value, workspace) with hybrid search and automatic compaction. The schema is backend-agnostic — from SQLite to PostgreSQL+pgvector.

---

### 5.7 Sandbox

**URI:** `claw://local/sandbox/{name}` (alias: `claw://sandbox/{name}`)

The Sandbox primitive defines the **execution environment** in which tools run. It controls isolation level, resource limits, network access, filesystem scope, and secret injection.

#### Schema

```yaml
claw: "0.2.0"
kind: Sandbox
metadata:
  name: "standard-sandbox"
  version: "1.0.0"
spec:
  # REQUIRED: Isolation level.
  level: "container"              # "none" | "process" | "wasm" | "container" | "vm"

  # OPTIONAL: Runtime implementation (level-dependent).
  runtime: "docker"               # "docker" | "apple-container" | "wasmtime"
                                  # | "firecracker" | "gvisor" | "native"

  # OPTIONAL: Capability grants for the sandbox.
  capabilities:
    network:
      mode: "allowlist"           # "deny" | "allowlist" | "allow-all"
      allowed_hosts:
        - "api.example.com"
        - "*.googleapis.com"
      ssrf_protection:
        enabled: true
        block_private_ips: true   # Blocks 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        dns_pinning: true         # Resolves DNS and checks against blocked ranges

    filesystem:
      mode: "scoped"              # "deny" | "read-only" | "scoped" | "full"
      mount_paths:
        - path: "/workspace"
          permissions: "rw"
        - path: "/config"
          permissions: "ro"
        - path: "/tmp"
          permissions: "rw"
      denied_paths:
        - "/etc/shadow"
        - "/root/.ssh"

    secrets:
      injection: "host-boundary"  # "host-boundary" | "environment" | "file-mount"
      encryption: "aes-256-gcm"
      leak_detection:
        enabled: true
        patterns: 22              # Number of secret patterns to scan for

    shell:
      mode: "restricted"          # "deny" | "restricted" | "full"
      blocked_commands:
        - "rm -rf /"
        - "curl * | bash"
        - "chmod 777"
      blocked_patterns:
        - ".*password.*=.*"       # Prevent secret assignment in commands
        - "\\|\\s*bash"           # Prevent pipe-to-bash
        - "eval\\s+"              # Prevent eval execution

  # OPTIONAL: Resource limits for the sandbox.
  resource_limits:
    memory_mb: 512
    cpu_shares: 256
    max_processes: 50
    max_open_files: 1024
    timeout_ms: 300000
    max_output_bytes: 10485760    # 10MB
```

Values in `blocked_patterns` are matched as regular expressions. Each pattern is tested against the full command string.

#### Isolation Levels

| Level | Mechanism | Overhead | Security | Observed In |
|-------|-----------|----------|----------|-------------|
| `none` | No isolation. Tool runs in agent process. | Zero | Minimal | PicoClaw (dev mode) |
| `process` | Separate OS process with limited permissions. | Low | Moderate | Clawlet (`create_subprocess_exec`) |
| `wasm` | WebAssembly sandbox with capability grants. | Low | High | IronClaw (wasmtime) |
| `container` | Docker/Apple Container with filesystem isolation. | Medium | High | NanoClaw, ZeptoClaw, Moltis |
| `vm` | Full virtual machine isolation. | High | Maximum | — (reserved for future) |

> **Design rationale:** The Sandbox primitive unifies five isolation levels (none, process, WASM, container, VM) with declarative resource limits, network controls, SSRF protection, and host-boundary secret injection.

---

### 5.8 Policy

**URI:** `claw://local/policy/{name}` (alias: `claw://policy/{name}`)

The Policy primitive defines **behavioral rules** — what the agent is allowed to do, what requires approval, and what is always denied. Policies bind to tools, skills, categories, or the entire agent.

#### Schema

```yaml
claw: "0.2.0"
kind: Policy
metadata:
  name: "standard-policy"
  version: "1.0.0"
spec:
  # REQUIRED: Ordered list of rules (first match wins).
  rules:
    # Deny destructive operations
    - id: "deny-destructive"
      action: "deny"
      scope: "tool"
      match:
        annotations:
          destructiveHint: true
      reason: "Destructive tools are blocked by default"

    # Require approval for network-accessing tools
    - id: "approve-network"
      action: "require-approval"
      scope: "category"
      match:
        category: "network"
      reason: "Network access requires human confirmation"
      approval:
        timeout_seconds: 300
        default_if_timeout: "deny"

    # Allow all read-only tools
    - id: "allow-readonly"
      action: "allow"
      scope: "tool"
      match:
        annotations:
          readOnlyHint: true

    # Allow workspace filesystem operations
    - id: "allow-workspace-fs"
      action: "allow"
      scope: "category"
      match:
        category: "filesystem"
      conditions:
        path_within: "/workspace"

    # Default: deny everything not explicitly allowed
    - id: "default-deny"
      action: "deny"
      scope: "all"
      reason: "Default deny policy"

  # OPTIONAL: Prompt injection defense configuration.
  prompt_injection:
    detection: "hybrid"           # "pattern" | "llm-based" | "hybrid" | "none"
    pattern_engine: "aho-corasick"
    pattern_count: 50
    action: "block-and-log"       # "block-and-log" | "warn" | "log-only" | "ignore"

  # OPTIONAL: Secret leak prevention.
  secret_scanning:
    enabled: true
    scope: "output"               # "input" | "output" | "both"
    patterns: 22                  # Number of built-in patterns (API keys, tokens, passwords)
    action: "redact"              # "redact" | "block" | "warn"

  # OPTIONAL: Input validation rules.
  input_validation:
    max_size_bytes: 102400        # 100KB
    null_byte_detection: true
    whitespace_analysis: true
    encoding: "utf-8"

  # OPTIONAL: Rate limiting at the policy level.
  rate_limits:
    tool_calls_per_minute: 30
    tokens_per_hour: 100000
    cost_per_day_usd: 10.00       # Hard spending cap

  # OPTIONAL: Audit logging configuration.
  audit:
    log_inputs: true
    log_outputs: true
    log_approvals: true
    retention: "90d"
    destination: "file"           # "file" | "sqlite" | "webhook" | "syslog"
```

#### Rule Actions

| Action | Behavior |
|--------|----------|
| `allow` | Execute without further checks |
| `deny` | Block execution, log the attempt |
| `require-approval` | Pause execution, present to human via Channel, wait for approval |
| `audit-only` | Allow execution but emit detailed audit event |

#### Validation Rules

- The `rules` array MUST contain at least one entry.
- Rules MUST be evaluated in array order. The first matching rule MUST be applied; subsequent rules MUST NOT be evaluated for that request.
- If no rule matches a given tool call, the runtime MUST deny the action (implicit default-deny).
- When multiple Policy primitives are referenced in a manifest, the runtime MUST evaluate them as a single concatenated rule list in the order they appear in the `policies` array (first policy's rules, then second policy's rules, etc.).
- For `require-approval`, if the approval timeout expires and `default_if_timeout` is `deny`, the runtime MUST deny the action with error code `-32012`.

> **Design rationale:** The Policy primitive uses a firewall-style first-match-wins rule engine with four actions (allow, deny, require-approval, audit-only). It integrates prompt injection detection, secret scanning, rate limiting, and spending caps into a single auditable declaration.

---

### 5.9 Swarm

**URI:** `claw://local/swarm/{name}` (alias: `claw://swarm/{name}`)

The Swarm primitive defines how multiple agents collaborate. It specifies topology, coordination mechanisms, and aggregation strategies.

#### Schema

```yaml
claw: "0.2.0"
kind: Swarm
metadata:
  name: "analysis-team"
  version: "1.0.0"
spec:
  # REQUIRED: Coordination topology.
  topology: "leader-worker"       # "leader-worker" | "peer-to-peer" | "pipeline"
                                  # | "broadcast" | "hierarchical"

  # REQUIRED: Participating agents.
  agents:
    - identity_ref: "lead-analyst"
      role: "leader"
      provider_ref: "high-quality-llm"
      count: 1
    - identity_ref: "data-collector"
      role: "worker"
      provider_ref: "fast-llm"
      count: 3
    - identity_ref: "fact-checker"
      role: "worker"
      provider_ref: "high-quality-llm"
      count: 1

  # REQUIRED: How agents exchange messages.
  coordination:
    message_passing: "queue"      # "queue" | "shared-memory" | "event-bus" | "direct"
    backend: "sqlite-wal"         # "sqlite-wal" | "redis" | "nats" | "in-process"
    concurrency:
      max_parallel: 4
      sequential_within_agent: true  # Ensures conversation coherence per agent

  # REQUIRED: How results are combined.
  aggregation:
    strategy: "leader-decides"    # "leader-decides" | "majority-vote" | "merge"
                                  # | "chain" | "best-of-n"
    cost_aware: true              # Route to cheapest capable provider when possible
    timeout_ms: 600000            # 10 minutes for the entire swarm operation

  # OPTIONAL: Failure handling.
  failure:
    retry_per_agent: 2
    dead_letter:
      enabled: true
      max_retries: 5
    circuit_breaker:
      failure_threshold: 3
      reset_timeout_ms: 60000

  # OPTIONAL: Resource boundaries for the swarm.
  resource_limits:
    max_total_tokens: 1000000
    max_total_cost_usd: 5.00
    max_duration_ms: 1800000      # 30 minutes
```

#### Topologies

```
Leader-Worker:              Pipeline:                Peer-to-Peer:
  ┌──────┐                  ┌───┐  ┌───┐  ┌───┐      ┌───┐
  │Leader│                  │ A ├──► B ├──► C │      │ A ◄──► B │
  └──┬───┘                  └───┘  └───┘  └───┘      │   ▲     │
  ┌──┼──┐                                             │   │     │
  ▼  ▼  ▼                                             └───►  C  │
┌─┐┌─┐┌─┐                                                └─────┘
│W││W││W│
└─┘└─┘└─┘

Broadcast:                  Hierarchical:
  ┌──────┐                    ┌──────┐
  │Source│                    │ Root │
  └──┬───┘                    └──┬───┘
  ┌──┼──┐                    ┌──┼──┐
  ▼  ▼  ▼                    ▼     ▼
┌─┐┌─┐┌─┐              ┌────┐   ┌────┐
│A││B││C│              │Sub1│   │Sub2│
└─┘└─┘└─┘              └──┬─┘   └──┬─┘
                        ┌──┼─┐   ┌──┼─┐
                        ▼  ▼     ▼  ▼
                       ┌┐┌┐    ┌┐┌┐
                       │││     │││
                       └┘└┘    └┘└┘
```

> **Design rationale:** The Swarm primitive supports five topologies (leader-worker, peer-to-peer, hierarchical, pipeline, broadcast) with coordination controls for parallelism, task sequencing, dead letter queues, and circuit breakers.

---

### 5.10 Telemetry

**URI:** `claw://local/telemetry/{name}` (alias: `claw://telemetry/{name}`)

The Telemetry primitive defines how agent behavior is observed, measured, and exported for analysis. It specifies exporters, event categories, metrics collection, sampling rates, and data redaction rules. Telemetry is **OPTIONAL at all conformance levels** and MUST NOT affect core agent functionality — an agent without Telemetry configured MUST behave identically to one with it.

#### Schema

```yaml
claw: "0.2.0"
kind: Telemetry
metadata:
  name: "observability"
  version: "1.0.0"
spec:
  # REQUIRED: At least one exporter destination.
  exporters:
    # OpenTelemetry-compatible backend (Datadog, Jaeger, Grafana, etc.)
    - type: "otlp"                   # "otlp" | "file" | "sqlite" | "webhook" | "console"
      endpoint: "https://otel-collector.internal:4318/v1/traces"
      auth:
        secret_ref: "OTEL_API_KEY"
      batch:
        max_size: 1000               # Events per batch (default: implementation-defined)
        flush_interval_ms: 5000      # Flush interval in ms (default: implementation-defined)

    # Local file exporter for offline environments
    - type: "file"
      path: "/var/log/agent/telemetry.jsonl"

  # OPTIONAL: Which event categories to emit (defaults shown).
  events:
    tool_calls: true                 # Tool invocations (name, duration_ms, status, error code)
    memory_ops: false                # Memory store/query/compact operations
    swarm_ops: false                 # Swarm delegate/discover/report operations
    lifecycle: true                  # Lifecycle transitions (INIT → READY → STOPPED)
    errors: true                     # All error responses

  # OPTIONAL: Which metrics to collect (defaults shown).
  metrics:
    token_usage: true                # Input/output token counts per provider call
    cost_usd: false                  # Estimated cost per operation in USD
    latency_histogram: true          # Latency histograms for tool calls and provider requests

  # OPTIONAL: Sampling configuration.
  sampling:
    rate: 1.0                        # 0.0 = off, 1.0 = all events (default: 1.0)

  # OPTIONAL: Data redaction settings.
  redaction:
    strip_arguments: false           # If true, tool call arguments are redacted from events
    strip_results: false             # If true, tool call results are redacted from events
```

#### Exporter Types

| Type | Backend | Required Fields | Use Case |
|------|---------|----------------|----------|
| `otlp` | OpenTelemetry Collector | `endpoint` | Production — Datadog, Jaeger, Grafana Tempo |
| `file` | JSONL log file | `path` | Offline environments, local debugging |
| `sqlite` | SQLite database | `path` | Embedded devices, queryable local storage |
| `webhook` | HTTP POST endpoint | `endpoint` | Custom integrations, alerting systems |
| `console` | stdout/stderr | — | Development, CI pipelines |

#### Event Categories

| Category | Description | Default | Emitted When |
|----------|-------------|---------|-------------|
| `tool_calls` | Tool invocation details | `true` | Every `claw.tool.call` (name, duration, status, error code) |
| `memory_ops` | Memory operation details | `false` | Every `claw.memory.store`, `query`, `compact` |
| `swarm_ops` | Swarm coordination details | `false` | Every `claw.swarm.delegate`, `discover`, `report` |
| `lifecycle` | State machine transitions | `true` | Every lifecycle state change (INIT → READY, etc.) |
| `errors` | Error response details | `true` | Every JSON-RPC error response |

#### Validation Rules

- The `exporters` array MUST contain at least one entry.
- For exporter `type: "otlp"` or `type: "webhook"`, the `endpoint` field is REQUIRED. If omitted, the runtime MUST reject the manifest.
- For exporter `type: "file"` or `type: "sqlite"`, the `path` field is REQUIRED. If omitted, the runtime MUST reject the manifest.
- The `sampling.rate` field MUST be a number in the range `0.0` to `1.0` inclusive. Values outside this range MUST be rejected.
- The runtime MUST NEVER emit raw prompts, Chain-of-Thought (CoT) content, or provider response bodies in telemetry events, regardless of `redaction` settings. This is a security invariant.
- When `redaction.strip_arguments` is `true`, tool call arguments MUST be replaced with a placeholder (e.g., `"[REDACTED]"`) in emitted events.

> **Design rationale:** The Telemetry primitive satisfies Design Principle P7 (Auditable) by providing declarative, structured observability without requiring code changes in the agent. It supports five exporter types covering production (OTLP), offline (file/sqlite), integration (webhook), and development (console) scenarios. Telemetry is intentionally OPTIONAL at all conformance levels — observability should enhance, never gate, agent deployment. No JSON-RPC methods are defined for Telemetry because it is emit-only: the agent produces events unidirectionally to configured exporters.

---

## 6. Claw Manifest

The **Claw Manifest** (`claw.yaml`) is the root document that composes all primitives into a complete agent definition.

```yaml
# claw.yaml — The root manifest
claw: "0.2.0"
kind: Claw
metadata:
  name: "my-assistant"
  version: "1.0.0"
  description: "A general-purpose AI assistant"
spec:
  # REQUIRED
  identity: "./identity.yaml"

  # REQUIRED (at least one)
  providers:
    - "./providers/primary.yaml"
    - "./providers/local-fallback.yaml"

  # OPTIONAL
  channels:
    - "./channels/telegram.yaml"
    - "./channels/slack.yaml"
    - "./channels/cli.yaml"

  # OPTIONAL — can reference local files, registry URIs, or inline MCP bridges
  tools:
    - "./tools/*.yaml"                              # Local glob
    - "claw://registry/standard-tools/shell@1.0.0"    # Registry reference
    - inline:                                        # MCP server bridge
        name: "mcp-github"
        mcp_source:
          uri: "stdio:///path/to/mcp-server"

  skills:
    - "./skills/*.yaml"
    - "claw://registry/community-skills/deep-research@2.0.0"

  memory: "./memory.yaml"

  sandbox: "./sandbox.yaml"

  policies:
    - "./policies/security.yaml"
    - "./policies/spending.yaml"

  swarm: "./swarm.yaml"           # Optional — only for multi-agent configurations

  telemetry: "./telemetry.yaml"  # Optional — observability (valid at all levels)
```

### Minimal Valid Manifest

The smallest possible valid Claw:

```yaml
claw: "0.2.0"
kind: Claw
metadata:
  name: "minimal-bot"
spec:
  identity:
    inline:
      personality: "You are a helpful assistant."
      autonomy: "observer"
  providers:
    - inline:
        protocol: "openai-compatible"
        endpoint: "http://localhost:11434/v1"
        model: "llama3"
        auth:
          type: "none"
```

This creates a read-only assistant using a local Ollama instance with no tools, no channels, and maximum security restrictions.

#### Manifest Validation Rules

- A valid Claw manifest MUST have `kind: Claw`.
- The `spec.identity` field is REQUIRED.
- The `spec.providers` field is REQUIRED and MUST contain at least one entry.
- File path references (e.g., `"./identity.yaml"`) MUST be resolved relative to the manifest file's directory.
- Glob patterns (e.g., `"./tools/*.yaml"`) MUST be expanded by the runtime at manifest load time.
- If a referenced file does not exist, the runtime MUST reject the manifest with a descriptive error.

### 6.1 Inline Primitives

Primitives MAY be declared inline within the manifest using the `inline:` key instead of a file path. Inline primitives follow the same `spec:` schema as file-based primitives.

**Required fields per kind when used inline:**

| Kind | Required Fields |
|------|----------------|
| Identity | `personality` |
| Provider | `protocol`, `endpoint`, `model`, `auth` |
| Channel | `type`, `transport`, `auth` |
| Tool | (`description` + `input_schema`) OR `mcp_source` |
| Skill | `description`, `tools_required`, `instruction` |
| Memory | `stores` (at least one entry) |
| Sandbox | `level` |
| Policy | `rules` (at least one entry) |
| Swarm | `topology`, `agents`, `coordination`, `aggregation` |
| Telemetry | `exporters` (at least one entry) |

> **Normative:** `metadata.name` SHOULD be provided in inline primitives. If omitted, the runtime MAY generate a name. `metadata.version` defaults to the parent Claw manifest `metadata.version` when omitted.

---

## 7. URI Scheme

CKP uses the `claw://` URI scheme for addressing primitives. Two canonical forms are defined:

```
Canonical (local):    claw://local/{kind}/{name}
                      claw://local/{kind}/{name}@{version}

Canonical (registry): claw://registry/{namespace}/{name}@{version}

Alias (manifest-only): claw://{kind}/{name}
                        → resolved to: claw://local/{kind}/{name}
```

> **Normative:** Manifests MAY use the alias form (`claw://{kind}/{name}`) for developer ergonomics. Runtimes MUST resolve alias URIs to their canonical `claw://local/` form before processing. Protocol wire messages (JSON-RPC) MUST use only canonical forms. Registry URIs MUST always include the `@{version}` suffix.

### Formal Grammar (ABNF, RFC 5234)

```abnf
claw-uri      = claw-local / claw-registry
claw-local    = "claw://local/" kind "/" name [ "@" version ]
claw-registry = "claw://registry/" namespace "/" name "@" version
kind          = "identity" / "provider" / "channel" / "tool"
              / "skill" / "memory" / "sandbox" / "policy" / "swarm"
name          = 1*63( ALPHA / DIGIT / "-" )
namespace     = 1*63( ALPHA / DIGIT / "-" / "." )
version       = semver
semver        = 1*DIGIT "." 1*DIGIT "." 1*DIGIT [ "-" pre-release ]
pre-release   = 1*( ALPHA / DIGIT / "-" / "." )

; Alias form (manifest-only, resolved before wire transmission)
claw-alias    = "claw://" kind "/" name
```

URIs that do not conform to this grammar MUST be rejected by the runtime.

> The kind value `Claw` (used in root manifests for the top-level `kind: Claw` declaration) is not a URI-addressable primitive and is therefore excluded from the URI grammar.

### Examples

| URI (canonical) | Alias (manifest-only) | Meaning |
|-----|---------|---------|
| `claw://local/identity/research-assistant` | `claw://identity/research-assistant` | Local identity |
| `claw://local/tool/web-fetch@1.2.0` | `claw://tool/web-fetch` | Local tool (alias omits version) |
| `claw://registry/community-skills/deep-research@2.0.0` | — (no alias for registry) | Skill from a public registry |
| `claw://local/swarm/analysis-team` | `claw://swarm/analysis-team` | Swarm configuration |
| `claw://local/sandbox/container-sandbox` | `claw://sandbox/container-sandbox` | Sandbox definition |
| `claw://local/policy/security-policy` | `claw://policy/security-policy` | Policy definition |

### Registry Resolution

When a URI uses `registry` as the authority, the runtime resolves it against configured registries:

```yaml
# In runtime configuration (not part of the protocol)
registries:
  - name: "default"
    url: "https://registry.clawkernel.dev/v1"   # placeholder — no public registry exists yet
  - name: "company"
    url: "https://claw-registry.internal.example.com/v1"
```

---

## 8. Lifecycle

A Claw agent follows a well-defined lifecycle:

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│  INIT   ├────►│ STARTING ├────►│  READY  ├────►│ STOPPING ├────►│ STOPPED  │
└─────────┘     └──────────┘     └────┬────┘     └──────────┘     └──────────┘
                                      │
                                      ▼
                                 ┌─────────┐
                                 │  ERROR  │
                                 └─────────┘
```

### Phases

#### INIT
1. Parse and validate `claw.yaml` manifest
2. Resolve all manifest file references and registry URIs
3. Validate primitive schemas
4. Check compatibility between primitives (e.g., tools referenced by skills exist)

#### STARTING
1. Initialize Memory stores (connect to backends, run migrations if needed)
2. Connect to Provider endpoints (validate auth, check model availability)
3. Start Sandbox runtimes (pull container images, initialize WASM engines)
4. Open Channel connections (authenticate with platforms, start polling/webhooks)
5. Load Policy rules into the evaluation engine
6. If Swarm is configured, discover and connect to peer agents

#### READY
1. Agent loop begins: receive messages from Channels, reason with Provider, execute Tools/Skills within Sandbox constraints, governed by Policy
2. Memory is read/written continuously
3. Swarm coordination is active (if configured)

#### STOPPING
1. Drain in-flight tool executions (with configurable timeout)
2. Close Channel connections gracefully
3. Flush Memory writes
4. Stop Sandbox runtimes
5. Disconnect from Providers

#### ERROR
1. Log error details to configured audit destination
2. Attempt recovery based on Policy (retry, circuit breaker)
3. If unrecoverable, transition to STOPPING

### Lifecycle Events

Runtimes SHOULD emit structured events at each transition:

```json
{
  "claw": "0.2.0",
  "event": "lifecycle.transition",
  "timestamp": "2026-02-22T10:30:00Z",
  "agent": "my-assistant",
  "from": "STARTING",
  "to": "READY",
  "duration_ms": 2340,
  "details": {
    "providers_connected": 2,
    "channels_opened": 3,
    "tools_loaded": 15,
    "skills_loaded": 5,
    "memory_stores_initialized": 4
  }
}
```

---

## 9. Transport & Wire Format

### 9.0 Actor Model

CKP defines a closed vocabulary of five actors. Every JSON-RPC method MUST declare its direction using exactly two of these actors.

| Actor | Definition |
|-------|-----------|
| **Operator** | Human or automation managing the agent lifecycle (start, stop, configure) |
| **User** | Human interacting with the agent via a Channel |
| **Agent** | The Claw runtime instance executing the agent loop |
| **Peer** | Another Agent participating in a Swarm |
| **Service** | External system: MCP server, memory backend, registry, sandbox runtime |

> **Normative:** Protocol messages MUST NOT use ad-hoc actor names. All method directions in this specification use only the five actors defined above.

### 9.1 JSON-RPC 2.0

Like MCP, CKP uses JSON-RPC 2.0 as its wire format for communication between Agents and other actors (Operators, Users, Peers, Services).

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "claw.tool.call",
  "params": {
    "name": "web-fetch",
    "arguments": {
      "url": "https://example.com/data.json"
    },
    "context": {
      "identity": "research-assistant",
      "sandbox": "network-sandbox",
      "policy": "standard-policy",
      "request_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### 9.2 Supported Transports

| Transport | Use Case | MCP Compatible |
|-----------|----------|----------------|
| stdio | Local process communication | Yes |
| HTTP/SSE (Streamable HTTP) | Remote agents, registries | Yes |
| WebSocket | Real-time bidirectional (swarm coordination) | Extension |
| Message Queue (NATS, Redis) | Distributed swarms | Extension |
| Filesystem | Container IPC (container IPC pattern) | Extension |

### 9.3 Methods

| Method | Direction | Type | Purpose |
|--------|-----------|------|---------|
| `claw.initialize` | Operator → Agent | Request | Start agent with manifest |
| `claw.initialized` | Operator → Agent | Notification | Confirm handshake complete |
| `claw.status` | Operator → Agent | Request | Query agent lifecycle state |
| `claw.shutdown` | Operator → Agent | Request | Graceful shutdown |
| `claw.heartbeat` | Agent → Operator | Notification | Proactive liveness signal |
| `claw.tool.call` | Agent → Service | Request | Execute a tool |
| `claw.tool.approve` | User → Agent | Request | Approve a pending tool execution |
| `claw.tool.deny` | User → Agent | Request | Deny a pending tool execution |
| `claw.swarm.delegate` | Agent → Peer | Request | Assign a task to a peer agent |
| `claw.swarm.report` | Peer → Agent | Request | Return task results |
| `claw.swarm.broadcast` | Agent → Peer* | Notification | Send message to all peers |
| `claw.swarm.discover` | Agent → Service | Request | Find available peers |
| `claw.memory.query` | Agent → Service | Request | Search memory stores |
| `claw.memory.store` | Agent → Service | Request | Persist information |
| `claw.memory.compact` | Agent → Service | Request | Trigger memory compaction |

#### 9.3.1 Agent Management

##### `claw.initialize`

**Direction:** Operator → Agent | **Type:** Request

The Operator MUST send `claw.initialize` as the first message in a session. The Agent MUST NOT process any other method before responding to `claw.initialize`.

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "claw.initialize",
  "params": {
    "protocolVersion": "0.2.0",
    "clientInfo": {
      "name": "my-operator",
      "version": "1.0.0"
    },
    "manifest": {
      "kind": "Claw",
      "metadata": { "name": "research-assistant" },
      "spec": { "identity": "./identity.yaml", "providers": ["./provider.yaml"] }
    },
    "capabilities": {
      "tools": {},
      "swarm": {},
      "memory": {}
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `protocolVersion` | REQUIRED | Semver string. The highest protocol version the Operator supports. |
| `clientInfo.name` | REQUIRED | Operator implementation name. |
| `clientInfo.version` | REQUIRED | Operator implementation version. |
| `manifest` | REQUIRED | Inline Claw manifest object or a `claw://` URI referencing one. |
| `capabilities` | REQUIRED | Object declaring which primitive groups the Operator supports. Keys are `tools`, `swarm`, `memory`. An empty object `{}` means the group is supported with default behavior. Omitting a key means the group is not supported. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "0.2.0",
    "agentInfo": {
      "name": "research-assistant",
      "version": "1.0.0"
    },
    "conformanceLevel": "level-2",
    "capabilities": {
      "tools": {},
      "swarm": {},
      "memory": {}
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `protocolVersion` | REQUIRED | The protocol version the Agent will use for this session. MUST be equal to or lower than the requested version. |
| `agentInfo.name` | REQUIRED | From the Identity primitive. |
| `agentInfo.version` | REQUIRED | From the manifest `metadata.version`. |
| `conformanceLevel` | REQUIRED | One of `level-1`, `level-2`, `level-3`. |
| `capabilities` | REQUIRED | Capabilities the Agent actually supports (intersection of what was requested and what the runtime implements). |

If the Agent does not support the requested `protocolVersion`, it MUST respond with error code `-32001` and include the versions it supports:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Protocol version not supported",
    "data": { "supported": ["0.2.0"] }
  }
}
```

##### `claw.initialized`

**Direction:** Operator → Agent | **Type:** Notification

After receiving a successful `claw.initialize` response, the Operator SHOULD send `claw.initialized` to signal that it has processed the Agent's capabilities.

```json
{
  "jsonrpc": "2.0",
  "method": "claw.initialized"
}
```

No params. No response (notification).

##### `claw.status`

**Direction:** Operator → Agent | **Type:** Request

**Request params:** `{}` (empty object)

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "state": "READY",
    "uptime_ms": 45000
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `state` | REQUIRED | One of `INIT`, `STARTING`, `READY`, `STOPPING`, `STOPPED`, `ERROR`. |
| `uptime_ms` | REQUIRED | Milliseconds since initialization completed. |

The Agent MUST return the current lifecycle state as defined in Section 8.

##### `claw.shutdown`

**Direction:** Operator → Agent | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "claw.shutdown",
  "params": {
    "reason": "operator-requested",
    "timeout_ms": 30000
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `reason` | OPTIONAL | Human-readable reason for shutdown. |
| `timeout_ms` | OPTIONAL | Maximum time to drain in-flight operations. Default is implementation-defined. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "drained": true
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `drained` | REQUIRED | `true` if all in-flight operations completed before timeout. |

Upon receiving `claw.shutdown`, the Agent MUST transition to STOPPING state and attempt to drain in-flight operations.

##### `claw.heartbeat`

**Direction:** Agent → Operator | **Type:** Notification

The Agent SHOULD emit `claw.heartbeat` notifications at a regular interval while in the `READY` state. The interval is configured in the manifest or defaults to 30 seconds. This enables Operators to detect unresponsive agents without polling.

```json
{
  "jsonrpc": "2.0",
  "method": "claw.heartbeat",
  "params": {
    "state": "READY",
    "uptime_ms": 120000,
    "timestamp": "2026-02-22T10:32:00Z"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `state` | REQUIRED | Current lifecycle state (same values as `claw.status`). |
| `uptime_ms` | REQUIRED | Milliseconds since initialization completed. |
| `timestamp` | REQUIRED | ISO 8601 UTC timestamp of this heartbeat. |

No response (notification). If the Operator does not receive a heartbeat within `2 × interval`, it SHOULD consider the Agent potentially unresponsive and MAY invoke `claw.status` to confirm.

> **Normative:** The default heartbeat interval is 30 seconds. Implementations MAY allow configuration via a `heartbeat_interval_ms` field in the manifest's `metadata.annotations`. The Agent MUST NOT emit heartbeats before `claw.initialize` completes or after entering the `STOPPING` state.

#### 9.3.2 Tool Execution

##### `claw.tool.call`

**Direction:** Agent → Service | **Type:** Request

The Agent MUST include a `request_id` for idempotency. The runtime MUST validate arguments against the tool's `input_schema` before execution.

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "claw.tool.call",
  "params": {
    "name": "web-fetch",
    "arguments": {
      "url": "https://example.com/data.json"
    },
    "context": {
      "request_id": "550e8400-e29b-41d4-a716-446655440000",
      "identity": "research-assistant",
      "sandbox": "network-sandbox",
      "policy": "standard-policy"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | REQUIRED | Tool name as declared in the manifest. |
| `arguments` | REQUIRED | Tool input matching the tool's `input_schema`. |
| `context.request_id` | REQUIRED | UUID for idempotency and tracing. |
| `context.identity` | REQUIRED | Name of the calling agent's Identity. |
| `context.sandbox` | OPTIONAL | Sandbox reference override. |
| `context.policy` | OPTIONAL | Policy reference override. |

**Response result (success):**

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "content": [
      { "type": "text", "text": "Fetched 2,340 bytes from example.com" }
    ],
    "isError": false
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `content` | REQUIRED | Array of content blocks. Implementations MUST support the `text` type. |
| `content[].type` | REQUIRED | One of `text`, `image`, `resource`. |
| `isError` | OPTIONAL | `true` if the tool executed but returned an error result. Default `false`. |

The `content` array uses the MCP-compatible content block format.

##### `claw.tool.approve`

**Direction:** User → Agent | **Type:** Request

When a Policy rule evaluates to `require-approval`, the Agent MUST NOT execute the tool until it receives `claw.tool.approve` or `claw.tool.deny`, or the approval timeout expires.

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "claw.tool.approve",
  "params": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "Approved by project lead"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `request_id` | REQUIRED | The `request_id` of the pending `claw.tool.call`. |
| `reason` | OPTIONAL | Human-provided rationale. |

**Response result:**

```json
{ "jsonrpc": "2.0", "id": 4, "result": { "acknowledged": true } }
```

##### `claw.tool.deny`

**Direction:** User → Agent | **Type:** Request

The User explicitly denies a pending tool execution. The Agent MUST NOT execute the tool and MUST return error code `-32013` to the original `claw.tool.call` caller.

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "claw.tool.deny",
  "params": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "Operation not authorized for this environment"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `request_id` | REQUIRED | The `request_id` of the pending `claw.tool.call`. |
| `reason` | OPTIONAL | Human-provided rationale for denial. |

**Response result:**

```json
{ "jsonrpc": "2.0", "id": 5, "result": { "acknowledged": true } }
```

#### 9.3.3 Swarm Coordination

##### `claw.swarm.delegate`

**Direction:** Agent → Peer | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "claw.swarm.delegate",
  "params": {
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "task": {
      "description": "Analyze quarterly revenue data",
      "input": { "dataset_uri": "claw://local/memory/revenue-data" }
    },
    "context": {
      "request_id": "f0e1d2c3-b4a5-6789-0abc-def012345678",
      "swarm": "analysis-team"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `task_id` | REQUIRED | UUID identifying this task. |
| `task.description` | REQUIRED | Natural-language description of the task. |
| `task.input` | OPTIONAL | Structured input for the task. |
| `context.request_id` | REQUIRED | UUID for tracing. |
| `context.swarm` | REQUIRED | Swarm name this delegation belongs to. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "acknowledged": true
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `acknowledged` | REQUIRED | `true` if the delegation request was accepted for processing. |

##### `claw.swarm.report`

**Direction:** Peer → Agent | **Type:** Request (response to a delegation)

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "claw.swarm.report",
  "params": {
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "result": { "summary": "Revenue grew 12% QoQ" },
    "token_usage": 4200,
    "duration_ms": 15000
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `task_id` | REQUIRED | The `task_id` from the original `claw.swarm.delegate`. |
| `status` | REQUIRED | One of `completed`, `failed`, `partial`. |
| `result` | REQUIRED | Task output (structure is task-defined). |
| `token_usage` | OPTIONAL | Total tokens consumed. |
| `duration_ms` | OPTIONAL | Wall-clock execution time. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "acknowledged": true
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `acknowledged` | REQUIRED | `true` if the report was received and recorded by the Agent. |

##### `claw.swarm.broadcast`

**Direction:** Agent → Peer* | **Type:** Notification

```json
{
  "jsonrpc": "2.0",
  "method": "claw.swarm.broadcast",
  "params": {
    "swarm": "analysis-team",
    "message": { "type": "context-update", "data": "New dataset available" }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `swarm` | REQUIRED | Target swarm name. |
| `message` | REQUIRED | Payload delivered to all peers. Structure is application-defined. |

No response (notification). Delivery semantics are transport-dependent (see Runtime Profile).

##### `claw.swarm.discover`

**Direction:** Agent → Service | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "claw.swarm.discover",
  "params": {
    "swarm": "analysis-team"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `swarm` | OPTIONAL | Filter by swarm name. If omitted, return all known peers. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "peers": [
      {
        "identity": "data-analyst",
        "uri": "claw://local/identity/data-analyst",
        "status": "ready"
      }
    ]
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `peers` | REQUIRED | Array of discovered peers. |
| `peers[].identity` | REQUIRED | Peer's Identity name. |
| `peers[].uri` | REQUIRED | Peer's `claw://` URI. |
| `peers[].status` | REQUIRED | One of `ready`, `busy`, `unavailable`. |

#### 9.3.4 Memory Operations

##### `claw.memory.query`

**Direction:** Agent → Service | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "claw.memory.query",
  "params": {
    "store": "project-context",
    "query": {
      "type": "semantic",
      "text": "revenue projections Q4",
      "top_k": 5
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `store` | REQUIRED | Store name from the Memory primitive. |
| `query.type` | REQUIRED | One of `semantic`, `key`, `time-range`. |
| `query.text` | REQUIRED for `semantic` | Natural-language query text. |
| `query.key` | REQUIRED for `key` | Exact key to look up. |
| `query.time_range` | REQUIRED for `time-range` | Object with `from` and `to` (ISO 8601). |
| `query.top_k` | OPTIONAL | Maximum entries to return. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "entries": [
      {
        "id": "entry-001",
        "content": "Q4 revenue projected at $2.1M based on current pipeline",
        "score": 0.92,
        "timestamp": "2026-02-20T14:30:00Z"
      }
    ]
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `entries` | REQUIRED | Array of matching entries. |
| `entries[].id` | REQUIRED | Entry identifier. |
| `entries[].content` | REQUIRED | Entry content (string or object). |
| `entries[].score` | OPTIONAL | Relevance score (0.0–1.0) for semantic queries. |
| `entries[].timestamp` | OPTIONAL | ISO 8601 timestamp. |

##### `claw.memory.store`

**Direction:** Agent → Service | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "claw.memory.store",
  "params": {
    "store": "project-context",
    "entries": [
      {
        "content": "Meeting with stakeholders confirmed for March 1",
        "metadata": { "source": "calendar-tool" }
      }
    ],
    "context": {
      "request_id": "b2c3d4e5-f6a7-8901-bcde-f01234567890"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `store` | REQUIRED | Target store name. |
| `entries` | REQUIRED | Array of entries to persist. |
| `entries[].content` | REQUIRED | Entry content (string or object). |
| `entries[].key` | OPTIONAL | Key for key-value stores. |
| `entries[].metadata` | OPTIONAL | Arbitrary metadata. |
| `context.request_id` | REQUIRED | UUID for idempotency. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "stored": 1,
    "ids": ["entry-042"]
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `stored` | REQUIRED | Count of entries successfully persisted. |
| `ids` | REQUIRED | Assigned entry identifiers. |

##### `claw.memory.compact`

**Direction:** Agent → Service | **Type:** Request

**Request params:**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "claw.memory.compact",
  "params": {
    "store": "conversation-history"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `store` | REQUIRED | Store to compact. |

**Response result:**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "entries_before": 1200,
    "entries_after": 450
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `entries_before` | REQUIRED | Entry count before compaction. |
| `entries_after` | REQUIRED | Entry count after compaction. |

### 9.4 Error Codes

Implementations MUST use the following error codes in JSON-RPC error responses. Error codes in the range `[-32000, -32099]` are reserved for CKP-specific errors. Implementations MUST NOT use codes in this range for custom purposes.

| Code | Name | Meaning |
|------|------|---------|
| `-32700` | Parse error | Invalid JSON received |
| `-32600` | Invalid request | Malformed JSON-RPC structure |
| `-32601` | Method not found | Unknown method name |
| `-32602` | Invalid params | Params do not match method schema |
| `-32001` | Protocol version not supported | `claw.initialize` version mismatch |
| `-32010` | Sandbox denied | Tool execution blocked by Sandbox constraints |
| `-32011` | Policy denied | Tool execution blocked by Policy rule |
| `-32012` | Approval timeout | User did not approve within the configured timeout |
| `-32013` | Approval denied | User explicitly denied the tool execution |
| `-32014` | Tool execution timeout | Tool exceeded its configured `timeout_ms` |
| `-32021` | Provider quota exceeded | Token or cost limit for the provider has been reached |

Error responses MUST include a `message` field with a human-readable description. Error responses SHOULD include a `data` field with structured context:

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32011,
    "message": "Policy denied: rule sec-003 blocks destructive file operations",
    "data": {
      "rule_id": "sec-003",
      "tool": "file-delete",
      "action": "deny"
    }
  }
}
```

> The extended error catalog (provider errors, memory errors, swarm errors) and retry semantics are defined in the companion **Runtime Profile** document.

---

## 10. Security Model

### 10.1 Defense-in-Depth

CKP's security model layers multiple defense mechanisms, each corresponding to a primitive:

```
Layer 1: Channel    ── Access control (who can talk to the agent)
Layer 2: Policy     ── Rule engine (what the agent is allowed to do)
Layer 3: Sandbox    ── Execution isolation (where tools run)
Layer 4: Provider   ── Token governance (how much the agent can spend)
Layer 5: Memory     ── Data scoping (what the agent can remember and retrieve)
Layer 6: Swarm      ── Trust boundaries (which agents can coordinate)
Layer 7: Identity   ── Autonomy level (how much freedom the agent has)
```

### 10.2 Threat Model

| Threat | Mitigation Primitive | Mechanism |
|--------|---------------------|-----------|
| Unauthorized human access | Channel | Allowlists, pairing codes, role-based access |
| Prompt injection | Policy | Pattern detection (Aho-Corasick), LLM-based semantic analysis |
| Secret exfiltration | Sandbox + Policy | Host-boundary injection, leak scanning, output filtering |
| SSRF attacks | Sandbox | DNS pinning, private IP blocking, host allowlists |
| Destructive tool execution | Policy | Annotation-based blocking, approval gates |
| Cost runaway | Provider + Policy | Daily token limits, per-request caps, spending thresholds |
| Cross-agent contamination | Swarm + Memory | Scoped memory, per-agent isolation, trust boundaries |
| Supply chain (malicious skills) | Skill + Policy | Permission declarations, sandboxed execution, audit logging |
| Privilege escalation | Sandbox | Container/WASM isolation, filesystem scoping, process limits |

### 10.3 Trust Hierarchy

```
Human (highest trust)
  └── Channel (authenticated communication)
        └── Identity (declared autonomy level)
              └── Policy (behavioral rules)
                    └── Sandbox (execution constraints)
                          └── Tool (atomic capability)
```

Each layer can only grant permissions that its parent allows. A Tool cannot exceed its Sandbox constraints. A Sandbox cannot override Policy rules. A Policy cannot exceed the Identity's autonomy level.

---

## 11. Conformance Levels

To accommodate the diversity of Claw implementations — from 4MB Rust binaries on embedded hardware to 52-module TypeScript deployments — CKP defines three conformance levels:

### Level 1: Core (Minimum Viable Claw)

**Required primitives:** Identity, Provider

A Level 1 Claw can:
- Receive input (via default CLI channel)
- Reason with an LLM provider
- Respond to the user

When no `Channel` primitive is declared, the runtime MUST expose an implicit stdio-based local interaction surface for the process owner. This implicit channel is not serialized in the manifest and does not satisfy Level 2+ `Channel` requirements.

A Level 1 Claw cannot:
- Execute tools or skills
- Persist memory across sessions
- Operate in a swarm
- Connect to messaging platforms

**Target:** Minimal deployments, embedded devices, simple chatbots.

### Level 2: Standard (Interactive Agent)

**Required primitives:** Identity, Provider, Channel, Tool, Sandbox, Policy

A Level 2 Claw can do everything in Level 1, plus:
- Connect to one or more messaging channels
- Execute tools within sandbox constraints
- Apply policy rules to tool execution
- Request human approval for restricted actions

**Target:** Personal assistants, team bots, automated workflows.

### Level 3: Full (Autonomous Swarm Agent)

**Required primitives:** All 9 core primitives (Telemetry optional at all levels)

A Level 3 Claw can do everything in Level 2, plus:
- Persist and retrieve memory across sessions
- Compose tools into skills
- Participate in multi-agent swarms
- Operate autonomously within policy boundaries

**Target:** Enterprise deployments, research teams, complex multi-agent workflows.

### Conformance Declaration

Implementations declare their conformance level:

```yaml
# In runtime metadata (not part of agent manifest)
runtime:
  name: "zeroclaw"
  version: "0.8.0"
  clawkernel:
    version: "0.2.0"
    conformance: "level-3"
    primitives_supported:
      - Identity
      - Provider
      - Channel
      - Tool
      - Skill
      - Memory
      - Sandbox
      - Policy
      - Swarm
```

### Method Support by Conformance Level

Implementations MUST support the methods required by their declared conformance level:

| Method Group | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| `claw.initialize`, `claw.status`, `claw.shutdown` | MUST | MUST | MUST |
| `claw.heartbeat` | SHOULD | SHOULD | MUST |
| `claw.initialized` | SHOULD | SHOULD | SHOULD |
| `claw.tool.call`, `claw.tool.approve`, `claw.tool.deny` | — | MUST | MUST |
| `claw.swarm.delegate`, `claw.swarm.report`, `claw.swarm.broadcast`, `claw.swarm.discover` | — | — | MUST |
| `claw.memory.query`, `claw.memory.store`, `claw.memory.compact` | — | — | MUST |

If an Agent receives a method it does not support for its conformance level, it MUST respond with error code `-32601` (Method not found).

---

## Appendix A: Full Manifest Example

A complete, production-ready agent manifest:

```yaml
# claw.yaml
claw: "0.2.0"
kind: Claw
metadata:
  name: "project-assistant"
  version: "1.0.0"
  description: "An AI assistant for project management and data analysis"
spec:
  identity: "./identity.yaml"
  providers:
    - "./providers/primary.yaml"
    - "./providers/fast.yaml"
    - "./providers/local.yaml"
  channels:
    - "./channels/slack.yaml"
    - "./channels/telegram.yaml"
  tools:
    - "./tools/web-search.yaml"
    - "./tools/web-fetch.yaml"
    - "./tools/file-ops.yaml"
    - "./tools/shell.yaml"
    - "./tools/calendar.yaml"
    - inline:
        name: "mcp-github"
        mcp_source:
          uri: "stdio:///usr/local/bin/mcp-github"
  skills:
    - "./skills/deep-research.yaml"
    - "./skills/report-generation.yaml"
    - "./skills/data-analysis.yaml"
  memory: "./memory.yaml"
  sandbox: "./sandbox.yaml"
  policies:
    - "./policies/security.yaml"
    - "./policies/spending.yaml"
```

```yaml
# identity.yaml
claw: "0.2.0"
kind: Identity
metadata:
  name: "project-assistant"
  version: "1.0.0"
spec:
  personality: |
    You are a project management assistant. You help teams stay organized,
    track progress, analyze data, and produce clear reports. You communicate
    concisely and always provide actionable recommendations.
  context_files:
    user: "USER.md"
    memory: "MEMORY.md"
  locale: "en-US"
  capabilities:
    - "project-management"
    - "data-analysis"
    - "reporting"
    - "scheduling"
  autonomy: "supervised"
```

```yaml
# providers/primary.yaml
claw: "0.2.0"
kind: Provider
metadata:
  name: "primary-llm"
  version: "1.0.0"
spec:
  protocol: "anthropic-native"
  endpoint: "https://api.anthropic.com/v1"
  model: "claude-sonnet-4-6"
  auth:
    type: "bearer"
    secret_ref: "ANTHROPIC_API_KEY"
  streaming: true
  hints:
    cost_priority: 0.4
    speed_priority: 0.6
    intelligence_priority: 0.7
  fallback:
    - provider_ref: "fast-llm"
    - provider_ref: "local-llm"
  limits:
    tokens_per_day: 500000
    requests_per_minute: 60
```

```yaml
# providers/local.yaml
claw: "0.2.0"
kind: Provider
metadata:
  name: "local-llm"
  version: "1.0.0"
spec:
  protocol: "openai-compatible"
  endpoint: "http://localhost:11434/v1"
  model: "llama3:70b"
  auth:
    type: "none"
  streaming: true
  hints:
    cost_priority: 1.0
    speed_priority: 0.3
    intelligence_priority: 0.5
```

```yaml
# channels/slack.yaml
claw: "0.2.0"
kind: Channel
metadata:
  name: "team-slack"
  version: "1.0.0"
spec:
  type: "slack"
  transport: "websocket"
  auth:
    secret_ref: "SLACK_BOT_TOKEN"
  access_control:
    mode: "role-based"
    roles:
      - id: "U01ABC123"
        role: "admin"
      - id: "U02DEF456"
        role: "user"
  processing:
    max_message_length: 4096
    rate_limit:
      messages_per_minute: 30
      burst: 5
    typing_indicator: true
  features:
    files: true
    reactions: true
    threads: true
```

```yaml
# memory.yaml
claw: "0.2.0"
kind: Memory
metadata:
  name: "hybrid-memory"
  version: "1.0.0"
spec:
  stores:
    - name: "conversations"
      type: "conversation"
      backend: "sqlite"
      retention:
        max_age: "90d"
        max_entries: 50000
      compaction:
        enabled: true
        strategy: "summarize"
    - name: "knowledge"
      type: "semantic"
      backend: "sqlite-vec"
      embedding:
        provider_ref: "fast-llm"
        model: "text-embedding-3-small"
        dimensions: 1536
      search:
        strategy: "hybrid"
        fusion: "reciprocal-rank"
        top_k: 10
    - name: "preferences"
      type: "key-value"
      backend: "sqlite"
      scope: "per-identity"
    - name: "workspace"
      type: "workspace"
      path: "~/.claw/workspaces/project-assistant/"
      isolation: "per-channel"
      max_size_mb: 1000
```

```yaml
# sandbox.yaml
claw: "0.2.0"
kind: Sandbox
metadata:
  name: "standard-sandbox"
  version: "1.0.0"
spec:
  level: "container"
  runtime: "docker"
  capabilities:
    network:
      mode: "allowlist"
      allowed_hosts:
        - "api.anthropic.com"
        - "*.slack.com"
        - "api.github.com"
        - "www.googleapis.com"
      ssrf_protection:
        enabled: true
        block_private_ips: true
        dns_pinning: true
    filesystem:
      mode: "scoped"
      mount_paths:
        - path: "/workspace"
          permissions: "rw"
        - path: "/tmp"
          permissions: "rw"
    secrets:
      injection: "host-boundary"
      encryption: "aes-256-gcm"
      leak_detection:
        enabled: true
        patterns: 22
    shell:
      mode: "restricted"
      blocked_patterns:
        - "\\|\\s*bash"
        - "eval\\s+"
        - "rm\\s+-rf\\s+/"
  resource_limits:
    memory_mb: 1024
    cpu_shares: 512
    timeout_ms: 300000
```

```yaml
# policies/security.yaml
claw: "0.2.0"
kind: Policy
metadata:
  name: "security-policy"
  version: "1.0.0"
spec:
  rules:
    - id: "deny-destructive"
      action: "deny"
      scope: "tool"
      match:
        annotations:
          destructiveHint: true
      reason: "Destructive operations are blocked"
    - id: "approve-network"
      action: "require-approval"
      scope: "category"
      match:
        category: "network"
      reason: "Network access requires confirmation"
      approval:
        timeout_seconds: 300
        default_if_timeout: "deny"
    - id: "allow-readonly"
      action: "allow"
      scope: "tool"
      match:
        annotations:
          readOnlyHint: true
    - id: "allow-workspace"
      action: "allow"
      scope: "category"
      match:
        category: "filesystem"
      conditions:
        path_within: "/workspace"
    - id: "default-deny"
      action: "deny"
      scope: "all"
      reason: "Default deny"
  prompt_injection:
    detection: "hybrid"
    action: "block-and-log"
  secret_scanning:
    enabled: true
    scope: "both"
    action: "redact"
  rate_limits:
    tool_calls_per_minute: 30
    tokens_per_hour: 100000
  audit:
    log_inputs: true
    log_outputs: true
    retention: "90d"
    destination: "sqlite"
```

```yaml
# policies/spending.yaml
claw: "0.2.0"
kind: Policy
metadata:
  name: "spending-policy"
  version: "1.0.0"
spec:
  rules:
    - id: "spending-limit"
      action: "deny"
      scope: "tool"
      rate_limit:
        cost_per_day_usd: 25.00
        tokens_per_day: 1000000
  audit:
    log_inputs: false
    log_outputs: false
    retention: "365d"
    destination: "sqlite"
```

---

## Appendix B: Schema References and Precedence

The TypeScript schema is the **canonical source of truth** for all type definitions in this specification. Where the prose specification and the TypeScript schema conflict, the TypeScript schema takes precedence. The JSON Schema is auto-generated from the TypeScript source and is provided for tooling convenience.

> The TypeScript schema and JSON Schema files for version 0.2.0 are published in the `schema/0.2.0/` directory of this repository.

> **Publication policy:** Resources listed in this table MUST exist in the repository at the time of release. Placeholder or planned resources MUST NOT be listed.

| Resource | Path |
|----------|------|
| TypeScript schema (source of truth) | [`schema/0.2.0/schema.ts`](https://github.com/angelgalvisc/clawkernel/blob/main/schema/0.2.0/schema.ts) |
| JSON Schemas (per-primitive, 12 files) | [`schema/0.2.0/*.schema.json`](https://github.com/angelgalvisc/clawkernel/tree/main/schema/0.2.0) |
| Conformance test harness | [`@clawkernel/ckp-test`](https://github.com/angelgalvisc/ckp-test) |
| Example manifests | [`profiles/`](https://github.com/angelgalvisc/clawkernel/tree/main/profiles) |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Claw** | An autonomous AI agent runtime — a long-lived process that receives messages, reasons with LLMs, executes tools, and maintains persistent state. |
| **Primitive** | One of the 10 fundamental units (Identity, Provider, Channel, Tool, Skill, Memory, Sandbox, Policy, Swarm, Telemetry) that compose a Claw. |
| **Manifest** | A `claw.yaml` file that declares all primitives for an agent. |
| **Provider** | An LLM inference endpoint (cloud API or local model). |
| **Channel** | A communication surface (Telegram, Slack, CLI, etc.) through which humans interact with a Claw. |
| **Skill** | A composed workflow built from multiple tools with natural-language instructions. |
| **Sandbox** | An isolated execution environment with declared capabilities and resource limits. |
| **Policy** | A set of behavioral rules governing what an agent can do. |
| **Swarm** | A coordinated group of Claws working together on shared objectives. |
| **MCP** | Model Context Protocol — the Anthropic-originated standard for tool/resource discovery. The Claw Kernel Protocol is complementary. |
| **Conformance Level** | One of three tiers (Core, Standard, Full) indicating which primitives an implementation supports. |
| **Autonomy Level** | One of three modes (Observer, Supervised, Autonomous) declaring how much an agent can do without human approval. |

---

## Appendix D: Runtime Profile (Transition Notice)

The runtime recommendations previously in this appendix (default values, name generation, implicit CLI channel, extended error catalog, retry semantics) have been moved to the companion document:

> **Claw Kernel Protocol Runtime Profile** (`clawkernel-runtime-profile.md`)

The Runtime Profile is an informative document providing RECOMMENDED practices for runtime implementers. Core error codes required for interoperability are now specified normatively in Section 9.4.

---

*The Claw Kernel Protocol is an open specification. Contributions, feedback, and implementations are welcome.*

*This document is released under the Apache 2.0 License.*
