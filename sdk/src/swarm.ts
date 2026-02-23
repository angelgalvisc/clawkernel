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
    const taskId = params.task_id as string | undefined;
    const task = params.task as SwarmTask | undefined;
    const context = params.context as SwarmContext | undefined;

    if (!taskId) {
      invalidParams(this.transport, id, "Missing task_id");
      return;
    }
    if (!task?.description) {
      invalidParams(this.transport, id, "Missing task.description");
      return;
    }

    try {
      const result = await this.handler.delegate(taskId, task, context ?? { request_id: "", swarm: "" });
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Swarm delegate error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleDiscover(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const swarmName = params.swarm as string | undefined;

    try {
      const result = await this.handler.discover(swarmName);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Swarm discover error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleReport(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const taskId = params.task_id as string | undefined;
    const status = params.status as string | undefined;
    const result = (params.result as Record<string, unknown>) ?? {};

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
    const swarmName = params.swarm as string | undefined;
    const message = (params.message as Record<string, unknown>) ?? {};

    // Notification — no response. Fire and forget.
    try {
      this.handler.broadcast(swarmName ?? "", message);
    } catch {
      // Notifications don't send error responses
    }
  }
}
