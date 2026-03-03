# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- CI workflows for continuous quality (`ci.yml`) and tag-based release gate (`release-gate.yml`).
- Governance and release docs: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `VERSIONING.md`, `RELEASE.md`.
- SDK unit suite expanded to 23 tests covering lifecycle, errors, tools, memory, swarm, task, A2A mapping, and transport resilience.
- SDK lint/format quality gates (`eslint` + `prettier`) with CI enforcement.

### Changed

- SDK transport now handles stdout I/O failures defensively (no hard crash on write failure).
- CI now pins `ckp-test` to a fixed commit for reproducible conformance checks.
- SDK package now uses recursive `dist/**` publish globs and includes `LICENSE`.
- README compatibility table now distinguishes live bridge results vs manifest baseline profiles.
- Root Apache license appendix now includes a concrete copyright attribution.
- `TV-L2-07` is now executable in `ckp-test`; full suite for SDK and NanoClaw bridge reaches `31/31` (`L3 CONFORMANT`).

## [0.2.2] - 2026-03-02

### Added

- CKP-A2A compatibility profile (`spec/compatibility/ckp-a2a-profile.md`).
- SDK A2A adapter and `claw.task.*` runtime bridge.
- Compatibility vectors in `ckp-test` and docs references.

### Improved

- SDK hardening for lifecycle gating, param validation, and timeout handling.
- Release metadata for npm package (`@clawkernel/sdk`).

### Known Status (at v0.2.2 release)

- Full conformance run: `30 PASS + 1 SKIP` (`TV-L2-07` scenario-based).
- Overall status remains `L3 PARTIAL` until scenario orchestration is executable in harness.

## [0.2.1] - 2026-02-23

### Changed

- SDK package metadata and npm release updates.

## [0.2.0] - 2026-02-22

### Added

- Initial CKP 0.2.0 specification suite.
- Runtime profile and conformance test vectors.
- L1 reference bridge.
