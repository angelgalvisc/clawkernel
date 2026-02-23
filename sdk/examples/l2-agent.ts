/**
 * L2 CKP Agent — tools, policy, sandbox, quota, approval.
 * Passes 13 L1 + 9 L2 vectors (TV-L2-07 = scenario skip).
 */

import { createAgent } from "../src/index.js";

const agent = createAgent({
  name: "l2-test-agent",
  version: "1.0.0",

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
});

agent.listen();
