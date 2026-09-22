# Project status and next work

Start with the [README](README.md) for implemented capabilities and setup. The [original design specification](docs/SPEC.md) includes proposals beyond the current implementation.

## Implemented

- Shared TypeScript rewrite, verification, repair and tightening engine.
- Exact wording, meaning checks and extracted coverage inventories.
- Editor with evidence tracing, style feedback, manual editing, file import and model selection.
- Standalone CLI with existing-draft checks, JSON evidence and a no-key replay.
- Direct API and local CLI writer adapters; validation status varies by provider.
- Experimental browser extension and native companion, with automated adapter and transport tests.
- A reproducible long-document demo: 1,115 words, six selected requirements, a 163-word repaired summary.

## Next validation priorities

1. Test the installed extension against live ChatGPT and Claude, including streaming, regenerated messages and navigation.
2. Exercise companion installation on each supported operating system and Edge separately.
3. Validate paid-provider behavior and current account/model availability.
4. Collect independent long-document cases, including false greens, false alarms and style regressions.
5. Measure whether selecting/reviewing requirements saves time compared with manual review.

This is an experimental local application. A hosted deployment needs its own authentication, quotas and operational review. See [validation status](docs/REVIEW.md) and [contribution guidance](CONTRIBUTING.md).
