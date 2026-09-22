# Command-line use

The CLI calls the same extraction, rewrite, verification and repair functions as the editor. It does not need Next.js running. Commands run from a source checkout after `npm install`.

```bash
npm run rewrite -- --help
```

On PowerShell, use `npm.cmd` when passing `--`, or replace `npm run rewrite --` with `node --import tsx cli/rewrite.ts`.

## No-key replay

```bash
npm run demo
npm run --silent rewrite -- --replay --json
```

This reads the committed long-document capture shown in the README: a 1,115-word policy, six selected conditions, and a 163-word repaired summary. It makes no network requests or model calls. Output is labelled `recorded`; it cannot be combined with a live source, model or instruction.

## Live rewrite

Set `TYPESAFE_API_KEY` and a writer in `.env.local` (see [.env.example](../.env.example)). Then:

```bash
npm run rewrite -- --file demo/delivery-policy.md --model codex-cli/default --instruction "Make the tone friendlier. Keep the policy unchanged."
```

With no selected protections, the CLI extracts key ideas from the whole file and checks them. The extracted inventory appears on stderr for review. An explicit model is used for extraction, writing, repair and second opinions.

To protect selected passages, pass their exact source text. Repeat these flags for multiple passages:

```bash
npm run rewrite -- --file demo/delivery-policy.md --model codex-cli/default --keep-meaning 'Delivery is free on orders of $50 or more.' --keep-wording 'Returns are accepted within 30 days of delivery.' --instruction 'Make this friendlier.'
```

Explicit protections replace automatic whole-document extraction. They constrain a full rewrite; unselected context is not discarded automatically. Dollar amounts need single quotes so your shell does not expand `$50`.

## Check and repair an existing draft

```bash
npm run rewrite -- --file original.md --draft edited.md --instruction "Keep this tone and restore any missing requirements."
```

`--repairs 0` checks the supplied draft without a repair pass. The default repair budget is one; maximum two. The pipeline may tighten drafts when the instruction names a word target. To only check an existing draft, omit a word target and use `--repairs 0`.

## Files, pipes and JSON

```bash
npm run rewrite -- --file original.md --out rewritten.md --report evidence.json
cat original.md | npm run --silent rewrite -- --file - --json
```

On PowerShell: `Get-Content -Raw original.md | npm.cmd run --silent rewrite -- --file - --json`.

- Plain stdout contains only rewritten text; use npm's `--silent` to suppress its script banner.
- `--json` emits `{ mode, passed, result }`; replay also includes provenance and capture time.
- `result` includes every attempt and verification result, not just the final text.
- Progress and the summary go to stderr.
- `--out` saves plain text; `--report` saves JSON. Existing paths are rejected before inference and are never overwritten.
- Exit `0`: all selected checks passed. Exit `1`: validation, configuration, file or provider error. Exit `2`: at least one selected check is missing, altered or uncertain after the available passes.

The JSON exit result is suitable for a script or agent to inspect. A semantic pass is probabilistic and does not establish factual truth.
