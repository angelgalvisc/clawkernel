/**
 * @clawkernel/sdk — Tool Executor
 *
 * Dispatches claw.tool.call with pipeline: quota → policy → sandbox → approval → execute.
 */

import type { Transport } from "./transport.js";
import type { AgentOptions } from "./types.js";
import { sendOk, invalidParams, policyDenied, sandboxDenied, quotaExceeded, toolTimeout, approvalTimeout, approvalDenied, sendError } from "./errors.js";
import { CKP_ERROR_CODES } from "./types.js";
import { ApprovalQueue } from "./approval.js";

export class ToolExecutor {
  private transport: Transport;
  private options: AgentOptions;
  private approvalQueue: ApprovalQueue = new ApprovalQueue();

  constructor(transport: Transport, options: AgentOptions) {
    this.transport = transport;
    this.options = options;
  }

  async handleToolCall(id: string | number | null, params: Record<string, unknown>): Promise<void> {
    const name = params.name as string | undefined;
    const args = (params.arguments as Record<string, unknown>) ?? {};
    const context = (params.context as Record<string, unknown>) ?? {};

    if (!name) {
      invalidParams(this.transport, id, "Missing tool name");
      return;
    }

    // Quota check (runs before tool existence — quota applies to all calls)
    if (this.options.quota) {
      const result = this.options.quota.check(name);
      if (!result.allowed) {
        quotaExceeded(this.transport, id);
        return;
      }
    }

    // Policy check (runs before tool existence — policy blocks denied tools)
    if (this.options.policy) {
      const result = this.options.policy.evaluate(name, context);
      if (!result.allowed) {
        policyDenied(this.transport, id, result.message);
        return;
      }
    }

    // Sandbox check (runs before tool existence — sandbox blocks denied calls)
    if (this.options.sandbox) {
      const result = this.options.sandbox.check(name, args);
      if (!result.allowed) {
        sandboxDenied(this.transport, id, result.message);
        return;
      }
    }

    // Check if tool exists (after gates — unknown tool = -32602)
    const tool = this.options.tools?.[name];
    if (!tool) {
      invalidParams(this.transport, id, `Unknown tool: ${name}`);
      return;
    }

    // Approval gate
    if (this.options.approval?.required(name)) {
      const requestId = context.request_id as string;
      try {
        await this.approvalQueue.waitForApproval(requestId, this.options.approval.timeout_ms);
      } catch (reason) {
        if (reason === "timeout") {
          approvalTimeout(this.transport, id);
        } else {
          approvalDenied(this.transport, id, String(reason));
        }
        return;
      }
    }

    // Execute with timeout
    const timeoutMs = tool.timeout_ms ?? 30000;
    try {
      const result = await Promise.race([
        tool.execute(args),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TOOL_TIMEOUT")), timeoutMs),
        ),
      ]);

      sendOk(this.transport, id, result);
    } catch (err) {
      if (err instanceof Error && err.message === "TOOL_TIMEOUT") {
        toolTimeout(this.transport, id, name);
      } else {
        sendOk(this.transport, id, {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }
  }

  handleApprove(id: string | number | null, params: Record<string, unknown>): void {
    const requestId = params.request_id as string;
    this.approvalQueue.approve(requestId ?? "");
    sendOk(this.transport, id, { acknowledged: true });
  }

  handleDeny(id: string | number | null, params: Record<string, unknown>): void {
    const requestId = params.request_id as string;
    this.approvalQueue.deny(requestId ?? "");
    sendOk(this.transport, id, { acknowledged: true });
  }
}
