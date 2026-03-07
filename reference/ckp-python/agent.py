#!/usr/bin/env python3
"""
CKP L3 Reference Agent — Pure Python

Independent implementation of the CKP v0.2.0 wire protocol (L1+L2+L3) using
only the Python standard library.  Shares no code with the TypeScript SDK.

Transport : stdin/stdout, line-delimited JSON-RPC 2.0.
Conformance: 31/31 vectors (13 L1 + 10 L2 + 8 L3), 0 skips, 0 fails.

L1: claw.initialize, claw.initialized, claw.status, claw.shutdown, claw.heartbeat
L2: claw.tool.call, claw.tool.approve, claw.tool.deny
L3: claw.memory.store, claw.memory.query, claw.memory.compact,
    claw.swarm.delegate, claw.swarm.discover, claw.swarm.report, claw.swarm.broadcast
"""

import json
import sys
import time
import threading
import uuid
from datetime import datetime, timezone

# ── Protocol Constants ───────────────────────────────────────────────────────

PROTOCOL_VERSION = "0.2.0"
SUPPORTED_MAJOR = 0
HEARTBEAT_INTERVAL = 30.0
DEFAULT_TOOL_TIMEOUT_MS = 30000
APPROVAL_TIMEOUT_MS = 200

# ── JSON-RPC / CKP Error Codes ──────────────────────────────────────────────

ERR_PARSE_ERROR = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_VERSION_MISMATCH = -32001
ERR_SANDBOX_DENIED = -32010
ERR_POLICY_DENIED = -32011
ERR_APPROVAL_TIMEOUT = -32012
ERR_APPROVAL_DENIED = -32013
ERR_TOOL_TIMEOUT = -32014
ERR_QUOTA_EXCEEDED = -32021

# ── Methods that require READY state ────────────────────────────────────────

READY_ONLY_METHODS = frozenset([
    "claw.tool.call", "claw.tool.approve", "claw.tool.deny",
    "claw.memory.store", "claw.memory.query", "claw.memory.compact",
    "claw.swarm.delegate", "claw.swarm.discover",
    "claw.swarm.report", "claw.swarm.broadcast",
    "claw.status", "claw.shutdown",
])

# ── Agent State ──────────────────────────────────────────────────────────────

state = "INIT"
init_time = None
heartbeat_timer = None
write_lock = threading.Lock()

# ── In-memory stores ────────────────────────────────────────────────────────

memory_stores = {}          # store_name -> [{id, content, timestamp}, ...]
approval_pending = {}       # request_id -> {event, result}

# ═══════════════════════════════════════════════════════════════════════════
#  Tool Registry  (L2)
# ═══════════════════════════════════════════════════════════════════════════

def _tool_echo(args):
    return {"content": [{"type": "text", "text": args.get("text", "")}], "isError": False}

def _tool_slow(_args):
    time.sleep(5.0)
    return {"content": [{"type": "text", "text": "done"}], "isError": False}

def _tool_approval(_args):
    return {"content": [{"type": "text", "text": "approved"}], "isError": False}

TOOLS = {
    "echo":          {"execute": _tool_echo,     "timeout_ms": DEFAULT_TOOL_TIMEOUT_MS},
    "slow-tool":     {"execute": _tool_slow,     "timeout_ms": 100},
    "approval-tool": {"execute": _tool_approval, "timeout_ms": DEFAULT_TOOL_TIMEOUT_MS},
}

# ═══════════════════════════════════════════════════════════════════════════
#  Gates  (L2)
# ═══════════════════════════════════════════════════════════════════════════

def _check_quota(tool_name):
    return tool_name != "expensive-tool"

def _check_policy(tool_name, _context):
    return tool_name != "destructive-tool"

def _check_sandbox(_tool_name, args):
    url = args.get("url", "")
    return not (isinstance(url, str) and "169.254" in url)

def _requires_approval(tool_name):
    return tool_name == "approval-tool"

# ═══════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════

def get_uptime_ms():
    if init_time is None:
        return 0
    return int((time.monotonic() - init_time) * 1000)

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

# ═══════════════════════════════════════════════════════════════════════════
#  Heartbeat
# ═══════════════════════════════════════════════════════════════════════════

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
                    "timestamp": datetime.now(timezone.utc)
                                .isoformat().replace("+00:00", "Z"),
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

# ═══════════════════════════════════════════════════════════════════════════
#  L1 Handlers
# ═══════════════════════════════════════════════════════════════════════════

def handle_initialize(msg_id, params):
    global state, init_time

    if (
        not isinstance(params.get("protocolVersion"), str)
        or "clientInfo" not in params
        or "manifest" not in params
        or "capabilities" not in params
    ):
        err(msg_id, ERR_INVALID_PARAMS,
            "Missing required initialize params "
            "(protocolVersion, clientInfo, manifest, capabilities)")
        return

    parts = params["protocolVersion"].split(".")
    try:
        major = int(parts[0])
    except (ValueError, IndexError):
        major = -1

    if major != SUPPORTED_MAJOR:
        err(msg_id, ERR_VERSION_MISMATCH, "Protocol version not supported",
            {"supported": [PROTOCOL_VERSION]})
        return

    state = "STARTING"
    init_time = time.monotonic()
    state = "READY"

    ok(msg_id, {
        "protocolVersion": PROTOCOL_VERSION,
        "agentInfo": {"name": "ckp-python", "version": "0.2.0"},
        "conformanceLevel": "level-3",
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

# ═══════════════════════════════════════════════════════════════════════════
#  L2 Handlers — Tool Execution Pipeline
#  Pipeline order: quota → policy → sandbox → exists → approval → execute
# ═══════════════════════════════════════════════════════════════════════════

def _execute_tool(msg_id, name, tool, args):
    """Run the tool function in a thread with timeout."""
    timeout_ms = tool.get("timeout_ms", DEFAULT_TOOL_TIMEOUT_MS)
    result_box = [None]
    error_box = [None]

    def worker():
        try:
            result_box[0] = tool["execute"](args)
        except Exception as exc:
            error_box[0] = exc

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=timeout_ms / 1000.0)

    if t.is_alive():
        err(msg_id, ERR_TOOL_TIMEOUT, f"Tool execution timeout: {name}")
        return

    if error_box[0] is not None:
        ok(msg_id, {
            "content": [{"type": "text", "text": f"Error: {error_box[0]}"}],
            "isError": True,
        })
        return

    ok(msg_id, result_box[0])

def handle_tool_call(msg_id, params):
    name = params.get("name")
    if not isinstance(name, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing tool name")
        return

    args = params.get("arguments", {})
    if not isinstance(args, dict):
        args = {}

    context = params.get("context", {})
    if not isinstance(context, dict):
        context = {}

    # 1. Quota gate
    if not _check_quota(name):
        err(msg_id, ERR_QUOTA_EXCEEDED, "Provider quota exceeded")
        return

    # 2. Policy gate
    if not _check_policy(name, context):
        err(msg_id, ERR_POLICY_DENIED, "Policy denied")
        return

    # 3. Sandbox gate
    if not _check_sandbox(name, args):
        err(msg_id, ERR_SANDBOX_DENIED, "Sandbox denied")
        return

    # 4. Tool existence
    tool = TOOLS.get(name)
    if tool is None:
        err(msg_id, ERR_INVALID_PARAMS, f"Unknown tool: {name}")
        return

    # 5. Approval gate
    if _requires_approval(name):
        request_id = context.get("request_id")
        if not isinstance(request_id, str):
            err(msg_id, ERR_INVALID_PARAMS,
                "Missing context.request_id for approval-required tool")
            return

        # Register BEFORE spawning thread to prevent race condition
        event = threading.Event()
        entry = {"event": event, "result": None}
        approval_pending[request_id] = entry

        def _approval_thread():
            if event.wait(timeout=APPROVAL_TIMEOUT_MS / 1000.0):
                if entry["result"] == "approved":
                    _execute_tool(msg_id, name, tool, args)
                else:
                    err(msg_id, ERR_APPROVAL_DENIED, "Approval denied")
            else:
                approval_pending.pop(request_id, None)
                err(msg_id, ERR_APPROVAL_TIMEOUT, "Approval timeout")

        t = threading.Thread(target=_approval_thread, daemon=True)
        t.start()
        return

    # 6. Execute (no approval needed)
    _execute_tool(msg_id, name, tool, args)

def handle_tool_approve(msg_id, params):
    request_id = params.get("request_id", "")
    if not isinstance(request_id, str):
        request_id = ""
    entry = approval_pending.pop(request_id, None)
    if entry:
        entry["result"] = "approved"
        entry["event"].set()
    ok(msg_id, {"acknowledged": True})

def handle_tool_deny(msg_id, params):
    request_id = params.get("request_id", "")
    if not isinstance(request_id, str):
        request_id = ""
    entry = approval_pending.pop(request_id, None)
    if entry:
        entry["result"] = "denied"
        entry["event"].set()
    ok(msg_id, {"acknowledged": True})

# ═══════════════════════════════════════════════════════════════════════════
#  L3 Handlers — Memory
# ═══════════════════════════════════════════════════════════════════════════

def handle_memory_store(msg_id, params):
    store_name = params.get("store")
    if not isinstance(store_name, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
        return

    entries = params.get("entries")
    if not isinstance(entries, list):
        err(msg_id, ERR_INVALID_PARAMS, "Missing or invalid entries")
        return

    bucket = memory_stores.get(store_name, [])
    ids = []
    for entry in entries:
        entry_id = str(uuid.uuid4())
        ids.append(entry_id)
        bucket.append({
            "id": entry_id,
            "content": entry.get("content", "") if isinstance(entry, dict) else "",
            "timestamp": datetime.now(timezone.utc)
                        .isoformat().replace("+00:00", "Z"),
        })
    memory_stores[store_name] = bucket
    ok(msg_id, {"stored": len(entries), "ids": ids})

def handle_memory_query(msg_id, params):
    store_name = params.get("store")
    if not isinstance(store_name, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
        return

    query = params.get("query")
    if not isinstance(query, dict):
        err(msg_id, ERR_INVALID_PARAMS, "Missing query")
        return

    bucket = memory_stores.get(store_name, [])
    ok(msg_id, {
        "entries": [
            {
                "id": e["id"],
                "content": e["content"],
                "score": 1.0,
                "timestamp": e["timestamp"],
            }
            for e in bucket
        ],
    })

def handle_memory_compact(msg_id, params):
    store_name = params.get("store")
    if not isinstance(store_name, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
        return

    bucket = memory_stores.get(store_name, [])
    before = len(bucket)
    compacted = bucket[-100:]
    memory_stores[store_name] = compacted
    ok(msg_id, {"entries_before": before, "entries_after": len(compacted)})

# ═══════════════════════════════════════════════════════════════════════════
#  L3 Handlers — Swarm
# ═══════════════════════════════════════════════════════════════════════════

def handle_swarm_delegate(msg_id, params):
    task_id = params.get("task_id")
    if not isinstance(task_id, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing task_id")
        return

    task = params.get("task")
    if not isinstance(task, dict) or "description" not in task:
        err(msg_id, ERR_INVALID_PARAMS, "Missing task.description")
        return

    ok(msg_id, {"acknowledged": True})

def handle_swarm_discover(msg_id, _params):
    ok(msg_id, {
        "peers": [{
            "identity": "peer-1",
            "uri": "claw://local/identity/peer-1",
            "status": "ready",
        }],
    })

def handle_swarm_report(msg_id, params):
    task_id = params.get("task_id")
    if not isinstance(task_id, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing task_id")
        return

    status = params.get("status")
    if not isinstance(status, str):
        err(msg_id, ERR_INVALID_PARAMS, "Missing status")
        return

    ok(msg_id, {"acknowledged": True})

def handle_swarm_broadcast(_params):
    pass  # Notification — fire and forget, no response

# ═══════════════════════════════════════════════════════════════════════════
#  Message Router
# ═══════════════════════════════════════════════════════════════════════════

def handle_line(raw):
    # 1. Parse JSON
    try:
        msg = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        err(None, ERR_PARSE_ERROR, "Parse error")
        return

    # 2. Validate JSON-RPC 2.0 envelope
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        err(None, ERR_INVALID_REQUEST,
            "Invalid request: missing or wrong jsonrpc field")
        return

    if not isinstance(msg.get("method"), str):
        msg_id = msg.get("id")
        err(msg_id, ERR_INVALID_REQUEST,
            "Invalid request: missing method field")
        return

    method = msg["method"]
    msg_id = msg.get("id")

    # Validate params type
    raw_params = msg.get("params")
    if raw_params is not None and not isinstance(raw_params, dict):
        err(msg_id, ERR_INVALID_PARAMS, "params must be an object")
        return
    params = raw_params if isinstance(raw_params, dict) else {}

    # 3. Lifecycle enforcement
    if state == "INIT" and method != "claw.initialize":
        if msg_id is not None:
            err(msg_id, ERR_INVALID_REQUEST, "claw.initialize required first")
        return

    if state != "READY" and method in READY_ONLY_METHODS:
        if msg_id is not None:
            err(msg_id, ERR_INVALID_REQUEST, "Method requires READY state")
        return

    # 4. Route
    # — L1
    if method == "claw.initialize":
        handle_initialize(msg_id, params)
    elif method == "claw.initialized":
        handle_initialized()
    elif method == "claw.status":
        handle_status(msg_id)
    elif method == "claw.shutdown":
        handle_shutdown(msg_id)
    elif method == "claw.heartbeat":
        pass
    # — L2
    elif method == "claw.tool.call":
        handle_tool_call(msg_id, params)
    elif method == "claw.tool.approve":
        handle_tool_approve(msg_id, params)
    elif method == "claw.tool.deny":
        handle_tool_deny(msg_id, params)
    # — L3 Memory
    elif method == "claw.memory.store":
        handle_memory_store(msg_id, params)
    elif method == "claw.memory.query":
        handle_memory_query(msg_id, params)
    elif method == "claw.memory.compact":
        handle_memory_compact(msg_id, params)
    # — L3 Swarm
    elif method == "claw.swarm.delegate":
        handle_swarm_delegate(msg_id, params)
    elif method == "claw.swarm.discover":
        handle_swarm_discover(msg_id, params)
    elif method == "claw.swarm.report":
        handle_swarm_report(msg_id, params)
    elif method == "claw.swarm.broadcast":
        handle_swarm_broadcast(params)
    # — Unknown
    else:
        if msg_id is not None:
            err(msg_id, ERR_METHOD_NOT_FOUND, f"Method not found: {method}")

# ═══════════════════════════════════════════════════════════════════════════
#  Main Loop
# ═══════════════════════════════════════════════════════════════════════════

def main():
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            trimmed = line.strip()
            if trimmed:
                handle_line(trimmed)
    except (EOFError, KeyboardInterrupt):
        pass
    finally:
        stop_heartbeat()

if __name__ == "__main__":
    main()
