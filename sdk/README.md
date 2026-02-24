# @clawkernel/sdk

Zero-dependency TypeScript SDK for building [CKP](https://github.com/angelgalvisc/clawkernel)-conformant agents.

🌐 **Documentation:** [clawkernel.com](https://www.clawkernel.com/) · Built by [Datastrat](https://datastrat.co)

[![Version](https://img.shields.io/badge/version-0.2.2-blue)](package.json)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](../LICENSE)
[![Dependencies](https://img.shields.io/badge/runtime_deps-0-brightgreen)]()

## Install

```bash
npm install @clawkernel/sdk
```

## Quick Start

```typescript
import { createAgent } from "@clawkernel/sdk";

const agent = createAgent({
  name: "my-agent",
  version: "1.0.0",
});

agent.listen(); // L1 CONFORMANT — stdio JSON-RPC 2.0
```

That's it. This agent passes all 13 L1 test vectors.

## Conformance Levels

| Level | What you configure | Test vectors |
|-------|-------------------|--------------|
| **L1** | `name` + `version` | 13/13 |
| **L2** | + `tools`, `policy`, `sandbox`, `quota`, `approval` | +10 |
| **L3** | + `memory`, `swarm` | +8 |

## L2 Example — Tools + Gates

```typescript
import { createAgent } from "@clawkernel/sdk";

const agent = createAgent({
  name: "assistant",
  version: "1.0.0",

  tools: {
    echo: {
      execute: async (args) => ({
        content: [{ type: "text", text: String(args.text) }],
      }),
    },
    "slow-tool": {
      timeout_ms: 5000,
      execute: async (args) => {
        // Long-running work...
        return { content: [{ type: "text", text: "done" }] };
      },
    },
  },

  policy: {
    evaluate: (toolName) => {
      if (toolName === "dangerous") return { allowed: false, code: -32011 };
      return { allowed: true };
    },
  },

  sandbox: {
    check: (_toolName, args) => {
      if (String(args.url ?? "").includes("169.254"))
        return { allowed: false, code: -32010 };
      return { allowed: true };
    },
  },

  quota: {
    check: (toolName) => {
      if (toolName === "expensive") return { allowed: false, code: -32021 };
      return { allowed: true };
    },
  },

  approval: {
    required: (toolName) => toolName === "deploy",
    timeout_ms: 30000,
  },
});

agent.listen();
```

### Tool Execution Pipeline

Every `claw.tool.call` flows through five gates in order:

```
quota → policy → sandbox → exists → approval → execute (with timeout)
```

Each gate can reject the call with a specific error code. Gates run **before** tool existence is checked — a denied tool never reveals whether it exists.

## L3 Example — Memory + Swarm

```typescript
import { createAgent } from "@clawkernel/sdk";
import type { MemoryEntry, MemoryQuery, SwarmTask, SwarmContext } from "@clawkernel/sdk";

const agent = createAgent({
  name: "swarm-agent",
  version: "1.0.0",
  tools: { /* ... */ },
  policy: { /* ... */ },
  sandbox: { check: () => ({ allowed: true }) },

  memory: {
    store: async (storeName, entries) => {
      // Persist entries to your backend
      return { stored: entries.length, ids: ["id-1"] };
    },
    query: async (storeName, query) => {
      // Search your backend
      return { entries: [] };
    },
    compact: async (storeName) => {
      // Compact/GC your store
      return { entries_before: 100, entries_after: 50 };
    },
  },

  swarm: {
    delegate: async (taskId, task, context) => {
      return { acknowledged: true };
    },
    discover: async (swarmName) => {
      return { peers: [{ identity: "peer-1", uri: "claw://local/identity/peer-1", status: "ready" }] };
    },
    report: async (taskId, status, result) => {
      return { acknowledged: true };
    },
    broadcast: (swarmName, message) => {
      // Fire and forget (notification)
    },
  },
});

agent.listen();
```

## API Reference

### `createAgent(options: AgentOptions): Agent`

Factory function. Returns a configured `Agent` instance.

### `Agent`

| Method | Description |
|--------|-------------|
| `listen()` | Start reading JSON-RPC from stdin |
| `close()` | Stop heartbeat and close transport |

### `AgentOptions`

| Field | Type | Required | Level | Description |
|-------|------|----------|-------|-------------|
| `name` | `string` | Yes | L1 | Agent identity name |
| `version` | `string` | Yes | L1 | Agent version (semver) |
| `heartbeatInterval` | `number` | No | L1 | Heartbeat interval in ms (default: 30000, min: 1000, 0 = disabled) |
| `tools` | `Record<string, ToolDefinition>` | No | L2 | Tool registry |
| `policy` | `PolicyEvaluator` | No | L2 | Policy gate |
| `sandbox` | `SandboxChecker` | No | L2 | Sandbox gate |
| `quota` | `QuotaChecker` | No | L2 | Quota gate |
| `approval` | `ApprovalConfig` | No | L2 | Approval gate |
| `memory` | `MemoryHandler` | No | L3 | Memory handler |
| `swarm` | `SwarmHandler` | No | L3 | Swarm handler |

### `ToolDefinition`

```typescript
interface ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<ToolCallResult>;
  timeout_ms?: number; // Default: 30000
}
```

### `GateResult`

Returned by policy, sandbox, and quota evaluators:

```typescript
interface GateResult {
  allowed: boolean;
  code?: number;    // CKP error code when denied
  message?: string; // Human-readable denial reason
}
```

### Error Helpers

All 11 CKP error code helpers are exported for custom handler use:

```typescript
import { sendOk, sendError, policyDenied, ToolTimeoutError } from "@clawkernel/sdk";
```

| Helper | Code | Description |
|--------|------|-------------|
| `parseError` | -32700 | Malformed JSON |
| `invalidRequest` | -32600 | Invalid JSON-RPC envelope |
| `methodNotFound` | -32601 | Unknown method |
| `invalidParams` | -32602 | Missing/invalid params |
| `versionMismatch` | -32001 | Protocol version mismatch |
| `sandboxDenied` | -32010 | Sandbox blocked the call |
| `policyDenied` | -32011 | Policy blocked the call |
| `approvalTimeout` | -32012 | Approval not received in time |
| `approvalDenied` | -32013 | Approval explicitly denied |
| `toolTimeout` | -32014 | Tool execution timeout |
| `quotaExceeded` | -32021 | Provider quota exceeded |

### `CKP_ERROR_CODES`

Exported constant object with all error code values.

## Hardening

The SDK validates all incoming JSON-RPC messages:

- **Type guards** on every `params` field (no unsafe `as` casts)
- **State machine** — methods like `claw.tool.call` are rejected before `claw.initialize`
- **Heartbeat bound** — minimum 1000ms to prevent CPU saturation
- **`ToolTimeoutError`** class for reliable timeout detection (not string comparison)
- **`request_id` validation** in approval gate (rejects missing/empty IDs)
- **`params` type validation** — arrays and primitives rejected with -32602

## Testing

```bash
# Install conformance harness
git clone https://github.com/angelgalvisc/ckp-test.git
cd ckp-test && npm install && npx tsc

# Run against SDK examples
cd ../clawkernel/sdk && npm run build:dev

node ../../ckp-test/dist/cli.js run \
  --target "node dist/examples/l3-agent.js" \
  --manifest examples/l3.claw.yaml \
  --level 3

# Expected: 30 PASS + 1 SKIP → L3 PARTIAL
```

## License

[Apache License 2.0](../LICENSE)
