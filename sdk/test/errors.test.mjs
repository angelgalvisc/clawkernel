import test from "node:test";
import assert from "node:assert/strict";
import {
  sendOk,
  sendError,
  parseError,
  invalidRequest,
  methodNotFound,
  invalidParams,
  ToolTimeoutError,
  CKP_ERROR_CODES,
} from "../dist/index.js";

function createMockTransport() {
  return {
    messages: [],
    send(payload) {
      this.messages.push(payload);
    },
  };
}

test("sendOk emits JSON-RPC result envelope", () => {
  const t = createMockTransport();
  sendOk(t, 1, { ok: true });
  assert.equal(t.messages.length, 1);
  assert.deepEqual(t.messages[0], { jsonrpc: "2.0", id: 1, result: { ok: true } });
});

test("sendError emits JSON-RPC error envelope with data", () => {
  const t = createMockTransport();
  sendError(t, "abc", -32011, "Policy denied", { reason: "blocked" });
  assert.equal(t.messages.length, 1);
  assert.deepEqual(t.messages[0], {
    jsonrpc: "2.0",
    id: "abc",
    error: { code: -32011, message: "Policy denied", data: { reason: "blocked" } },
  });
});

test("helper functions map to canonical CKP codes", () => {
  const t = createMockTransport();
  parseError(t);
  invalidRequest(t, 10);
  methodNotFound(t, 11, "claw.unknown");
  invalidParams(t, 12, "bad params");

  const codes = t.messages.map((m) => m.error.code);
  assert.deepEqual(codes, [
    CKP_ERROR_CODES.PARSE_ERROR,
    CKP_ERROR_CODES.INVALID_REQUEST,
    CKP_ERROR_CODES.METHOD_NOT_FOUND,
    CKP_ERROR_CODES.INVALID_PARAMS,
  ]);
});

test("ToolTimeoutError carries stable type and message", () => {
  const err = new ToolTimeoutError("slow-tool", 5000);
  assert.equal(err.name, "ToolTimeoutError");
  assert.match(err.message, /slow-tool/);
  assert.match(err.message, /5000ms/);
});
