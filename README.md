```
$ claw --kernel█
```

# ClawKernel

**Claw Kernel Protocol (CKP)** — Open standard for stateful agent runtimes

[![Version](https://img.shields.io/badge/spec-v0.2.0--draft-blue)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)
[![Coherence Gate](https://img.shields.io/badge/coherence-PASS-brightgreen)]()
[![Spec tokens](https://img.shields.io/badge/spec_suite-~30k_tokens-orange)](spec/)

---

## What is CKP?

The Claw Kernel Protocol defines nine primitives for describing, composing, and interoperating autonomous AI agents. It provides a declarative manifest format (`claw.yaml`) with ABNF grammar, a JSON-RPC 2.0 wire format, and a `claw://` URI scheme for addressing agent components.

CKP is complementary to MCP (Model Context Protocol). Where MCP standardizes how LLM hosts discover and invoke tools, CKP standardizes how autonomous agents are assembled, secured, and orchestrated as first-class runtime entities.

Three conformance levels (L1 Minimal, L2 Standard, L3 Full) allow implementations ranging from 4MB embedded binaries to enterprise swarm deployments.

---

## The Nine Primitives

| # | Primitive | Purpose |
|---|-----------|---------|
| 1 | **Identity** | Who the agent is — personality, context files, autonomy level |
| 2 | **Provider** | LLM inference endpoint — Claude, GPT, Ollama, local models |
| 3 | **Channel** | Communication surface — Telegram, Slack, CLI, webhook, voice |
| 4 | **Tool** | Executable function with sandbox and policy bindings |
| 5 | **Skill** | Composed workflow built from multiple tools |
| 6 | **Memory** | Persistent state — conversation, semantic, key-value, workspace |
| 7 | **Sandbox** | Isolated execution environment with resource limits |
| 8 | **Policy** | Behavioral rules governing what an agent can and cannot do |
| 9 | **Swarm** | Multi-agent coordination across topologies |

---

## Conformance Levels

| Level | Name | Required Primitives | Target |
|-------|------|---------------------|--------|
| **L1** | Core | Identity, Provider | Embedded devices, simple chatbots |
| **L2** | Standard | + Channel, Tool, Sandbox, Policy | Personal assistants, team bots |
| **L3** | Full | All nine primitives | Enterprise swarms, multi-agent systems |

---

## Reading Order

1. **[Specification](spec/clawkernel-spec.md)** — Normative. The complete protocol definition: primitives, manifest format, ABNF grammar, JSON-RPC methods, security model, and conformance levels.

2. **[Runtime Profile](spec/clawkernel-runtime-profile.md)** — Informative. Recommended practices for implementers: defaults, retry semantics, transport extensions, secret resolution.

3. **[Test Vectors](spec/clawkernel-test-vectors.md)** — Informative. 30 conformance test vectors organized by level (L1 / L2 / L3).

---

## Coherence Gate

The specification suite includes an automated 10-rule coherence auditor that validates cross-document consistency:

```bash
./tools/coherence-audit.sh spec/ reports/
```

Rules checked: error code coherence, method contracts, syntax validation (JSON/YAML/ABNF), normative boundary enforcement, cross-references, ABNF conformance, conformance level correctness, MUST coverage, field name consistency, and editorial consistency.

**Current result:** `PASS` — 0 critical, 0 minor.

**Requirements:** `bash`, `jq`, `python3` (with PyYAML), `perl`.

---

## Project Status

| Item | Status |
|------|--------|
| Specification | `v0.2.0-draft` |
| Primitives defined | 9 / 9 |
| JSON-RPC methods | 14 specified |
| ABNF grammar | Complete |
| Test vectors | 30 (12 L1 + 10 L2 + 8 L3) |
| Error codes | 11 core |
| Coherence gate | 10 rules, PASS |
| Reference implementation | Planned |
| TypeScript schema | Planned |

---

## Contributing

CKP is in active draft. Feedback, issues, and proposals are welcome.

Before submitting changes to the specification, run the coherence gate and ensure it passes:

```bash
./tools/coherence-audit.sh spec/ reports/
# Must exit 0
```

---

## License

[Apache License 2.0](LICENSE)

---

**Author:** Angel Galvis Caballero — [Datastrat](https://datastrat.co)
