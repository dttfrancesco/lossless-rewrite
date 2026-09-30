# Validation status

Updated 1 October 2026 for extension 0.5.15. These are implementation checks and observed examples, not a benchmark of semantic accuracy.

| Area | Evidence | Limit |
|---|---|---|
| Regression tests | Engine/CLI/companion suite and 77 extension tests pass locally. Covers send safeguards, stale-result invalidation, context teardown, rules, highlights, PDF upload and OAuth callback validation. | Fixtures do not establish compatibility with every live account or layout. |
| Type checking | `npm run typecheck` passes. | Supabase Edge Functions use a separate Deno runtime and are excluded from the app's TypeScript project. |
| Builds and package | Next.js production build, store extension build, package audit, no-key replay and static demo build pass locally. | The package audit checks expected files and known credential patterns; it is not store approval. |
| Email handlers | Five Deno tests pass for confirmation delivery, duplicate requests, failure reporting and scoped unsubscribe. | These unit tests do not exercise a live email provider. |
| Store identity | Public key hashes to the store ID; callback checks reject mismatches. User confirmed Google sign-in with the store-ID build. | A registered callback is required for custom IDs and forks. Store approval has not been verified. |
| Installed chats | User reports working flows on ChatGPT, Claude, Gemini, Grok and DeepSeek. An installed ChatGPT rewrite retained a fictional caveat and returned a passing check. | Not an independent full acceptance matrix. Provider UI, locales and account variants can change. |
| PDF and rules | Local tests cover upload behaviour, bounded rules, rule capture/undo, per-chat selections and hosted rule-check construction. User exercised the PDF reader and rules workflow. | Scans need external OCR. Saved writing rules are checked only through the hosted inline path. |
| CLI replay | Saved fictional policy check/repair runs without keys or live provider calls. | The omission was deliberately seeded. One example is not a success-rate estimate. |
| Free service | Google sign-in, monthly credits, larger-check confirmation, explicit interest registration and unsubscribe handlers are implemented. | Paid subscriptions are disabled; automatic checks and saved reference projects remain private-test features. |

## Reproduce

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run extension:build:store
node scripts/audit-extension.mjs --store
npm run demo
node scripts/build-site.mjs
```

The [CI workflow](https://github.com/dttfrancesco/lossless-rewrite/actions/workflows/ci.yml) runs repository checks on Windows and Linux. Local testing was on Windows. See the individual commit's CI result for remote validation.

## Limits

- Only selected requirements and enabled writing rules are individually checked. Meaning judgments can be wrong or uncertain; a pass does not prove the source true or the complete output lossless.
- Highlights compare text. A retained paraphrase may not be highlighted as a source match.
- Word limits are requests to the writer. Preserving selected content can conflict with the requested length.
- Cancellation may stop listening while a provider request continues.
- Local storage does not mean offline inference: live text goes to the configured chat and checking providers.
- The captioned video shows an earlier illustrated interface. Current store images 01-03 use installed-extension captures; 04-05 are labelled source-derived previews with fictional data.

[Extension guide](../extension/README.md) · [Release record](../extension/RELEASE-CHECKLIST.md) · [Privacy](../extension/PRIVACY.md)
