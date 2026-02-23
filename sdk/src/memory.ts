/**
 * @clawkernel/sdk — Memory Executor
 *
 * Dispatches claw.memory.store, claw.memory.query, claw.memory.compact.
 */

import type { Transport } from "./transport.js";
import type { MemoryHandler, MemoryEntry, MemoryQuery } from "./types.js";
import { sendOk, invalidParams, sendError } from "./errors.js";

export class MemoryExecutor {
  private transport: Transport;
  private handler: MemoryHandler;

  constructor(transport: Transport, handler: MemoryHandler) {
    this.transport = transport;
    this.handler = handler;
  }

  async handleStore(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const store = params.store as string | undefined;
    const entries = params.entries as MemoryEntry[] | undefined;

    if (!store) {
      invalidParams(this.transport, id, "Missing store name");
      return;
    }
    if (!entries || !Array.isArray(entries)) {
      invalidParams(this.transport, id, "Missing or invalid entries");
      return;
    }

    try {
      const result = await this.handler.store(store, entries);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Memory store error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleQuery(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const store = params.store as string | undefined;
    const query = params.query as MemoryQuery | undefined;

    if (!store) {
      invalidParams(this.transport, id, "Missing store name");
      return;
    }
    if (!query) {
      invalidParams(this.transport, id, "Missing query");
      return;
    }

    try {
      const result = await this.handler.query(store, query);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Memory query error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleCompact(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const store = params.store as string | undefined;

    if (!store) {
      invalidParams(this.transport, id, "Missing store name");
      return;
    }

    try {
      const result = await this.handler.compact(store);
      sendOk(this.transport, id, result);
    } catch (err) {
      sendError(this.transport, id, -32603, `Memory compact error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
