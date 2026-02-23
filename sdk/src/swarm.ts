/**
 * @clawkernel/sdk — Swarm Executor
 *
 * Dispatches claw.swarm.delegate, discover, report, broadcast.
 */

import type { Transport } from "./transport.js";
import type { SwarmHandler, SwarmTask, SwarmContext } from "./types.js";
import { sendOk, invalidParams, sendError } from "./errors.js";

export class SwarmExecutor {
  private transport: Transport;
  private handler: SwarmHandler;

  constructor(transport: Transport, handler: SwarmHandler) {
    this.transport = transport;
    this.handler = handler;
  }

  async handleDelegate(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    const rawTask = (params.task !== null && typeof params.task === "object" && !Array.isArray(params.task))
      ? params.task as SwarmTask
      : undefined;
    const context = (params.context !== null && typeof params.context === "object" && !Array.isArray(params.context))
      ? params.context as SwarmContext
      : undefined;

    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }
    if (!rawTask?.description) {
      invalidParams(this.transport, id, "Missing task.description");
      return;
    }

    try {
      const result = await this.handler.delegate(taskId, rawTask, context ?? { request_id: taskId, swarm: "default" });
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Swarm delegate error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleDiscover(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const swarmName = typeof params.swarm === "string" ? params.swarm : undefined;

    try {
      const result = await this.handler.discover(swarmName);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Swarm discover error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleReport(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = typeof params.task_id === "string" ? params.task_id : undefined;
    const status = typeof params.status === "string" ? params.status : undefined;
    const result = (params.result !== null && typeof params.result === "object" && !Array.isArray(params.result))
      ? params.result as Record<string, unknown>
      : {};

    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }
    if (!status) {
      invalidParams(this.transport, id, "Missing status");
      return;
    }

    try {
      const response = await this.handler.report(taskId, status, result);
      sendOk(this.transport, id, response);
    } catch (err) {
      sendError(this.transport, id, -32603, `Swarm report error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  handleBroadcast(params: Record<string, unknown>): void {
    const swarmName = typeof params.swarm === "string" ? params.swarm : "";
    const message = (params.message !== null && typeof params.message === "object" && !Array.isArray(params.message))
      ? params.message as Record<string, unknown>
      : {};

    // Notification — no response. Fire and forget.
    try {
      this.handler.broadcast(swarmName, message);
    } catch {
      // Notifications don't send error responses
    }
  }
}
