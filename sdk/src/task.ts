/**
 * @clawkernel/sdk — Task Executor (A2A interop)
 *
 * Dispatches claw.task.create/get/list/cancel/subscribe.
 */

import type { Transport } from "./transport.js";
import type {
  TaskHandler,
  TaskCreateParams,
  TaskListFilter,
  TaskState,
} from "./types.js";
import { sendOk, invalidParams, sendError } from "./errors.js";

function isTaskState(value: unknown): value is TaskState {
  return typeof value === "string" && [
    "submitted",
    "working",
    "input_required",
    "auth_required",
    "completed",
    "failed",
    "canceled",
    "rejected",
  ].includes(value);
}

export class TaskExecutor {
  private transport: Transport;
  private handler: TaskHandler;

  constructor(transport: Transport, handler: TaskHandler) {
    this.transport = transport;
    this.handler = handler;
  }

  async handleCreate(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    const message = (params.message && typeof params.message === "object" && !Array.isArray(params.message))
      ? params.message as TaskCreateParams["message"]
      : undefined;
    const messages = Array.isArray(params.messages)
      ? params.messages as TaskCreateParams["messages"]
      : undefined;
    const metadata = (params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata))
      ? params.metadata as Record<string, unknown>
      : undefined;

    if (!message && (!messages || messages.length === 0)) {
      invalidParams(this.transport, id, "Task creation requires message or messages");
      return;
    }

    try {
      const result = await this.handler.create({
        ...(taskId ? { task_id: taskId } : {}),
        ...(message ? { message } : {}),
        ...(messages ? { messages } : {}),
        ...(metadata ? { metadata } : {}),
      });

      if (!result || typeof result.task_id !== "string" || !isTaskState(result.state)) {
        sendError(this.transport, id, -32603, "Task create handler returned invalid task record");
        return;
      }

      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Task create error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleGet(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }

    try {
      const result = await this.handler.get(taskId);
      if (!result) {
        invalidParams(this.transport, id, `Unknown task_id: ${taskId}`);
        return;
      }
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Task get error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleList(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const state = isTaskState(params.state) ? params.state : undefined;
    const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
    const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.floor(params.limit))
      : undefined;

    try {
      const filter: TaskListFilter = {
        ...(state ? { state } : {}),
        ...(cursor ? { cursor } : {}),
        ...(limit ? { limit } : {}),
      };
      const tasks = await this.handler.list(filter);
      sendOk(this.transport, id, { tasks });
    } catch (err) {
      sendError(this.transport, id, -32603, `Task list error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleCancel(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    const reason = typeof params.reason === "string" ? params.reason : undefined;

    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }

    try {
      const result = await this.handler.cancel(taskId, reason);
      if (!result) {
        invalidParams(this.transport, id, `Unknown task_id: ${taskId}`);
        return;
      }
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Task cancel error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleSubscribe(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }

    try {
      const result = await this.handler.subscribe(taskId);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Task subscribe error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
