# Publication Checklist

External repos were updated locally. To publish cleanly without breaking CI, use this order:

1. Push `ckp-test` commit `c3779fd24421ccc0572bda48a534f47685ea2b5f`.
2. Push `clawkernel` after the harness commit exists remotely, so the CI pin resolves.
3. Push `clawkernel-docs` once the main repo changes are live.

Locked decisions:

- `claw.initialize` request `capabilities: {}` is an unrestricted request.
- `claw.swarm.report` remains covered by `TV-L3-02`; there is no standalone conformance vector.
- `TV-L3-04` and `TV-L3-05` remain part of the suite as manifest-validation vectors.
