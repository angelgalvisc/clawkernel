# PicoClaw CKP Compatibility Profile

## Scope

Baseline CKP compatibility assessment for PicoClaw.

- **Source:** https://github.com/sipeed/picoclaw
- **Local clone:** `/Users/agc/Documents/picoclaw_sipeed_20260224`
- **Commit audited:** `8774526`
- **Manifest profile:** `profiles/picoclaw.claw.yaml`
- **Report:** `profiles/picoclaw-report.md`

## Baseline Result (manifest-only)

Command used:

```bash
node /Users/agc/Documents/ckp-test/dist/cli.js run \
  --manifest /Users/agc/Documents/clawkernel/profiles/picoclaw.claw.yaml \
  --output /Users/agc/Documents/clawkernel/profiles/picoclaw-report.md
```

Outcome:

- **L1:** 4/13 — **PARTIAL**
- **L2:** 1/10 — **PARTIAL**
- **L3:** 1/8 — **PARTIAL**
- **Overall:** **L1 PARTIAL**

Reason: no CKP JSON-RPC transport target configured yet (manifest-only run).

## Wire Compatibility Findings

Current PicoClaw control surface is gateway/CLI-oriented, not CKP method-oriented:

- CLI commands include `gateway` and `status` (see `/Users/agc/Documents/picoclaw_sipeed_20260224/cmd/picoclaw/main.go`).
- Runtime and channels operate via PicoClaw internal gateway and channel buses (see `/Users/agc/Documents/picoclaw_sipeed_20260224/cmd/picoclaw/cmd_gateway.go`).
- No native `claw.initialize` / `claw.tool.call` method surface detected in code search.

## Next Execution Step

Implement a CKP stdio bridge for PicoClaw and rerun live vectors:

1. Add bridge binary exposing CKP methods (`claw.initialize`, `claw.status`, `claw.shutdown`, `claw.heartbeat`, and `claw.tool.*`).
2. Map CKP tool pipeline to PicoClaw tool/router internals.
3. Re-run:

```bash
node /Users/agc/Documents/ckp-test/dist/cli.js run \
  --target "<picoclaw-ckp-bridge-command>" \
  --manifest /Users/agc/Documents/clawkernel/profiles/picoclaw.claw.yaml \
  --output /Users/agc/Documents/clawkernel/profiles/picoclaw-live-report.md
```
