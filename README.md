<img src="extension/icons/mark.svg" width="48" height="48" alt="Lossless Rewrite logo">

# Lossless Rewrite

### Cut words, not ideas.

Asked AI to shorten your writing, then had to put the important parts back?

**Choose what must survive. Rewrite in your usual AI chat. Check what was kept, changed or lost.**

For dense discussions, related work, policies and emails. Works with **ChatGPT, Claude, Gemini, Grok and DeepSeek**.

[![Select a passage in your AI chat and choose Keep meaning or Keep wording](docs/hero-extension.jpg)](extension/README.md)

[Install the extension](#install) · [How to use it](extension/README.md) · [All five screenshots](extension/store-assets/SCREENSHOTS.md) · [Saved demo](https://dttfrancesco.github.io/lossless-rewrite/)

## In your existing chat

1. **Mark a passage:** keep its meaning, or preserve the exact words. Select from the chat or a PDF reference.
2. **Write your request:** for example, “Condense this discussion to 300 words.”
3. **Press Ctrl+Shift+Enter** (⌘+Shift+Enter on Mac). Lossless includes your selections and sends through the chat you are already using.
4. **Check the finished reply.** Review missing or changed ideas. **Fix in chat** prepares a repair for you to review and send.

Your chat handles writing and repairs. No separate writing-model API is needed for the extension.

## What it does

| Feature | What you get |
|---|---|
| **Keep meaning** | Check that a selected claim survives paraphrasing, including its conditions, numbers and uncertainty. |
| **Keep wording** | Preserve a quote or approved sentence; check exact text locally. Combine overlapping protections. |
| **PDF references** | Read a PDF beside your chat and mark passages with their filename and page number. |
| **Writing rules** | Save specific preferences across chats. Supported explicit style requests can be remembered locally, with Undo and an off switch. Check whether the reply follows them. |
| **Highlights** | Toggle source and reply colours separately. Text matches are visual aids; meaning is checked separately. |
| **Quick controls** | Move or hide the small launcher. Open selections, PDF references or the sidebar without leaving the chat. |
| **Full editor** | Check an existing draft, extract a section's key ideas into a checklist, inspect evidence, undo marks and export results. |
| **Local app and CLI** | Rewrite whole documents with API models or authenticated Codex / Claude Code, with bounded check-and-repair attempts. |

A few uses:

- **Discussion sections:** condense the argument without dropping results or limitations.
- **Related work:** combine several sources while keeping their distinct claims and attribution.
- **Policies:** simplify wording without losing exceptions, conditions or deadlines.
- **Emails:** change the tone while keeping the message and commitments.

## Free now

Marking, prompting and exact-wording checks need no Lossless account. **Google sign-in includes 25 hosted check credits per calendar month**, with no API key. On Free, you choose when to check. Larger checks show their credit cost first.

**Plus and Pro are coming soon.** Automatic checking and saved multi-PDF projects are in private testing. You can register interest from **Compare plans**; no payment or subscription starts. The optional [own-key setup](extension/README.md#use-your-own-checking-key) is also available on Free.

## Install

**Current version: 0.5.15. A Chrome Web Store listing is being prepared; store installation is not available yet.**

Until it is approved, load the extension from source. Requires Git, Node.js 22.16+ and Chrome 116+.

```sh
git clone https://github.com/dttfrancesco/lossless-rewrite.git
cd lossless-rewrite
npm ci
npm run extension:build:store
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select **extension/store-dist**. Pin Lossless and open a supported chat. This build uses the project's public extension identity so the configured Google sign-in callback matches.

Already installed? Rebuild the same folder, click **Reload** in Chrome and refresh the chat. Avoid enabling two Lossless copies together. On PowerShell, use `npm.cmd` if script execution blocks `npm`.

[Extension setup, shortcuts and troubleshooting](extension/README.md)

## Local editor and CLI

The same repository also includes a standalone editor and command-line engine.

```sh
npm run demo
```

This replays a saved check and repair without keys or live model calls. For live use, copy [`.env.example`](.env.example) to `.env.local`, configure a writer and checking key, then run `npm run dev` for the editor or:

```sh
npm run rewrite -- --file input.md --instruction "Condense this discussion."
```

[Model setup](docs/MODELS.md) · [Editor](docs/EDITOR.md) · [CLI](docs/CLI.md) · [TypeScript engine](docs/ENGINE.md)

## Demo and limits

[Watch the captioned engine walkthrough](public/demo/social.mp4) · [Full fictional source](demo/customer-policy.md) · [Saved example and outputs](demo/document-walkthrough.md)

The video illustrates the checking workflow using an earlier interface. Current extension screenshots are above. Its seeded omission and saved repair are an example, not an accuracy benchmark.

Only selected requirements are individually checked. Meaning checks can be wrong; a pass is not fact-checking or a guarantee that nothing was lost. Highlights match text, not paraphrased meaning. Word counts remain requests to the writing model.

Selected passages go to your chat when you send with Lossless. Hosted checks send the selected text, enabled rules and reply to the checking service. PDFs stay on your device; attach a PDF in the chat too if the model needs the entire document. [Privacy](extension/PRIVACY.md) · [Validation and limitations](docs/REVIEW.md)

## Build with us

Report a missed idea, false alarm or awkward workflow with a small **fictional or redacted** example. Please keep private papers and credentials out of issues.

[Contributing](CONTRIBUTING.md) · [Architecture](docs/EXTENSION-DESIGN.md) · [MIT license](LICENSE)
