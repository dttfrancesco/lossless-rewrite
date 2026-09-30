# Extension architecture

The extension adds preservation requirements to the user's existing AI chat and checks the completed reply. It does not need a second writing model. See the [user guide](../extension/README.md).

```text
ChatGPT / Claude / Gemini / Grok / DeepSeek
       ↕ packaged content script
Selections, writing rules, highlights and explicit send
       ↕ extension service worker
       ├─ exact-wording checks on the device
       ├─ signed-in hosted meaning / rule checks
       │    ↕ authenticated Supabase function
       │    Jev decision API
       └─ optional native companion → user's own checking key

Repairs → draft in the same chat → user reviews and sends
```

## Components

- `content.js`, `inline.js`: composer detection, selection, shortcuts and one explicit send. Draft changes, navigation or removed access abort. Unsupported controls leave the prepared draft for manual sending.
- `protection-store.js`: serialized per-tab/conversation selections. A new chat can migrate to its assigned URL after an explicit send. Existing conversation changes clear selections.
- `reply-highlights.js`: local source/reply text matches with independent toggles. Matching colours are not semantic verdicts.
- `reply-check-ui.js`: waits for a completed reply, invalidates stale results, displays checks and prepares repairs. Free hosted checks require a click; automatic checking is available to private testers.
- `rule-learning.js`, `rule-store.js`: bounded local detection of supported explicit style requests, Undo, manual rules and an off switch. No second-model call or history scan.
- `reference.js`: PDF.js reader in the side panel, linked to a chat through a scoped capability. Only selected passages are sent. Project saves are local and restricted to private test access.
- `cloud.js`: Google sign-in with PKCE through Chrome identity, account session, authenticated requests and credit confirmation. The exact extension callback is validated.
- `native-check.js`: optional bounded native protocol for meaning checks using the user's key. It cannot call a writer or run the app's rewrite pipeline.
- `panel.js`: full source/reply editor, checklist extraction, chat-based structured review, evidence, undo and export. Separate from inline hosted checks.

## Backend and data

Hosted API and migrations live under `supabase/`. The API authenticates the caller, computes check size, reserves usage transactionally and releases credits when a check fails. It does not store manuscript text in application tables. Provider processing still applies. Client configuration contains a public publishable key; privileged keys are server secrets.

Free accounts receive 25 credits per UTC calendar month. Private test entitlements come from a server-managed allowlist matched against verified email. No allowlist entries or private credentials belong in this repository. Checkout is disabled; billing scaffolding is not a live paid offering.

Plan-interest registration uses verified email and explicit consent. Brevo sends a confirmation with a scoped unsubscribe link. The public page removes the token from its URL before making a request. See [backend setup](../supabase/README.md) and [privacy](../extension/PRIVACY.md).

## Boundaries

- Access is declared for five specific chat origins plus the authentication/checking backend. No all-sites permission.
- Local PDFs are not automatically attached to the chat. Selected passages include filename and page number.
- Hosted checks accept up to 50 passages/rules, 20 writing rules, a reply under 60,000 characters and a bounded provider payload. Larger checks quote credits first.
- The extension's writer is the existing chat. API/CLI writers and bounded automatic repair pipelines belong to the standalone app and CLI.
- Only selected requirements and enabled rules are individually checked. Uncertain judgments remain visible. Neither highlighting nor structural validation establishes semantic accuracy.
- Cancellation may detach without stopping a provider request. Site layouts and streaming signals can change; manual checking and copy/paste remain fallbacks.
- The [store identity](../extension/store-identity.json) is public and included only in the store build. Forks must configure their own identity and exact callback.

[Validation status](REVIEW.md) · [Release record](../extension/RELEASE-CHECKLIST.md)
