# Contributing to ClawKernel

Thanks for contributing to CKP.

## Development Workflow

1. Fork and create a branch from `main`.
2. Keep changes scoped (spec, SDK, or tooling).
3. Run required checks locally.
4. Open a PR with a clear summary and rationale.

## Required Checks

### Specification changes

```bash
bash tools/coherence-audit.sh spec reports
```

### SDK changes

```bash
cd sdk
npm ci
npm run build
npm test
```

### Conformance smoke (recommended)

```bash
git clone https://github.com/angelgalvisc/ckp-test.git
cd ckp-test
npm ci
npm run build
node dist/cli.js run \
  --target "node ../clawkernel/sdk/dist/examples/l3-agent.js" \
  --manifest ../clawkernel/sdk/examples/l3.claw.yaml
```

## Commit and PR Guidance

- Use clear commit scopes (e.g., `spec:`, `sdk:`, `docs:`).
- Include tests/docs for behavior changes.
- Update `CHANGELOG.md` for user-facing changes.
- Avoid unrelated refactors in the same PR.

## Licensing

By contributing, you agree your contributions are licensed under Apache-2.0.
