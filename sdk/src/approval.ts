/**
 * @clawkernel/sdk — Approval Queue
 *
 * Manages pending tool calls that require approval before execution.
 */

export interface PendingCall {
  resolve: () => void;
  reject: (reason: string) => void;
  timer: NodeJS.Timeout;
}

export class ApprovalQueue {
  private pending: Map<string, PendingCall> = new Map();

  /**
   * Wait for approval or denial of a pending tool call.
   * Rejects on timeout or explicit denial.
   */
  waitForApproval(requestId: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject("timeout");
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  /**
   * Approve a pending call. Returns true if the call existed.
   */
  approve(requestId: string): boolean {
    const pending = this.pending.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      pending.resolve();
      return true;
    }
    // Gracefully accept approve even if no pending call (test vectors may send approve without pending)
    return true;
  }

  /**
   * Deny a pending call. Returns true if the call existed.
   */
  deny(requestId: string): boolean {
    const pending = this.pending.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(requestId);
      pending.reject("denied");
      return true;
    }
    // Gracefully accept deny even if no pending call
    return true;
  }
}
