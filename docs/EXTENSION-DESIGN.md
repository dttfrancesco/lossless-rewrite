# Extension architecture

The extension offers a setup-free chat workflow and an optional client of the existing engine. See [installation and usage](../extension/README.md) and [release checks](../extension/RELEASE-CHECKLIST.md).

```text
ChatGPT / Claude / Gemini / Grok / DeepSeek page
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

- **This conversation:** review a prepared prompt, insert or copy it, and send it yourself. Exact wording is checked locally. Meaning checks and extraction use explicitly sent chat prompts and validated JSON responses, bound to the current document revision and request token. This is a chat-model review; it does not invoke Jev or certify judgment accuracy. Repairs are reviewed and sent manually.
- **API or local CLI:** the companion runs the existing rewrite/check/repair pipeline. Results appear in the extension. A web subscription is never treated as an API credential.

Both paths support exact wording, meaning and coverage inventories, source/reply evidence, style feedback, attempts/history, copying and evidence export. Source and reply edits invalidate their previous check. Late results are matched to document/revision/run IDs.

Page imports rely on conservative adapters and user review. Unsupported or ambiguous layouts fall back to copy/paste. The adapter reveals an exact captured message; it does not promise automatic inline highlighting in every chat layout or automatic completion detection.

## Boundaries

- The extension and CLI currently accept up to 100,000 characters; the editor has a larger input limit.
- PDF import and source omission (**Not this**) are editor-only features.
- Native messaging has a closed operation set and bounded payload/chunk sizes. See the [companion protocol](../companion/README.md).
- Cancellation detaches from results; provider execution may continue.
- The five origins are allowlisted with individual optional permissions. Installed compatibility remains subject to the manual release matrix. Native messaging is optional too.
- The 0.2.0 preview contains no hosted service, paid entitlements or billing.

The README media depict this workflow as an illustration. They are not a recording of a live installation.
