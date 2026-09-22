@AGENTS.md

# Lossless Rewrite

The user marks what must survive (Keep wording, Keep meaning, Must cover), a selected API or CLI writer rewrites, and Jev checks the selected requirements. Failed checks can trigger repair. Implemented capabilities: `README.md`. Design proposals: `docs/SPEC.md`. Status: `PLAN.md`.

## Commands

- `npm run dev`: the app at http://localhost:3000 (Load demo → mark text → Rewrite).
- `npx tsx eval/smoke.ts`: check keys and backends with one tiny request each.
- `npx tsx eval/run-pipeline.ts`: the whole loop on the demo, in the terminal.
- `npm run bench`: the coverage benchmark (Jev and Claude). Add `-- --providers jev,rizzo`, or `-- --from <raw.json>` to re-score.
- `npx tsx --test lib/**/*.test.ts`: unit tests. `npm run typecheck` for types.

## Layout

- `lib/decision`: decision backend client (Jev or Rizzo Flow, `POST /v1/systemone`).
- `lib/coverage`: Jev questions (presence and trace), the verifier and its thresholds, the Claude adjudicator, the Keep wording check.
- `lib/rewrite`: fact extraction, the writer/repair/tighten prompts, the pipeline.
- `lib/llm`: API adapters and authenticated Claude Code/Codex CLIs. Provider validation status is in `docs/MODELS.md`.
- `app/`, `components/`: the Next.js UI. `eval/`: benchmark and scripts. `demo/`: the synthetic demo document.

## Rules

- Read the TypeSafe docs (the TypeSafe skill) before changing Jev questions, then re-run `npm run bench`.
- Jev is pinned to `jev-1.13.0`; the thresholds in `lib/coverage/verify.ts` were checked against it.
- `private/` holds the user's own papers for internal tests. Never commit them, quote them, or use them in the demo.
- The default Claude path is `claude -p --safe-mode` on the user's subscription. Keep the Anthropic API path working for people who clone the repo.
