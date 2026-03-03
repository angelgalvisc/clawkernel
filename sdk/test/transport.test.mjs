import test from "node:test";
import assert from "node:assert/strict";
import { createStdioTransport } from "../dist/transport.js";

test("stdio transport send does not throw when stdout.write fails", () => {
  const originalWrite = process.stdout.write;

  process.stdout.write = () => {
    throw new Error("EPIPE");
  };

  const transport = createStdioTransport();
  assert.doesNotThrow(() => {
    transport.send({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });

  transport.close();
  process.stdout.write = originalWrite;
});
