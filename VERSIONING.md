# Versioning Policy

## CKP Specification

- The core specification uses protocol versions like `v0.2.0`.
- Changes in `v0.x` may include breaking changes with clear migration notes.
- `v1.0.0` will indicate stability commitments for normative sections.

## SDK (`@clawkernel/sdk`)

- Uses Semantic Versioning (`MAJOR.MINOR.PATCH`).
- `PATCH`: bug fixes and non-breaking internal improvements.
- `MINOR`: additive features and backward-compatible API changes.
- `MAJOR`: breaking API or behavior changes.

## Conformance Harness (`@clawkernel/ckp-test`)

- Uses SemVer; vector additions and runner behavior are documented in release notes.
- Scenario-based skips are explicitly documented until executable coverage exists.

## Compatibility Profiles

- Compatibility docs (e.g., CKP-A2A) are versioned independently (e.g., `0.1.0-draft`).
- They are additive and must not silently alter CKP core semantics.
