# Validation status

Updated 22 September 2026. These results describe local checks, not a guarantee of correctness or a completed browser-store release.

| Area | Evidence | Limit |
|---|---|---|
| Automated tests | 44 tests: 29 TypeScript engine/CLI/companion/import tests and 15 extension tests | Fixtures do not establish live-site compatibility. |
| Clean install and build | Source-only checkout passes `npm ci`, all 44 tests, type checking, Next.js production build, extension build and no-key replay on Node.js 24.19.0; install audit reports 0 vulnerabilities | Windows is the locally exercised platform. The [CI workflow](https://github.com/dttfrancesco/lossless-rewrite/actions/workflows/ci.yml) runs the release checks on Windows and Linux. |
| CLI replay | No-key run shows five retained conditions, one altered condition, then all six passing after repair | The omitted condition was deliberately seeded. |
| Long-document demo | 1,115-word fictional policy; final summary 163 words; six selected conditions checked | Manually selected requirements; one example, not a success-rate estimate. |
| Editor interactions | Browser checks at 390, 600, 820, 1100 and 1440 px; direct textarea marking, overlapping protections, duplicate prevention, Ctrl+Z/redo, Clear recovery and popup dismissal; live extraction and rewrite passed | Desktop browser exercised; mobile touch and other browsers still need trials. |
| Browser demo | Static replay of the saved check and repair; selectable requirements, complete input/output, captioned video | No live generation or user-document upload on the public demo page. |
| Writer paths | Codex extraction, writing and repair exercised through editor/CLI; compatible endpoint contract tested locally | Other paid providers need live validation. [Connection status](MODELS.md). |
| Native companion | Framed transport tests include source host and compiled Windows executable; unpacked Chrome installation and current-user Windows host registration completed | Live extension-to-host and chat-site interactions, plus non-Windows installation, need manual trials. |

The editor preserves raw character offsets for exact-wording checks, invalidates stale results after edits, displays unresolved/uncertain checks, and retains repair evidence across serialization. These behaviors have regression coverage. PDF import accepts selectable text; scanned PDFs require OCR.

## Known limits

- Semantic checks and extraction can be wrong. Only selected requirements receive individual checks.
- Reaching a word target is secondary to retaining the selected content; a bounded run can end above target or with unresolved checks.
- Cancellation can stop listening without ending an already running provider request.
- Local execution does not mean offline inference: live text goes to the configured writer and checker.
- The extension is experimental. Installed ChatGPT/Claude behavior, registration, permission flows, streaming and navigation still need the [manual acceptance matrix](../extension/README.md).
- The media are an illustrated extension preview using real saved check/repair evidence, not a recording of an installed chat integration.

Reproduce local validation with `npm test`, `npm run typecheck`, `npm run build`, `npm run extension:build` and `npm run demo`.
