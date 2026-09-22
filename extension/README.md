# Browser extension — experimental

This is a loadable Manifest V3 extension. It uses the existing rewrite/verification engine through `companion/`. **An unpacked Chrome installation and Windows companion registration have been completed, but live ChatGPT/Claude interactions remain unvalidated.** The conservative semantic page adapter supports accessible message articles and an unambiguous composer; unsupported layouts use select/copy/paste. Do not advertise live-site compatibility until the manual matrix below passes.

## Build and owner trial

```sh
npm install
node scripts/build-extension.mjs
node --test extension/*.test.mjs
```

Load `extension/dist` using Chrome's **Load unpacked** control. Edge is a separate compatibility trial. Follow [companion setup](../companion/README.md) for explicit native-host registration using the extension's exact ID. This task does not install or register anything automatically. The browser action opens the side panel; Expand opens the same document in an extension tab.

No credentials belong in the extension. The panel receives only connection configuration status. Site access is optional and requested separately for `chatgpt.com` and `claude.ai`. No cookies, history, debugger, session-token interception or all-sites access is requested.

## Implemented

- Full-source paste/file/message/selection import and editing; all three protection modes. Must-cover extraction, editable ideas, removal and incomplete-inventory blocking.
- Same provider catalog as the app, custom model IDs, API/CLI rewriting, checking existing text without generation, bounded repairs/tightening and style feedback.
- Conversation mode previews complete prompts and repairs, then explicitly appends/replaces the inspected chat draft. A changed draft refuses insertion. The user sends the message.
- Manual completed-reply confirmation, selected requirement/source/reply evidence, pass history, immediate stale-check invalidation on edits, detected page mutation/navigation, and revision/run checks for late results.
- Recorded fixture with no network, text/evidence download, clipboard, session persistence and explicit local save/clear; no browser sync.
- Native transport with closed operations, extension-page sender checks, bounded chunk assembly, disconnect errors and no automatic generation retry. Cancel honestly detaches from results; provider execution may continue.

Page annotations deliberately stop at revealing an exact unchanged captured message. Inline page word highlighting and automatic stream-completion detection are not claimed. Evidence highlighting remains available in the panel's captured source/reply. DOM message imports are reviewed plain text, not a claim to recover original Markdown. Selected text imports exactly the selection, with a reminder when a larger source message exists.

## Manual release matrix (pending)

For both sites: test fresh/long conversation, list/code/table messages, regenerated reply, branch changes, streaming reply (must remain unchecked), navigation, ambiguous composer, existing draft append/replace and unsupported layout. Verify no messages are ever sent automatically. Exercise 320px panel, keyboard selection, 200% zoom, expanded/sidebar synchronization, restore, and worker/native disconnects. Check API and local CLI routes through an installed native host and report provider availability honestly. Use redacted or synthetic source text.

The companion protocol tests and extension fixture tests do not replace this live browser matrix.
