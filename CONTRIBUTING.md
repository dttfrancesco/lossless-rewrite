# Contributing

The most useful contribution is a small example that exposes a missed detail or a false alarm.

Include the source, editing instruction, protected requirement, output, and expected result. Use synthetic or redacted text. State the writer/provider and whether the mistake came from extraction, writing, checking, or repair. Do not include API keys.

## Local checks

```bash
npm install
npm test
npm run typecheck
npm run build
```

Tests and the saved demo need no live model credentials. Live evaluations consume provider quota and must be run separately.

The Checks workflow runs tests, type checking, production and extension builds, and the saved demo on Windows and Linux. Local passes do not establish that this workflow has run on GitHub yet.

## Where changes belong

- `lib/coverage/`: meaning checks, wording checks, second opinions.
- `lib/rewrite/`: extraction, writing, repair and draft selection.
- `lib/llm/`: provider adapters.
- `cli/rewrite.ts`: terminal entry point; keep stdout machine-readable.
- `components/`: editor and selected-detail tracing.
- `eval/`: reproducible live evaluations. Put run output under ignored `eval/results/`.
- `video/`: storyboard, deterministic Remotion compositions and narration.

Fix the smallest relevant layer and add a regression for consequential failures. Do not turn a probabilistic score into a guarantee or replace recorded evidence with invented results. Model suggestions, broad provider support and live-tested parity are different claims.
