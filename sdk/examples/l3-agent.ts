/**
 * L3 CKP Agent — tools, policy, sandbox, quota, approval + memory + swarm.
 * Passes 13 L1 + 9 L2 + 8 L3 vectors (TV-L2-07 = scenario skip).
 */

import { createAgent } from "../src/index.js";
import type { MemoryEntry, MemoryQuery, SwarmTask, SwarmContext } from "../src/index.js";
import { randomUUID } from "node:crypto";

// ── In-memory store (for test vectors) ──────────────────────────────────────

const memoryStore = new Map<string, { id: string; content: string | Record<string, unknown>; timestamp: string }[]>();

const agent = createAgent({
  name: "l3-test-agent",
  version: "1.0.0",

  // ── L2: Tools ───────────────────────────────────────────────────────────

  tools: {
    echo: {
      execute: async (args) => ({
        content: [{ type: "text", text: args.text as string }],
      }),
    },
    "slow-tool": {
      timeout_ms: 100,
      execute: async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return { content: [{ type: "text", text: "done" }] };
      },
    },
  },

  policy: {
    evaluate: (toolName) => {
      if (toolName === "destructive-tool") return { allowed: false, code: -32011 };
      return { allowed: true };
    },
  },

  sandbox: {
    check: (_toolName, args) => {
      if ((args.url as string)?.includes("169.254")) return { allowed: false, code: -32010 };
      return { allowed: true };
    },
  },

  approval: {
    required: () => false,
    timeout_ms: 30000,
  },

  quota: {
    check: (toolName) => {
      if (toolName === "expensive-tool") return { allowed: false, code: -32021 };
      return { allowed: true };
    },
  },

  // ── L3: Memory ──────────────────────────────────────────────────────────

  memory: {
    store: async (storeName: string, entries: MemoryEntry[]) => {
      const bucket = memoryStore.get(storeName) ?? [];
      const ids: string[] = [];
      for (const entry of entries) {
        const id = randomUUID();
        ids.push(id);
        bucket.push({ id, content: entry.content, timestamp: new Date().toISOString() });
      }
      memoryStore.set(storeName, bucket);
      return { stored: entries.length, ids };
    },

    query: async (storeName: string, _query: MemoryQuery) => {
      const bucket = memoryStore.get(storeName) ?? [];
      return {
        entries: bucket.map((e) => ({
          id: e.id,
          content: e.content,
          score: 1.0,
          timestamp: e.timestamp,
        })),
      };
    },

    compact: async (storeName: string) => {
      const bucket = memoryStore.get(storeName) ?? [];
      const before = bucket.length;
      // Compact: keep last 100 entries (trivial for tests)
      const compacted = bucket.slice(-100);
      memoryStore.set(storeName, compacted);
      return { entries_before: before, entries_after: compacted.length };
    },
  },

  // ── L3: Swarm ───────────────────────────────────────────────────────────

  swarm: {
    delegate: async (_taskId: string, _task: SwarmTask, _context: SwarmContext) => {
      return { acknowledged: true };
    },

    discover: async (_swarmName?: string) => {
      return {
        peers: [
          {
            identity: "peer-1",
            uri: "claw://local/identity/peer-1",
            status: "ready" as const,
          },
        ],
      };
    },

    report: async (_taskId: string, _status: string, _result: Record<string, unknown>) => {
      return { acknowledged: true };
    },

    broadcast: (_swarmName: string, _message: Record<string, unknown>) => {
      // Fire and forget — notification, no response.
    },
  },
});

agent.listen();
