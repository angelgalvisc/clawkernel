import test from "node:test";
import assert from "node:assert/strict";
import { SwarmExecutor } from "../dist/swarm.js";
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
  delegate: async () => ({ acknowledged: true }),
  discover: async () => ({ peers: [] }),
  report: async () => ({ acknowledged: true }),
  broadcast: () => {},
};

test("swarm delegate validates task_id and task.description", async () => {
  const t = createMockTransport();
  const exec = new SwarmExecutor(t, handler);
  await exec.handleDelegate(1, { task: { description: "x" } });
  assert.equal(t.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});

test("swarm discover returns peers result", async () => {
  const t = createMockTransport();
  const exec = new SwarmExecutor(t, handler);
  await exec.handleDiscover(2, { swarm: "analysis" });
  assert.deepEqual(t.messages[0].result, { peers: [] });
});

test("swarm report validates status", async () => {
  const t = createMockTransport();
  const exec = new SwarmExecutor(t, handler);
  await exec.handleReport(3, { task_id: "1" });
  assert.equal(t.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});
