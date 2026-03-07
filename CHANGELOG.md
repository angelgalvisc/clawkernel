# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- NullClaw CKP bridge (`reference/nullclaw-bridge/`) — L3 conformant wrapper for the Zig-based NullClaw runtime (96K LOC, 678KB binary, 30+ tools, multi-sandbox, hybrid memory, leader-worker swarm).
- CI and release-gate workflows now run full conformance suite (31/31) against nullclaw-bridge.
- Python reference agent (`reference/ckp-python/`) — independent L3 implementation in pure Python (~350 lines, stdlib only). First non-TypeScript CKP implementation, proving full cross-language protocol portability. Passes 31/31 vectors (L1+L2+L3) with zero SDK dependencies.
- Shared bridge utilities (`reference/bridge-common/`) — factored sandbox, memory, swarm, policy, quota, and conformance tool logic out of nullclaw-bridge and nanoclaw-bridge, eliminating ~80% code duplication.

### Fixed

- SDK: Synchronous handler exceptions now caught (previously crashed the process).
- SDK: Tool execution timeout timer is properly cleared on success (prevents unhandled rejection leak).
- SDK: Heartbeat timer uses `.unref()` (prevents keeping process alive after all work is done).
- SDK: Graceful re-initialization cleans up heartbeat timer (prevents timer leak on duplicate `claw.initialize`).
- SDK: `NodeJS.Timeout` replaced with `ReturnType<typeof setTimeout/setInterval>` for runtime portability.
- Reference bridge (`ckp-bridge`): Graceful re-initialization guard added.

## [0.2.5] - 2026-03-05

### Fixed

- Release-gate workflow now builds SDK examples before conformance smoke (fixes EPIPE on `dist/examples/` targets).

## [0.2.4] - 2026-03-05

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

## [0.2.3] - 2026-03-03

### Changed

- SDK published to npm as `@clawkernel/sdk@0.2.3`.
- Conformance updated to `31/31` (`L1/L2/L3 CONFORMANT`) for SDK and NanoClaw bridge.
- Release/docs alignment updated for `0.2.3` status.

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
