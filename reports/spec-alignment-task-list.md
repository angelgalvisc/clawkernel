# Publication Checklist

External repos were updated locally. To publish cleanly without breaking CI, use this order:

1. Push `ckp-test` commit `d2e1da3e489f2ba5c3c35688d2cd3191fb6a2e7e`.
2. Push `clawkernel` after the harness commit exists remotely, so the CI pin resolves.
3. Push `clawkernel-docs` once the main repo changes are live.

Locked decisions:

- `claw.initialize` request `capabilities: {}` is an unrestricted request.
- `claw.swarm.report` remains covered by `TV-L3-02`; there is no standalone conformance vector.
- `TV-L3-04` and `TV-L3-05` remain part of the suite as manifest-validation vectors.
