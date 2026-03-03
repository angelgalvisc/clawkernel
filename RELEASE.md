# Release Process

This repository publishes CKP artifacts under a **Public Beta** policy for `v0.2.x`.

## Release Gates

A release is allowed only when all checks pass:

1. **Coherence gate**

```bash
bash tools/coherence-audit.sh spec reports
```

2. **SDK build and tests**

```bash
cd sdk
npm ci
npm run build
npm run lint
npm run format:check
npm test
```

3. **Conformance smoke**

```bash
git clone https://github.com/angelgalvisc/ckp-test.git
cd ckp-test
npm ci
npm run build

node dist/cli.js run \
  --target "node ../clawkernel/sdk/dist/examples/l1-agent.js" \
  --manifest ../clawkernel/reference/ckp-bridge/claw.yaml \
  --level 1

node dist/cli.js run \
  --target "node ../clawkernel/sdk/dist/examples/l3-agent.js" \
  --manifest ../clawkernel/sdk/examples/l3.claw.yaml
```

## Public Beta Criteria (`v0.2.x`)

- L1: `CONFORMANT`
- L3 vectors: `CONFORMANT`
- Full suite may remain `PARTIAL` only for explicitly documented scenario-based skips.

Current documented skip:

- `TV-L2-07` (Approval Timeout): scenario orchestration not yet executable in harness.

## GA / `v1.0` Criteria

- No scenario-based skips in core conformance suite.
- CI release gate passing on tags.
- Security and disclosure policy active.
- Changelog and migration notes published.

## Tagging

- Use annotated tags: `vX.Y.Z`.
- Update `CHANGELOG.md` before tagging.
- Do not tag if release gates fail.
