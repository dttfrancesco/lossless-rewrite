# Extension architecture

The experimental extension is another client of the existing engine. See [installation, implemented features and manual acceptance tests](../extension/README.md).

```text
ChatGPT / Claude page
        ↕ optional site adapter
Extension sidebar or expanded editor
        ↕ validated native messages
Local companion
        ↕
Shared rewrite / verification engine
        ↙                 ↘
Configured writer         Jev checks
```

The extension keeps keys in the local companion. Site access is requested separately. It does not read cookies, intercept session tokens, request all-sites access or send chat messages automatically.

## Writing paths

- **This conversation:** review a prepared prompt, insert or copy it, and send it yourself. Import a completed reply for checking. A repair follow-up is also reviewed and sent manually.
- **API or local CLI:** the companion runs the existing rewrite/check/repair pipeline. Results appear in the extension. A web subscription is never treated as an API credential.

Both paths support exact wording, meaning and coverage inventories, source/reply evidence, style feedback, attempts/history, copying and evidence export. Source and reply edits invalidate their previous check. Late results are matched to document/revision/run IDs.

Page imports rely on conservative adapters and user review. Unsupported or ambiguous layouts fall back to copy/paste. The adapter reveals an exact captured message; it does not promise automatic inline highlighting in every chat layout or automatic completion detection.

## Boundaries

- The extension and CLI currently accept up to 100,000 characters; the editor has a larger input limit.
- PDF import and source omission (**Not this**) are editor-only features.
- Native messaging has a closed operation set and bounded payload/chunk sizes. See the [companion protocol](../companion/README.md).
- Cancellation detaches from results; provider execution may continue.
- Automated fixtures and native-process tests pass. Installed ChatGPT/Claude compatibility remains unverified.

The README media depict this workflow as an illustration. They are not a recording of a live installation.
