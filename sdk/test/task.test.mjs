import test from "node:test";
import assert from "node:assert/strict";
import { TaskExecutor } from "../dist/task.js";
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

const records = new Map();

const handler = {
  create: async (params) => {
    const task = {
      task_id: params.task_id ?? "generated-1",
      state: "submitted",
      messages: params.messages ?? (params.message ? [params.message] : []),
    };
    records.set(task.task_id, task);
    return task;
  },
  get: async (taskId) => records.get(taskId) ?? null,
  list: async () => [...records.values()],
  cancel: async (taskId) => records.get(taskId) ?? null,
  subscribe: async (taskId) => ({ task_id: taskId, subscribed: true, state: "working" }),
};

test("task create requires message payload", async () => {
  const t = createMockTransport();
  const exec = new TaskExecutor(t, handler);
  await exec.handleCreate(1, {});
  assert.equal(t.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
});

test("task create/get/list/cancel/subscribe happy path", async () => {
  const t = createMockTransport();
  const exec = new TaskExecutor(t, handler);

  await exec.handleCreate(2, {
    task_id: "t-1",
    message: { role: "user", content: [{ type: "text", text: "hello" }] },
  });
  assert.equal(t.messages[0].result.task_id, "t-1");

  await exec.handleGet(3, { task_id: "t-1" });
  assert.equal(t.messages[1].result.task_id, "t-1");

  await exec.handleList(4, { state: "submitted", limit: 10 });
  assert.ok(Array.isArray(t.messages[2].result.tasks));

  await exec.handleCancel(5, { task_id: "t-1" });
  assert.equal(t.messages[3].result.task_id, "t-1");

  await exec.handleSubscribe(6, { task_id: "t-1" });
  assert.equal(t.messages[4].result.subscribed, true);
});
