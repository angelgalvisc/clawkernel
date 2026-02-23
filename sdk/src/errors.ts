/**
 * @clawkernel/sdk — Error Helpers
 *
 * JSON-RPC 2.0 response builders for all 11 CKP error codes.
 */

import type { Transport } from "./transport.js";
import { CKP_ERROR_CODES } from "./types.js";

// ── Custom Error Classes ──────────────────────────────────────────────────

/** Thrown when a tool execution exceeds its timeout_ms. */
export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
  }
}

// ── Generic Builders ───────────────────────────────────────────────────────

export function sendOk(transport: Transport, id: string | number | null, result: unknown): void {
  transport.send({ jsonrpc: "2.0", id, result });
}

export function sendError(
  transport: Transport,
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): void {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  transport.send({ jsonrpc: "2.0", id, error });
}

// ── Convenience Helpers ────────────────────────────────────────────────────

export function parseError(transport: Transport): void {
  sendError(transport, null, CKP_ERROR_CODES.PARSE_ERROR, "Parse error");
}

export function invalidRequest(transport: Transport, id: string | number | null): void {
  sendError(transport, id, CKP_ERROR_CODES.INVALID_REQUEST, "Invalid request");
}

export function methodNotFound(transport: Transport, id: string | number | null, method?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found${method ? `: ${method}` : ""}`);
}

export function invalidParams(transport: Transport, id: string | number | null, msg?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.INVALID_PARAMS, msg ?? "Invalid params");
}

export function versionMismatch(transport: Transport, id: string | number | null): void {
  sendError(transport, id, CKP_ERROR_CODES.PROTOCOL_VERSION_NOT_SUPPORTED, "Protocol version not supported");
}

export function sandboxDenied(transport: Transport, id: string | number | null, msg?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.SANDBOX_DENIED, msg ?? "Sandbox denied");
}

export function policyDenied(transport: Transport, id: string | number | null, msg?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.POLICY_DENIED, msg ?? "Policy denied");
}

export function approvalTimeout(transport: Transport, id: string | number | null): void {
  sendError(transport, id, CKP_ERROR_CODES.APPROVAL_TIMEOUT, "Approval timeout");
}

export function approvalDenied(transport: Transport, id: string | number | null, reason?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.APPROVAL_DENIED, reason ?? "Approval denied");
}

export function toolTimeout(transport: Transport, id: string | number | null, toolName?: string): void {
  sendError(transport, id, CKP_ERROR_CODES.TOOL_EXECUTION_TIMEOUT, `Tool execution timeout${toolName ? `: ${toolName}` : ""}`);
}

export function quotaExceeded(transport: Transport, id: string | number | null): void {
  sendError(transport, id, CKP_ERROR_CODES.PROVIDER_QUOTA_EXCEEDED, "Provider quota exceeded");
}
