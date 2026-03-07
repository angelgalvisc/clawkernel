#!/usr/bin/env python3
"""
CKP L1 Reference Agent — Pure Python

Independent implementation of the CKP v0.2.0 L1 wire protocol using only the
Python standard library. Shares no code with the TypeScript SDK.

Transport: stdin/stdout (line-delimited JSON-RPC 2.0).
Conformance target: L1 CONFORMANT (13/13 vectors, 0 skips, 0 fails).

Methods:
  claw.initialize   (Operator → Agent, Request)
  claw.initialized  (Operator → Agent, Notification)
  claw.status       (Operator → Agent, Request)
  claw.shutdown     (Operator → Agent, Request)
  claw.heartbeat    (Agent → Operator, Notification)
"""

import json
import sys
import time
import threading
from datetime import datetime, timezone

# ── Constants ────────────────────────────────────────────────────────────────

PROTOCOL_VERSION = "0.2.0"
SUPPORTED_MAJOR = 0
HEARTBEAT_INTERVAL = 30.0

ERR_PARSE_ERROR = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_VERSION_MISMATCH = -32001

# ── Agent State ──────────────────────────────────────────────────────────────

state = "INIT"
init_time = None
heartbeat_timer = None
write_lock = threading.Lock()

def get_uptime_ms():
    if init_time is None:
        return 0
    return int((time.monotonic() - init_time) * 1000)

# ── JSON-RPC Helpers ─────────────────────────────────────────────────────────

def send(obj):
    """Write a JSON-RPC message to stdout (thread-safe)."""
    with write_lock:
        sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
        sys.stdout.flush()

def ok(msg_id, result):
    send({"jsonrpc": "2.0", "id": msg_id, "result": result})

def err(msg_id, code, message, data=None):
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    send({"jsonrpc": "2.0", "id": msg_id, "error": error})

# ── Heartbeat ────────────────────────────────────────────────────────────────

def start_heartbeat():
    global heartbeat_timer

    def beat():
        global heartbeat_timer
        if state == "READY":
            send({
                "jsonrpc": "2.0",
                "method": "claw.heartbeat",
                "params": {
                    "state": state,
                    "uptime_ms": get_uptime_ms(),
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                },
            })
            heartbeat_timer = threading.Timer(HEARTBEAT_INTERVAL, beat)
            heartbeat_timer.daemon = True
            heartbeat_timer.start()

    heartbeat_timer = threading.Timer(HEARTBEAT_INTERVAL, beat)
    heartbeat_timer.daemon = True
    heartbeat_timer.start()

def stop_heartbeat():
    global heartbeat_timer
    if heartbeat_timer is not None:
        heartbeat_timer.cancel()
        heartbeat_timer = None

# ── Method Handlers ──────────────────────────────────────────────────────────

def handle_initialize(msg_id, params):
    global state, init_time

    # Validate required params
    if (
        not isinstance(params.get("protocolVersion"), str)
        or "clientInfo" not in params
        or "manifest" not in params
        or "capabilities" not in params
    ):
        err(msg_id, ERR_INVALID_PARAMS,
            "Missing required initialize params (protocolVersion, clientInfo, manifest, capabilities)")
        return

    # Version negotiation: accept same major version
    parts = params["protocolVersion"].split(".")
    try:
        major = int(parts[0])
    except (ValueError, IndexError):
        major = -1

    if major != SUPPORTED_MAJOR:
        err(msg_id, ERR_VERSION_MISMATCH, "Protocol version not supported",
            {"supported": [PROTOCOL_VERSION]})
        return

    # Transition: INIT → STARTING → READY
    state = "STARTING"
    init_time = time.monotonic()
    state = "READY"

    ok(msg_id, {
        "protocolVersion": PROTOCOL_VERSION,
        "agentInfo": {"name": "ckp-python", "version": "0.1.0"},
        "conformanceLevel": "level-1",
        "capabilities": {"tools": {}, "swarm": {}, "memory": {}},
    })

def handle_initialized():
    if state == "READY":
        start_heartbeat()

def handle_status(msg_id):
    ok(msg_id, {"state": state, "uptime_ms": get_uptime_ms()})

def handle_shutdown(msg_id):
    global state
    stop_heartbeat()
    state = "STOPPING"
    ok(msg_id, {"drained": True})
    state = "STOPPED"
    # Do NOT call sys.exit() — harness may send more vectors.

# ── Request Router ───────────────────────────────────────────────────────────

def handle_line(raw):
    # 1. Parse JSON
    try:
        msg = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        err(None, ERR_PARSE_ERROR, "Parse error")
        return

    # 2. Validate JSON-RPC 2.0 envelope
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        err(None, ERR_INVALID_REQUEST, "Invalid request: missing or wrong jsonrpc field")
        return

    if not isinstance(msg.get("method"), str):
        msg_id = msg.get("id")
        err(msg_id, ERR_INVALID_REQUEST, "Invalid request: missing method field")
        return

    # 3. Route by method
    method = msg["method"]
    msg_id = msg.get("id")
    params = msg.get("params", {})

    if method == "claw.initialize":
        handle_initialize(msg_id, params)
    elif method == "claw.initialized":
        handle_initialized()
        # Notification — no response
    elif method == "claw.status":
        handle_status(msg_id)
    elif method == "claw.shutdown":
        handle_shutdown(msg_id)
    elif method == "claw.heartbeat":
        # Agent→Operator direction; silently accept if received as input
        pass
    else:
        err(msg_id, ERR_METHOD_NOT_FOUND, f"Method not found: {method}")

# ── Main Loop ────────────────────────────────────────────────────────────────

def main():
    try:
        for line in sys.stdin:
            trimmed = line.strip()
            if trimmed:
                handle_line(trimmed)
    except (EOFError, KeyboardInterrupt):
        pass
    finally:
        stop_heartbeat()

if __name__ == "__main__":
    main()
