import test from "node:test";
import assert from "node:assert/strict";
import { Agent, CKP_ERROR_CODES } from "../dist/index.js";

/** Canonical spec-compliant initialize params (all 4 REQUIRED fields per §9.3.1). */
const INIT_PARAMS = {
  protocolVersion: "0.3.0",
  clientInfo: { name: "test-operator", version: "1.0.0" },
  manifest: { kind: "Claw", metadata: { name: "test" }, spec: {} },
  capabilities: {},
};

function createMockTransport() {
  const state = {
    messages: [],
    handler: null,
  };

  return {
    messages: state.messages,
    onMessage(handler) {
      state.handler = handler;
    },
    send(payload) {
      state.messages.push(payload);
    },
    close() {},
    emit(raw) {
      if (state.handler) state.handler(raw);
    },
  };
}

test("agent rejects READY-only method before initialize", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.status",
      params: {},
    }),
  );

  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_REQUEST);
  agent.close();
});

test("agent initializes and then serves status", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "claw.initialize",
      params: INIT_PARAMS,
    }),
  );

  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0].result.protocolVersion, "0.3.0");
  assert.equal(transport.messages[0].result.agentInfo.name, "test-agent");

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "claw.status",
      params: {},
    }),
  );

  assert.equal(transport.messages.length, 2);
  assert.equal(transport.messages[1].result.state, "READY");
  agent.close();
});

test("agent rejects non-object params and unknown methods", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
  });
  agent.listen();

  // Array params → -32602 (caught by envelope validator before handleInitialize)
  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "claw.initialize",
      params: [],
    }),
  );

  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);

  // Proper initialize with all 4 required params
  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "claw.initialize",
      params: INIT_PARAMS,
    }),
  );

  // Unknown method → -32601
  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "claw.unknown",
      params: {},
    }),
  );

  assert.equal(transport.messages[2].error.code, CKP_ERROR_CODES.METHOD_NOT_FOUND);
  agent.close();
});

test("agent rejects initialize with missing clientInfo", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: { protocolVersion: "0.3.0" },
    }),
  );

  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);
  assert.match(transport.messages[0].error.message, /clientInfo/);
  agent.close();
});

test("agent returns version mismatch with data.supported", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: {
        ...INIT_PARAMS,
        protocolVersion: "9.0.0",
      },
    }),
  );

  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.PROTOCOL_VERSION_NOT_SUPPORTED);
  assert.ok(Array.isArray(transport.messages[0].error.data.supported));
  assert.ok(transport.messages[0].error.data.supported.includes("0.3.0"));
  agent.close();
});

test("agent returns capabilities reflecting configured handlers", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
    tools: {
      echo: {
        execute: async (args) => ({
          content: [{ type: "text", text: String(args.text ?? "") }],
        }),
      },
    },
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: INIT_PARAMS,
    }),
  );

  const caps = transport.messages[0].result.capabilities;
  assert.ok("tools" in caps, "capabilities should include tools for L2 agent");
  assert.equal(transport.messages[0].result.conformanceLevel, "level-2");
  agent.close();
});

test("agent returns only requested capability groups when request is restricted", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
    tools: {
      echo: {
        execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
      },
    },
    memory: {
      store: async () => ({ stored: 1, ids: ["m1"] }),
      query: async () => ({ entries: [] }),
      compact: async () => ({ entries_before: 1, entries_after: 1 }),
    },
    swarm: {
      delegate: async () => ({ acknowledged: true }),
      discover: async () => ({ peers: [] }),
      report: async () => ({ acknowledged: true }),
      broadcast: async () => {},
    },
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: {
        ...INIT_PARAMS,
        capabilities: { memory: {} },
      },
    }),
  );

  assert.deepEqual(transport.messages[0].result.capabilities, { memory: {} });
  assert.equal(transport.messages[0].result.conformanceLevel, "level-3");
  agent.close();
});

test("agent returns all supported capability groups when request is unrestricted", () => {
  const transport = createMockTransport();
  const agent = new Agent({
    name: "test-agent",
    version: "1.0.0",
    heartbeatInterval: 0,
    transport,
    tools: {
      echo: {
        execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
      },
    },
    memory: {
      store: async () => ({ stored: 1, ids: ["m1"] }),
      query: async () => ({ entries: [] }),
      compact: async () => ({ entries_before: 1, entries_after: 1 }),
    },
    swarm: {
      delegate: async () => ({ acknowledged: true }),
      discover: async () => ({ peers: [] }),
      report: async () => ({ acknowledged: true }),
      broadcast: async () => {},
    },
  });
  agent.listen();

  transport.emit(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: INIT_PARAMS,
    }),
  );

  assert.deepEqual(transport.messages[0].result.capabilities, {
    tools: {},
    memory: {},
    swarm: {},
  });
  assert.equal(transport.messages[0].result.conformanceLevel, "level-3");
  agent.close();
});
