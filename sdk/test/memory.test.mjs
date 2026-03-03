import test from "node:test";
import assert from "node:assert/strict";
import { MemoryExecutor } from "../dist/memory.js";
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

const handler = {
  store: async (_store, entries) => ({ stored: entries.length, ids: ["1"] }),
  query: async () => ({ entries: [] }),
  compact: async () => ({ entries_before: 2, entries_after: 1 }),
};

test("memory store validates required params", async () => {
  const t = createMockTransport();
  const exec = new MemoryExecutor(t, handler);
  await exec.handleStore(1, { entries: [] });
  assert.equal(t.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});

test("memory query returns handler result", async () => {
  const t = createMockTransport();
  const exec = new MemoryExecutor(t, handler);
  await exec.handleQuery(2, { store: "default", query: { type: "semantic", text: "hi" } });
  assert.deepEqual(t.messages[0].result, { entries: [] });
});

test("memory compact returns internal error on exception", async () => {
  const t = createMockTransport();
  const exec = new MemoryExecutor(t, {
    ...handler,
    compact: async () => {
      throw new Error("boom");
    },
  });
  await exec.handleCompact(3, { store: "default" });
  assert.equal(t.messages[0].error.code, -32603);
});
