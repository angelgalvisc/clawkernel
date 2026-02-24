import { createAgent, type TaskRecord, mapA2AMessageToCkpTaskMessage } from "../src/index.js";

const tasks = new Map<string, TaskRecord>();
let seq = 0;

function nextTaskId(): string {
  seq += 1;
  return `task-${seq.toString().padStart(4, "0")}`;
}

const agent = createAgent({
  name: "test-a2a-agent",
  version: "1.0.0",

  tasks: {
    async create(params) {
      const taskId = params.task_id ?? nextTaskId();

      const singleMessage = params.message
        ? params.message
        : params.messages?.[0];

      const created: TaskRecord = {
        task_id: taskId,
        state: "submitted",
        messages: singleMessage ? [singleMessage] : [],
        metadata: {
          created_at: new Date().toISOString(),
          ...(params.metadata ?? {}),
        },
      };

      // Example of boundary mapping utility usage:
      // If caller provided an A2A-like message in metadata, normalize it.
      const possibleA2AMessage = params.metadata?.a2a_message;
      if (possibleA2AMessage && typeof possibleA2AMessage === "object" && !Array.isArray(possibleA2AMessage)) {
        try {
          const normalized = mapA2AMessageToCkpTaskMessage(possibleA2AMessage as never);
          created.messages = [...(created.messages ?? []), normalized];
        } catch {
          // Ignore malformed optional metadata payload.
        }
      }

      tasks.set(taskId, created);
      return created;
    },

    async get(taskId) {
      return tasks.get(taskId) ?? null;
    },

    async list(filter) {
      let records = [...tasks.values()];
      if (filter?.state) {
        records = records.filter((t) => t.state === filter.state);
      }
      if (filter?.limit) {
        records = records.slice(0, filter.limit);
      }
      return records;
    },

    async cancel(taskId, reason) {
      const existing = tasks.get(taskId);
      if (!existing) return null;

      const canceled: TaskRecord = {
        ...existing,
        state: "canceled",
        metadata: {
          ...(existing.metadata ?? {}),
          canceled_reason: reason ?? "unspecified",
          canceled_at: new Date().toISOString(),
        },
      };

      tasks.set(taskId, canceled);
      return canceled;
    },

    async subscribe(taskId) {
      const existing = tasks.get(taskId);
      return {
        task_id: taskId,
        subscribed: Boolean(existing),
        ...(existing ? { state: existing.state } : {}),
      };
    },
  },
});

agent.listen();
