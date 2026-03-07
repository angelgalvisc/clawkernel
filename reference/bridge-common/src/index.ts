/**
 * @clawkernel/bridge-common — Shared CKP Bridge Utilities
 *
 * Factored out of nullclaw-bridge and nanoclaw-bridge to eliminate
 * ~80% code duplication. Provides reusable factories for:
 *
 *   - Sandbox checks (blocked path patterns, allowed workspace paths, SSRF)
 *   - In-memory CKP Memory implementation (store/query/compact)
 *   - Stub CKP Swarm implementation (delegate/discover/report/broadcast)
 *   - CKP conformance test tools (echo, slow-tool, approval-tool)
 *   - Policy evaluator factory (denied tools list)
 *   - Quota checker factory
 *   - Default approval config
 */

import type {
  MemoryEntry,
  MemoryQuery,
  MemoryHandler,
  SwarmHandler,
  SwarmTask,
  SwarmContext,
  SwarmPeer,
  ToolDefinition,
  PolicyEvaluator,
  SandboxChecker,
  QuotaChecker,
  ApprovalConfig,
} from "@clawkernel/sdk";
import { randomUUID } from "node:crypto";

// ── Sandbox Utilities ─────────────────────────────────────────────────────────

/**
 * Default blocked path patterns — common sensitive file/directory names.
 * Used by both NullClaw (landlock/firejail) and NanoClaw (Docker mounts).
 */
export const BLOCKED_PATTERNS: readonly string[] = [
  ".ssh", ".gnupg", ".gpg", ".aws", ".azure", ".gcloud",
  ".kube", ".docker", "credentials", ".env", ".netrc",
  ".npmrc", ".pypirc", "id_rsa", "id_ed25519", "private_key", ".secret",
  ".config/gcloud", ".config/az", "token.json", "secrets.yaml",
];

/** SSRF target CIDR that bridges block via sandbox networking. */
export const METADATA_CIDR = "169.254";

/** Check if a filesystem path contains any blocked pattern segments. */
export function matchesBlockedPattern(path: string): boolean {
  const parts = path.split("/");
  for (const pattern of BLOCKED_PATTERNS) {
    for (const part of parts) {
      if (part === pattern || part.includes(pattern)) return true;
    }
  }
  return false;
}

/** Check if a path starts with any of the allowed workspace paths. */
export function isWithinAllowedPath(allowedPaths: readonly string[], path: string): boolean {
  return allowedPaths.some((allowed) => path.startsWith(allowed));
}

// ── Sandbox Factory ───────────────────────────────────────────────────────────

export interface SandboxOptions {
  /** Allowed workspace paths (e.g. ["/workspace", "/tmp/myagent"]). */
  allowedPaths: readonly string[];
}

/**
 * Create a CKP SandboxChecker that blocks SSRF, sensitive paths, and
 * paths outside the allowed workspace.
 */
export function createSandboxChecker(options: SandboxOptions): SandboxChecker {
  return {
    check: (_toolName: string, args: Record<string, unknown>) => {
      // Block SSRF to cloud metadata endpoints
      const url = typeof args.url === "string" ? args.url : "";
      if (url.includes(METADATA_CIDR)) {
        return { allowed: false, code: -32010 };
      }

      // Block access to sensitive paths
      const path = typeof args.path === "string" ? args.path : "";
      if (path && matchesBlockedPattern(path)) {
        return { allowed: false, code: -32010 };
      }

      // Block access outside allowed workspace paths
      if (path && !isWithinAllowedPath(options.allowedPaths, path) && path.startsWith("/")) {
        return { allowed: false, code: -32010 };
      }

      return { allowed: true };
    },
  };
}

// ── Policy Factory ────────────────────────────────────────────────────────────

/**
 * Create a CKP PolicyEvaluator that denies a set of blocked tool names.
 */
export function createPolicyEvaluator(deniedTools: ReadonlySet<string>): PolicyEvaluator {
  return {
    evaluate: (toolName: string, _context: Record<string, unknown>) => {
      if (deniedTools.has(toolName)) {
        return { allowed: false, code: -32011 };
      }
      return { allowed: true };
    },
  };
}

// ── Quota Factory ─────────────────────────────────────────────────────────────

/**
 * Create a CKP QuotaChecker that blocks a set of tool names.
 * Default: blocks "expensive-tool" (required for TV-L2-10).
 */
export function createQuotaChecker(
  blockedTools: ReadonlySet<string> = new Set(["expensive-tool"]),
): QuotaChecker {
  return {
    check: (toolName: string) => {
      if (blockedTools.has(toolName)) {
        return { allowed: false, code: -32021 };
      }
      return { allowed: true };
    },
  };
}

// ── Approval Config ───────────────────────────────────────────────────────────

/**
 * Default approval config: requires approval for "approval-tool", 200ms timeout.
 * Required for TV-L2-06, TV-L2-07, TV-L2-08.
 */
export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  required: (toolName: string) => toolName === "approval-tool",
  timeout_ms: 200,
};

// ── Conformance Test Tools ────────────────────────────────────────────────────

/**
 * The three tools required by the CKP conformance test harness:
 * - echo: returns args.text (TV-L2-02)
 * - slow-tool: 100ms timeout, 5s sleep → triggers timeout (TV-L2-05)
 * - approval-tool: returns "approved" (TV-L2-06, TV-L2-07, TV-L2-08)
 */
export const CONFORMANCE_TOOLS: Record<string, ToolDefinition> = {
  echo: {
    execute: async (args: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: String(args.text ?? "") }],
    }),
  },

  "slow-tool": {
    timeout_ms: 100,
    execute: async () => {
      await new Promise((r) => setTimeout(r, 5000));
      return { content: [{ type: "text" as const, text: "done" }] };
    },
  },

  "approval-tool": {
    execute: async () => ({
      content: [{ type: "text" as const, text: "approved" }],
    }),
  },
};

// ── In-Memory CKP Memory ─────────────────────────────────────────────────────

interface StoredEntry {
  id: string;
  content: string | Record<string, unknown>;
  timestamp: string;
}

/**
 * Create an in-memory CKP MemoryHandler (store/query/compact).
 * Suitable for bridges that simulate a real memory backend.
 */
export function createInMemoryStore(): MemoryHandler {
  const stores = new Map<string, StoredEntry[]>();

  return {
    store: async (storeName: string, entries: MemoryEntry[]) => {
      const bucket = stores.get(storeName) ?? [];
      const ids: string[] = [];
      for (const entry of entries) {
        const id = randomUUID();
        ids.push(id);
        bucket.push({ id, content: entry.content, timestamp: new Date().toISOString() });
      }
      stores.set(storeName, bucket);
      return { stored: entries.length, ids };
    },

    query: async (storeName: string, _query: MemoryQuery) => {
      const bucket = stores.get(storeName) ?? [];
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
      const bucket = stores.get(storeName) ?? [];
      const before = bucket.length;
      const compacted = bucket.slice(-100);
      stores.set(storeName, compacted);
      return { entries_before: before, entries_after: compacted.length };
    },
  };
}

// ── Stub CKP Swarm ───────────────────────────────────────────────────────────

/**
 * Create a stub CKP SwarmHandler with configurable peer identities.
 * Suitable for bridges that simulate a real swarm backend.
 */
export function createStubSwarm(peers: SwarmPeer[]): SwarmHandler {
  return {
    delegate: async (_taskId: string, _task: SwarmTask, _context: SwarmContext) => {
      return { acknowledged: true };
    },

    discover: async (_swarmName?: string) => {
      return { peers };
    },

    report: async (_taskId: string, _status: string, _result: Record<string, unknown>) => {
      return { acknowledged: true };
    },

    broadcast: (_swarmName: string, _message: Record<string, unknown>) => {
      // Notification — fire-and-forget, no response.
    },
  };
}
