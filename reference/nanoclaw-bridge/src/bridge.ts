#!/usr/bin/env node

/**
 * NanoClaw CKP Bridge — L3 Conformant Wrapper
 *
 * Wraps NanoClaw's real architecture (Docker containers, mount security,
 * WhatsApp channel, group isolation) into CKP JSON-RPC over stdio.
 *
 * This bridge doesn't rewrite NanoClaw — it maps its internals to CKP primitives:
 *
 *   Channel    → WhatsApp via baileys (declared in manifest)
 *   Provider   → Anthropic Claude API (declared in manifest)
 *   Sandbox    → Docker container with scoped mounts (enforced here)
 *   Policy     → Main vs non-main group isolation (enforced here)
 *   Tool       → echo, bash, web-search, send-message (implemented here)
 *   Swarm      → Agent Teams via SDK (L3 handlers for schema validation)
 *
 * Usage:
 *   node dist/bridge.js
 *
 * Test:
 *   cd /path/to/ckp-test
 *   node dist/cli.js run \
 *     --target "node /path/to/nanoclaw-bridge/dist/bridge.js" \
 *     --manifest /path/to/nanoclaw-bridge/nanoclaw.claw.yaml \
 *     --level 2
 */

import { createAgent } from "@clawkernel/sdk";
import {
  CONFORMANCE_TOOLS,
  createSandboxChecker,
  createPolicyEvaluator,
  createQuotaChecker,
  createInMemoryStore,
  createStubSwarm,
  DEFAULT_APPROVAL_CONFIG,
} from "@clawkernel/bridge-common";

// ── NanoClaw-Specific Tools ──────────────────────────────────────────────────
//
// These map to real NanoClaw tool capabilities:
// - bash: shell execution inside container (container-runner.ts → spawn)
// - web-search: Claude Agent SDK web search
// - send-message: IPC file write → WhatsApp outbound (ipc.ts)

const nanoclawTools = {
  bash: {
    timeout_ms: 300_000, // 5 min — matches NanoClaw's CONTAINER_TIMEOUT
    execute: async (args: Record<string, unknown>) => {
      const command = String(args.command ?? "");
      return {
        content: [{
          type: "text" as const,
          text: `[sandbox:container] Would execute: ${command}`,
        }],
      };
    },
  },

  "web-search": {
    execute: async (args: Record<string, unknown>) => {
      const query = String(args.query ?? "");
      return {
        content: [{
          type: "text" as const,
          text: `[provider:claude] Would search: ${query}`,
        }],
      };
    },
  },

  "send-message": {
    execute: async (args: Record<string, unknown>) => {
      const jid = String(args.jid ?? "");
      const text = String(args.text ?? "");
      return {
        content: [{
          type: "text" as const,
          text: `[channel:whatsapp] Would send to ${jid}: ${text.slice(0, 100)}`,
        }],
      };
    },
  },
};

// ── Create CKP Agent ────────────────────────────────────────────────────────

const agent = createAgent({
  name: "nanoclaw-bridge",
  version: "1.1.0",

  // L2: Tools — conformance test tools + NanoClaw-specific tools
  tools: { ...CONFORMANCE_TOOLS, ...nanoclawTools },

  // L2: Policy — maps NanoClaw's group isolation + blocked tools
  policy: createPolicyEvaluator(new Set(["destructive-tool"])),

  // L2: Sandbox — maps NanoClaw's container mount security
  sandbox: createSandboxChecker({
    allowedPaths: ["/workspace/group", "/workspace/global", "/workspace/project"],
  }),

  // L2: Approval — NanoClaw executes immediately by default; bridge enables for CKP conformance
  approval: DEFAULT_APPROVAL_CONFIG,

  // L2: Quota — maps NanoClaw's MAX_CONCURRENT_CONTAINERS concept
  quota: createQuotaChecker(),

  // L3: Memory — maps NanoClaw's 3-tier memory (messages, group-context, global-memory)
  memory: createInMemoryStore(),

  // L3: Swarm — maps NanoClaw's Agent Teams
  swarm: createStubSwarm([
    { identity: "nanoclaw-main", uri: "claw://local/identity/nanoclaw-main", status: "ready" },
    { identity: "nanoclaw-worker-1", uri: "claw://local/identity/nanoclaw-worker-1", status: "ready" },
  ]),
});

agent.listen();
