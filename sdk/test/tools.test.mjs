import test from "node:test";
import assert from "node:assert/strict";
import { ToolExecutor } from "../dist/tools.js";
import { CKP_ERROR_CODES } from "../dist/index.js";

function createMockTransport() {
  return {
    messages: [],
    onMessage() {},
    send(payload) {
      this.messages.push(payload);
    },
    close() {},
  };
}

test("tool executor applies quota gate before tool existence", async () => {
  const transport = createMockTransport();
  const exec = new ToolExecutor(transport, {
    name: "t",
    version: "1.0.0",
    quota: { check: () => ({ allowed: false }) },
    tools: {},
  });

  await exec.handleToolCall(1, { name: "unknown-tool", arguments: {} });
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.PROVIDER_QUOTA_EXCEEDED);
});

test("tool executor returns invalid params for unknown tool after gates", async () => {
  const transport = createMockTransport();
  const exec = new ToolExecutor(transport, {
    name: "t",
    version: "1.0.0",
    quota: { check: () => ({ allowed: true }) },
    policy: { evaluate: () => ({ allowed: true }) },
    sandbox: { check: () => ({ allowed: true }) },
    tools: {},
  });

  await exec.handleToolCall(2, { name: "missing", arguments: {} });
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});

test("tool executor returns timeout error for slow tool", async () => {
  const transport = createMockTransport();
  const exec = new ToolExecutor(transport, {
    name: "t",
    version: "1.0.0",
    tools: {
      slow: {
        timeout_ms: 5,
        execute: async () => {
          await new Promise((r) => setTimeout(r, 50));
          return { content: [{ type: "text", text: "done" }] };
        },
      },
    },
  });

  await exec.handleToolCall(3, { name: "slow", arguments: {} });
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.TOOL_EXECUTION_TIMEOUT);
});

test("tool executor requires request_id for approval-required tool", async () => {
  const transport = createMockTransport();
  const exec = new ToolExecutor(transport, {
    name: "t",
    version: "1.0.0",
    approval: { required: () => true, timeout_ms: 10 },
    tools: {
      deploy: {
        execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
      },
    },
  });

  await exec.handleToolCall(4, { name: "deploy", arguments: {} });
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});
