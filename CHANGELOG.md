# Changelog

All notable changes to this project are documented in this file.

## [0.2.2] - 2026-03-02

### Added

- CKP-A2A compatibility profile (`spec/compatibility/ckp-a2a-profile.md`).
- SDK A2A adapter and `claw.task.*` runtime bridge.
- Compatibility vectors in `ckp-test` and docs references.

### Improved

- SDK hardening for lifecycle gating, param validation, and timeout handling.
- Release metadata for npm package (`@clawkernel/sdk`).

### Known Status

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
