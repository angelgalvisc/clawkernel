# NanoBot CKP Compatibility Profile

## Scope

Baseline CKP compatibility assessment for NanoBot.

- **Source:** https://github.com/HKUDS/nanobot
- **Local clone:** `/Users/agc/Documents/nanobot_hkuds_20260224`
- **Commit audited:** `30361c9`
- **Manifest profile:** `profiles/nanobot.claw.yaml`
- **Report:** `profiles/nanobot-report.md`

## Baseline Result (manifest-only)

Command used:

```bash
node /Users/agc/Documents/ckp-test/dist/cli.js run \
  --manifest /Users/agc/Documents/clawkernel/profiles/nanobot.claw.yaml \
  --output /Users/agc/Documents/clawkernel/profiles/nanobot-report.md
```

Outcome:

- **L1:** 4/13 — **PARTIAL**
- **L2:** 1/10 — **PARTIAL**
- **L3:** 1/8 — **PARTIAL**
- **Overall:** **L1 PARTIAL**

Reason: no CKP JSON-RPC transport target configured yet (manifest-only run).

## Wire Compatibility Findings

NanoBot has strong MCP support, but no native CKP method endpoint yet:

- MCP integration exists in `/Users/agc/Documents/nanobot_hkuds_20260224/nanobot/agent/tools/mcp.py`.
- Existing `bridge/` module is a WhatsApp WebSocket bridge, not CKP JSON-RPC (see `/Users/agc/Documents/nanobot_hkuds_20260224/bridge/src/server.ts`).
- No native `claw.initialize` / `claw.tool.call` method surface detected in code search.

## Next Execution Step

Implement a CKP stdio bridge for NanoBot and rerun live vectors:

1. Add CKP router process exposing lifecycle + tool + memory + swarm methods.
2. Map CKP methods to NanoBot loop/tool/scheduler internals.
3. Re-run:

```bash
node /Users/agc/Documents/ckp-test/dist/cli.js run \
  --target "<nanobot-ckp-bridge-command>" \
  --manifest /Users/agc/Documents/clawkernel/profiles/nanobot.claw.yaml \
  --output /Users/agc/Documents/clawkernel/profiles/nanobot-live-report.md
```
