# Release Process

This repository publishes CKP artifacts under a **Public Beta** policy for `v0.3.x`.

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
  --manifest ../clawkernel/sdk/examples/l3.claw.yaml \
  --level 3
```

## Public Beta Criteria (`v0.3.x`)

- L1: `CONFORMANT`
- L2: `CONFORMANT`
- L3: `CONFORMANT`
- Full suite: `CONFORMANT` (31/31 pass, no skips).
- `WorldModel` and extended `Memory` features validate at schema level and remain optional for wire conformance.
- Public README, compatibility docs, and docs site must all point to the same CKP and SDK release numbers before tagging.

## GA / `v1.0` Criteria

- Core conformance suite remains 31/31 pass (no skips).
- CI release gate passing on tags.
- Security and disclosure policy active.
- Changelog and migration notes published.

## Tagging

- Use annotated tags: `vX.Y.Z`.
- Update `CHANGELOG.md` before tagging.
- Do not tag if release gates fail.
