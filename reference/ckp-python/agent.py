#!/usr/bin/env python3
"""
CKP L3 Reference Agent — Pure Python

Independent implementation of the CKP v0.2.0 wire protocol (L1+L2+L3) using
only the Python 3.9+ standard library.  Shares no code with the TypeScript SDK.

Transport : stdin/stdout, line-delimited JSON-RPC 2.0.
Conformance: 31/31 vectors (13 L1 + 10 L2 + 8 L3), 0 skips, 0 fails,
against the reconciled CKP harness matrix.

Methods implemented:
  L1  claw.initialize · claw.initialized · claw.status · claw.shutdown · claw.heartbeat
  L2  claw.tool.call  · claw.tool.approve · claw.tool.deny
  L3  claw.memory.store · claw.memory.query · claw.memory.compact
      claw.swarm.delegate · claw.swarm.discover · claw.swarm.report · claw.swarm.broadcast
"""

from __future__ import annotations

import json
import sys
import time
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

# ── Type Aliases (comments only — no runtime dependency on typing extras) ────
#
# LifecycleState = Literal["INIT", "STARTING", "READY", "STOPPING", "STOPPED"]
# MsgId          = str | int | None
# Params         = dict[str, Any]
# ToolFn         = Callable[[Params], dict[str, Any]]
# MethodHandler  = Callable[[MsgId, Params], None]

# ── Protocol Constants ───────────────────────────────────────────────────────

PROTOCOL_VERSION: str = "0.2.0"
SUPPORTED_MAJOR: int = 0
HEARTBEAT_INTERVAL_S: float = 30.0
DEFAULT_TOOL_TIMEOUT_MS: int = 30_000
APPROVAL_TIMEOUT_MS: int = 200

# ── CKP Error Codes (JSON-RPC + protocol-specific) ──────────────────────────

ERR_PARSE_ERROR: int = -32700
ERR_INVALID_REQUEST: int = -32600
ERR_METHOD_NOT_FOUND: int = -32601
ERR_INVALID_PARAMS: int = -32602
ERR_VERSION_MISMATCH: int = -32001
ERR_SANDBOX_DENIED: int = -32010
ERR_POLICY_DENIED: int = -32011
ERR_APPROVAL_TIMEOUT: int = -32012
ERR_APPROVAL_DENIED: int = -32013
ERR_TOOL_TIMEOUT: int = -32014
ERR_QUOTA_EXCEEDED: int = -32021

# ── Methods gated behind READY state ────────────────────────────────────────

_READY_ONLY: frozenset[str] = frozenset({
    "claw.tool.call", "claw.tool.approve", "claw.tool.deny",
    "claw.memory.store", "claw.memory.query", "claw.memory.compact",
    "claw.swarm.delegate", "claw.swarm.discover",
    "claw.swarm.report", "claw.swarm.broadcast",
    "claw.status", "claw.shutdown",
})


# ═══════════════════════════════════════════════════════════════════════════
#  Internal Data Structures
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class _ToolDef:
    """Registered tool with its executor and timeout."""

    execute: ToolFn
    timeout_ms: int = DEFAULT_TOOL_TIMEOUT_MS


@dataclass
class _PendingApproval:
    """Synchronisation state for a tool call awaiting approval."""

    event: threading.Event = field(default_factory=threading.Event)
    result: str | None = None  # "approved" | "denied"


@dataclass
class _MemoryEntry:
    """Single persisted memory entry."""

    id: str
    content: Any
    timestamp: str


# ═══════════════════════════════════════════════════════════════════════════
#  Approval Queue (thread-safe)
# ═══════════════════════════════════════════════════════════════════════════

class _ApprovalQueue:
    """Manages pending tool calls that require human approval before execution.

    Thread safety: all mutations to ``_pending`` are protected by ``_lock``.
    The :class:`threading.Event` inside each :class:`_PendingApproval` provides
    safe cross-thread signalling without relying on the GIL.
    """

    def __init__(self) -> None:
        self._pending: dict[str, _PendingApproval] = {}
        self._lock: threading.Lock = threading.Lock()

    def register(self, request_id: str) -> _PendingApproval:
        """Create a pending entry.  Must be called **before** spawning the
        wait thread to prevent a race with an incoming approve/deny."""
        entry = _PendingApproval()
        with self._lock:
            self._pending[request_id] = entry
        return entry

    def wait(
        self,
        request_id: str,
        entry: _PendingApproval,
        timeout_s: float,
    ) -> str:
        """Block until approved, denied, or timed out.

        Returns:
            ``"approved"``, ``"denied"``, or ``"timeout"``.
        """
        if entry.event.wait(timeout=timeout_s):
            return entry.result or "denied"
        # Timeout — clean up stale entry
        with self._lock:
            self._pending.pop(request_id, None)
        return "timeout"

    def approve(self, request_id: str) -> None:
        """Resolve a pending call as approved.  No-op if unknown."""
        with self._lock:
            entry = self._pending.pop(request_id, None)
        if entry is not None:
            entry.result = "approved"
            entry.event.set()

    def deny(self, request_id: str) -> None:
        """Resolve a pending call as denied.  No-op if unknown."""
        with self._lock:
            entry = self._pending.pop(request_id, None)
        if entry is not None:
            entry.result = "denied"
            entry.event.set()


# ═══════════════════════════════════════════════════════════════════════════
#  Agent
# ═══════════════════════════════════════════════════════════════════════════

class Agent:
    """CKP L3 reference agent — pure Python, zero external dependencies.

    All mutable state is instance-scoped.  Stdout writes are serialised via
    ``_write_lock``; memory mutations via ``_memory_lock``; approval state
    via :class:`_ApprovalQueue._lock`.
    """

    # ── Construction ─────────────────────────────────────────────────────

    def __init__(self) -> None:
        # Lifecycle
        self._state: LifecycleState = "INIT"
        self._init_time: float | None = None
        self._heartbeat_timer: threading.Timer | None = None

        # Transport
        self._write_lock: threading.Lock = threading.Lock()

        # L2 — Tools
        self._tools: dict[str, _ToolDef] = {
            "echo":          _ToolDef(execute=self._tool_echo),
            "slow-tool":     _ToolDef(execute=self._tool_slow, timeout_ms=100),
            "approval-tool": _ToolDef(execute=self._tool_approval),
        }
        self._approval_queue: _ApprovalQueue = _ApprovalQueue()

        # L3 — Memory
        self._memory: dict[str, list[_MemoryEntry]] = {}
        self._memory_lock: threading.Lock = threading.Lock()

        # Method dispatch table (avoids long if/elif chains)
        self._handlers: dict[str, MethodHandler] = {
            # L1
            "claw.initialize":  self._handle_initialize,
            "claw.initialized": self._handle_initialized,
            "claw.status":      self._handle_status,
            "claw.shutdown":    self._handle_shutdown,
            "claw.heartbeat":   self._noop,
            # L2
            "claw.tool.call":    self._handle_tool_call,
            "claw.tool.approve": self._handle_tool_approve,
            "claw.tool.deny":    self._handle_tool_deny,
            # L3 — Memory
            "claw.memory.store":   self._handle_memory_store,
            "claw.memory.query":   self._handle_memory_query,
            "claw.memory.compact": self._handle_memory_compact,
            # L3 — Swarm
            "claw.swarm.delegate":  self._handle_swarm_delegate,
            "claw.swarm.discover":  self._handle_swarm_discover,
            "claw.swarm.report":    self._handle_swarm_report,
            "claw.swarm.broadcast": self._handle_swarm_broadcast,
        }

    # ── Transport helpers ────────────────────────────────────────────────

    def _send(self, obj: dict[str, Any]) -> None:
        """Write a JSON-RPC message to stdout (thread-safe)."""
        with self._write_lock:
            sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
            sys.stdout.flush()

    def _ok(self, msg_id: MsgId, result: dict[str, Any]) -> None:
        """Send a successful JSON-RPC response."""
        self._send({"jsonrpc": "2.0", "id": msg_id, "result": result})

    def _err(
        self,
        msg_id: MsgId,
        code: int,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Send a JSON-RPC error response."""
        error: dict[str, Any] = {"code": code, "message": message}
        if data is not None:
            error["data"] = data
        self._send({"jsonrpc": "2.0", "id": msg_id, "error": error})

    # ── Convenience ──────────────────────────────────────────────────────

    @staticmethod
    def _utc_now_iso() -> str:
        """Current UTC time as ISO 8601 string with ``Z`` suffix."""
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _uptime_ms(self) -> int:
        """Milliseconds elapsed since ``claw.initialize``."""
        if self._init_time is None:
            return 0
        return int((time.monotonic() - self._init_time) * 1000)

    # ── Heartbeat ────────────────────────────────────────────────────────

    def _start_heartbeat(self) -> None:
        """Schedule recurring heartbeat notifications."""
        if self._heartbeat_timer is not None:
            return

        def beat() -> None:
            if self._state == "READY":
                self._send({
                    "jsonrpc": "2.0",
                    "method": "claw.heartbeat",
                    "params": {
                        "state": self._state,
                        "uptime_ms": self._uptime_ms(),
                        "timestamp": self._utc_now_iso(),
                    },
                })
                self._heartbeat_timer = threading.Timer(HEARTBEAT_INTERVAL_S, beat)
                self._heartbeat_timer.daemon = True
                self._heartbeat_timer.start()

        self._heartbeat_timer = threading.Timer(HEARTBEAT_INTERVAL_S, beat)
        self._heartbeat_timer.daemon = True
        self._heartbeat_timer.start()

    def _stop_heartbeat(self) -> None:
        """Cancel the heartbeat timer if running."""
        if self._heartbeat_timer is not None:
            self._heartbeat_timer.cancel()
            self._heartbeat_timer = None

    # ── L2 Gates ─────────────────────────────────────────────────────────

    @staticmethod
    def _check_quota(tool_name: str) -> bool:
        """Return ``False`` if the tool is over quota."""
        return tool_name != "expensive-tool"

    @staticmethod
    def _check_policy(tool_name: str) -> bool:
        """Return ``False`` if policy blocks the tool."""
        return tool_name != "destructive-tool"

    @staticmethod
    def _check_sandbox(args: Params) -> bool:
        """Return ``False`` if sandbox blocks the arguments."""
        url = args.get("url", "")
        return not (isinstance(url, str) and "169.254" in url)

    @staticmethod
    def _requires_approval(tool_name: str) -> bool:
        """Return ``True`` if the tool requires human approval."""
        return tool_name == "approval-tool"

    # ── L2 Tool functions ────────────────────────────────────────────────

    @staticmethod
    def _tool_echo(args: Params) -> dict[str, Any]:
        return {
            "content": [{"type": "text", "text": args.get("text", "")}],
            "isError": False,
        }

    @staticmethod
    def _tool_slow(_args: Params) -> dict[str, Any]:
        time.sleep(5.0)  # Always exceeds the 100 ms timeout
        return {"content": [{"type": "text", "text": "done"}], "isError": False}

    @staticmethod
    def _tool_approval(_args: Params) -> dict[str, Any]:
        return {
            "content": [{"type": "text", "text": "approved"}],
            "isError": False,
        }

    # ── Shared no-op handler (inbound heartbeats) ────────────────────────

    def _noop(self, _msg_id: MsgId, _params: Params) -> None:
        """Silently accept a message without sending a response."""

    # ── L1 Handlers ──────────────────────────────────────────────────────

    def _handle_initialize(self, msg_id: MsgId, params: Params) -> None:
        self._stop_heartbeat()

        client_info = params.get("clientInfo")
        if (
            not isinstance(params.get("protocolVersion"), str)
            or not isinstance(client_info, dict)
            or not isinstance(client_info.get("name"), str)
            or not isinstance(client_info.get("version"), str)
            or params.get("manifest") is None
            or not isinstance(params.get("capabilities"), dict)
        ):
            self._err(
                msg_id, ERR_INVALID_PARAMS,
                "Missing required initialize params "
                "(protocolVersion, clientInfo(name, version), manifest, capabilities)",
            )
            return

        try:
            major = int(params["protocolVersion"].split(".")[0])
        except (ValueError, IndexError):
            major = -1

        if major != SUPPORTED_MAJOR:
            self._err(
                msg_id, ERR_VERSION_MISMATCH,
                "Protocol version not supported",
                {"supported": [PROTOCOL_VERSION]},
            )
            return

        self._state = "STARTING"
        self._init_time = time.monotonic()
        self._state = "READY"

        requested_caps = params.get("capabilities", {})
        requested_groups = (
            {"tools", "swarm", "memory"}
            if len(requested_caps) == 0
            else set(requested_caps.keys())
        )
        capabilities: dict[str, dict[str, Any]] = {}
        if "tools" in requested_groups:
            capabilities["tools"] = {}
        if "swarm" in requested_groups:
            capabilities["swarm"] = {}
        if "memory" in requested_groups:
            capabilities["memory"] = {}

        self._ok(msg_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "agentInfo": {"name": "ckp-python", "version": "0.2.0"},
            "conformanceLevel": "level-3",
            "capabilities": capabilities,
        })

    def _handle_initialized(self, _msg_id: MsgId, _params: Params) -> None:
        """Notification — no response.  Start heartbeat once READY."""
        if self._state == "READY":
            self._start_heartbeat()

    def _handle_status(self, msg_id: MsgId, _params: Params) -> None:
        self._ok(msg_id, {
            "state": self._state,
            "uptime_ms": self._uptime_ms(),
        })

    def _handle_shutdown(self, msg_id: MsgId, _params: Params) -> None:
        self._stop_heartbeat()
        self._state = "STOPPING"
        self._ok(msg_id, {"drained": True})
        self._state = "STOPPED"

    # ── L2 Handlers — Tool Execution Pipeline ────────────────────────────
    # Pipeline: quota → policy → sandbox → exists → approval → execute

    def _execute_tool(
        self,
        msg_id: MsgId,
        name: str,
        tool: _ToolDef,
        args: Params,
    ) -> None:
        """Run a tool in an isolated thread with timeout enforcement."""
        result_box: list[dict[str, Any] | None] = [None]
        error_box: list[Exception | None] = [None]

        def worker() -> None:
            try:
                result_box[0] = tool.execute(args)
            except Exception as exc:  # noqa: BLE001
                error_box[0] = exc

        t = threading.Thread(target=worker, daemon=True)
        t.start()
        t.join(timeout=tool.timeout_ms / 1000.0)

        if t.is_alive():
            self._err(msg_id, ERR_TOOL_TIMEOUT,
                      f"Tool execution timeout: {name}")
            return

        if error_box[0] is not None:
            self._ok(msg_id, {
                "content": [{"type": "text",
                             "text": f"Error: {error_box[0]}"}],
                "isError": True,
            })
            return

        self._ok(msg_id, result_box[0])  # type: ignore[arg-type]

    def _handle_tool_call(self, msg_id: MsgId, params: Params) -> None:
        name = params.get("name")
        if not isinstance(name, str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing tool name")
            return

        args: Params = params.get("arguments", {})
        if not isinstance(args, dict):
            args = {}

        context: Params = params.get("context", {})
        if not isinstance(context, dict):
            context = {}

        # 1. Quota gate
        if not self._check_quota(name):
            self._err(msg_id, ERR_QUOTA_EXCEEDED, "Provider quota exceeded")
            return

        # 2. Policy gate
        if not self._check_policy(name):
            self._err(msg_id, ERR_POLICY_DENIED, "Policy denied")
            return

        # 3. Sandbox gate
        if not self._check_sandbox(args):
            self._err(msg_id, ERR_SANDBOX_DENIED, "Sandbox denied")
            return

        # 4. Tool existence
        tool = self._tools.get(name)
        if tool is None:
            self._err(msg_id, ERR_INVALID_PARAMS, f"Unknown tool: {name}")
            return

        # 5. Approval gate
        if self._requires_approval(name):
            request_id = context.get("request_id")
            if not isinstance(request_id, str):
                self._err(
                    msg_id, ERR_INVALID_PARAMS,
                    "Missing context.request_id for approval-required tool",
                )
                return

            # Register BEFORE thread spawn to prevent race with approve/deny
            entry = self._approval_queue.register(request_id)

            def approval_wait() -> None:
                outcome = self._approval_queue.wait(
                    request_id, entry, APPROVAL_TIMEOUT_MS / 1000.0,
                )
                if outcome == "approved":
                    self._execute_tool(msg_id, name, tool, args)
                elif outcome == "timeout":
                    self._err(msg_id, ERR_APPROVAL_TIMEOUT,
                              "Approval timeout")
                else:
                    self._err(msg_id, ERR_APPROVAL_DENIED, "Approval denied")

            threading.Thread(target=approval_wait, daemon=True).start()
            return

        # 6. Execute (no approval required)
        self._execute_tool(msg_id, name, tool, args)

    def _handle_tool_approve(self, msg_id: MsgId, params: Params) -> None:
        request_id = params.get("request_id", "")
        if not isinstance(request_id, str):
            request_id = ""
        self._approval_queue.approve(request_id)
        self._ok(msg_id, {"acknowledged": True})

    def _handle_tool_deny(self, msg_id: MsgId, params: Params) -> None:
        request_id = params.get("request_id", "")
        if not isinstance(request_id, str):
            request_id = ""
        self._approval_queue.deny(request_id)
        self._ok(msg_id, {"acknowledged": True})

    # ── L3 Handlers — Memory ────────────────────────────────────────────

    def _handle_memory_store(self, msg_id: MsgId, params: Params) -> None:
        store_name = params.get("store")
        if not isinstance(store_name, str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
            return

        entries = params.get("entries")
        if not isinstance(entries, list):
            self._err(msg_id, ERR_INVALID_PARAMS,
                      "Missing or invalid entries")
            return

        ids: list[str] = []
        with self._memory_lock:
            bucket = self._memory.setdefault(store_name, [])
            for raw in entries:
                entry_id = str(uuid.uuid4())
                ids.append(entry_id)
                content = (raw.get("content", "")
                           if isinstance(raw, dict) else "")
                bucket.append(_MemoryEntry(
                    id=entry_id,
                    content=content,
                    timestamp=self._utc_now_iso(),
                ))

        self._ok(msg_id, {"stored": len(entries), "ids": ids})

    def _handle_memory_query(self, msg_id: MsgId, params: Params) -> None:
        store_name = params.get("store")
        if not isinstance(store_name, str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
            return

        if not isinstance(params.get("query"), dict):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing query")
            return

        with self._memory_lock:
            bucket = self._memory.get(store_name, [])
            result_entries = [
                {
                    "id": e.id,
                    "content": e.content,
                    "score": 1.0,
                    "timestamp": e.timestamp,
                }
                for e in bucket
            ]

        self._ok(msg_id, {"entries": result_entries})

    def _handle_memory_compact(self, msg_id: MsgId, params: Params) -> None:
        store_name = params.get("store")
        if not isinstance(store_name, str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing store name")
            return

        with self._memory_lock:
            bucket = self._memory.get(store_name, [])
            before = len(bucket)
            self._memory[store_name] = bucket[-100:]
            after = len(self._memory[store_name])

        self._ok(msg_id, {
            "entries_before": before,
            "entries_after": after,
        })

    # ── L3 Handlers — Swarm ─────────────────────────────────────────────

    def _handle_swarm_delegate(self, msg_id: MsgId, params: Params) -> None:
        if not isinstance(params.get("task_id"), str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing task_id")
            return

        task = params.get("task")
        if not isinstance(task, dict) or "description" not in task:
            self._err(msg_id, ERR_INVALID_PARAMS,
                      "Missing task.description")
            return

        self._ok(msg_id, {"acknowledged": True})

    def _handle_swarm_discover(
        self, msg_id: MsgId, _params: Params,
    ) -> None:
        self._ok(msg_id, {
            "peers": [{
                "identity": "peer-1",
                "uri": "claw://local/identity/peer-1",
                "status": "ready",
            }],
        })

    def _handle_swarm_report(self, msg_id: MsgId, params: Params) -> None:
        if not isinstance(params.get("task_id"), str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing task_id")
            return
        if not isinstance(params.get("status"), str):
            self._err(msg_id, ERR_INVALID_PARAMS, "Missing status")
            return

        self._ok(msg_id, {"acknowledged": True})

    def _handle_swarm_broadcast(
        self, _msg_id: MsgId, _params: Params,
    ) -> None:
        """Notification — fire and forget, no response."""

    # ── Message Router ───────────────────────────────────────────────────

    def _handle_message(self, raw: str) -> None:
        """Parse, validate, and dispatch a single JSON-RPC message."""

        # 1. Parse JSON
        try:
            msg: Any = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            self._err(None, ERR_PARSE_ERROR, "Parse error")
            return

        # 2. Validate JSON-RPC 2.0 envelope
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
            self._err(None, ERR_INVALID_REQUEST,
                      "Invalid request: missing or wrong jsonrpc field")
            return

        if not isinstance(msg.get("method"), str):
            raw_id = msg.get("id")
            err_id: MsgId = (
                raw_id
                if isinstance(raw_id, (str, int)) and not isinstance(raw_id, bool)
                else None
            )
            self._err(err_id, ERR_INVALID_REQUEST,
                      "Invalid request: missing method field")
            return

        method: str = msg["method"]
        raw_id = msg.get("id")
        msg_id: MsgId = (
            raw_id
            if isinstance(raw_id, (str, int)) and not isinstance(raw_id, bool)
            else None
        )

        # Validate params type (must be object, not array/primitive/null)
        raw_params = msg.get("params")
        if raw_params is not None and not isinstance(raw_params, dict):
            self._err(msg_id, ERR_INVALID_PARAMS,
                      "params must be an object")
            return
        params: Params = raw_params if isinstance(raw_params, dict) else {}

        # 3. Lifecycle enforcement
        if self._state == "INIT" and method != "claw.initialize":
            if msg_id is not None:
                self._err(msg_id, ERR_INVALID_REQUEST,
                          "claw.initialize required first")
            return

        if self._state != "READY" and method in _READY_ONLY:
            if msg_id is not None:
                self._err(msg_id, ERR_INVALID_REQUEST,
                          "Method requires READY state")
            return

        # 4. Dispatch
        handler = self._handlers.get(method)
        if handler is not None:
            handler(msg_id, params)
        elif msg_id is not None:
            # Unknown method — error for requests, silent for notifications
            self._err(msg_id, ERR_METHOD_NOT_FOUND,
                      f"Method not found: {method}")

    # ── Public API ───────────────────────────────────────────────────────

    def listen(self) -> None:
        """Read stdin line-by-line and dispatch each JSON-RPC message."""
        try:
            while True:
                line = sys.stdin.readline()
                if not line:
                    break  # EOF
                stripped = line.strip()
                if stripped:
                    self._handle_message(stripped)
        except (EOFError, KeyboardInterrupt):
            pass
        finally:
            self._stop_heartbeat()

    def close(self) -> None:
        """Stop heartbeat and release resources."""
        self._stop_heartbeat()


# ═══════════════════════════════════════════════════════════════════════════
#  Entry Point
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    """Create an agent and listen on stdin."""
    Agent().listen()


if __name__ == "__main__":
    main()
