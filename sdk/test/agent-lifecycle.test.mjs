import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent, CKP_ERROR_CODES } from '../dist/index.js';

function createMockTransport() {
  return {
    messages: [],
    _handler: null,
    onMessage(handler) {
      this._handler = handler;
    },
    send(payload) {
      this.messages.push(payload);
    },
    close() {},
  };
}

test('agent rejects READY-only method before initialize', () => {
  const agent = new Agent({ name: 'test-agent', version: '1.0.0', heartbeatInterval: 0 });
  const transport = createMockTransport();
  agent.transport = transport;

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'claw.status',
    params: {},
  }));

  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_REQUEST);
  agent.close();
});

test('agent initializes and then serves status', () => {
  const agent = new Agent({ name: 'test-agent', version: '1.0.0', heartbeatInterval: 0 });
  const transport = createMockTransport();
  agent.transport = transport;

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'claw.initialize',
    params: { protocolVersion: '0.2.0' },
  }));

  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0].result.protocolVersion, '0.2.0');
  assert.equal(transport.messages[0].result.agentInfo.name, 'test-agent');

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'claw.status',
    params: {},
  }));

  assert.equal(transport.messages.length, 2);
  assert.equal(transport.messages[1].result.state, 'READY');
  agent.close();
});

test('agent rejects non-object params and unknown methods', () => {
  const agent = new Agent({ name: 'test-agent', version: '1.0.0', heartbeatInterval: 0 });
  const transport = createMockTransport();
  agent.transport = transport;

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    method: 'claw.initialize',
    params: [],
  }));

  assert.equal(transport.messages[0].error.code, CKP_ERROR_CODES.INVALID_PARAMS);

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 5,
    method: 'claw.initialize',
    params: { protocolVersion: '0.2.0' },
  }));

  agent.handleMessage(JSON.stringify({
    jsonrpc: '2.0',
    id: 6,
    method: 'claw.unknown',
    params: {},
  }));

  assert.equal(transport.messages[2].error.code, CKP_ERROR_CODES.METHOD_NOT_FOUND);
  agent.close();
});
