# Lossless Rewrite for Chrome

**Cut words, not ideas.** Protect key ideas or exact wording, condense your text in your usual AI chat, and review what survived.

Version 0.3.1 is an unpacked preview, not a Chrome Web Store release. ChatGPT, Claude, Gemini, Grok and DeepSeek have individual optional site permissions. Full installed-site acceptance remains pending. Copy/paste works with other tools too.

## Install

Use Node 22.16+:

```sh
npm ci
npm run extension:build
npm run test:extension
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/dist`. Pin the extension and click its icon. **Expand** opens a wider editor.

When upgrading an existing installation, rebuild its folder and press **Reload** in Chrome, then refresh your chat tab. A different folder can produce a different extension ID; companion registration must match it.

## Use your existing chat

No API key, companion or Lossless account is needed. Your chat provider's account, usage and payment rules still apply.

1. Open the extension on a supported chat page and choose **Enable on this site**. If Chrome has not exposed the tab address, use **Choose your chat site** and select the provider. Grant access, then close the sidebar.
2. Turn on **Lossless** beside the normal chat box. Write your request there. Add an optional word limit or notes about what must stay.
3. Choose **Review & send**, inspect the complete outgoing prompt, then **Send with Lossless**. The extension adds preservation instructions and clicks one identifiable Send button. If it cannot identify the button, it leaves the prompt staged for you to send manually.

The native Send button and Enter remain unchanged. Inline sending uses the site's currently selected model. It adds instructions; it does not automatically verify or repair the answer. Changed drafts and navigation abort the send, and sends are never retried automatically.

## Check what survived

Choose **Check a rewrite** in the sidebar to open the full editor. Its existing checks, overlapping protections, evidence, undo and companion tools remain available.

1. Add your complete source or notes. Include source labels when combining papers.
2. Select passages and choose **Keep wording**, **Keep meaning** or **Must cover**. Overlapping protections are allowed. Must cover prepares a chat prompt for extracting ideas; send it, import the complete JSON response and review the list.
3. Set an instruction and optional word budget. **Prepare rewrite** shows the full prompt. Copy it or explicitly insert it into the inspected chat draft. Send it yourself.
4. Add the completed rewrite to Reply and confirm completion. **Check only** verifies exact characters locally. Meaning checks prepare a chat request; import its complete JSON response to see verdicts and evidence.
5. Inspect missing, altered or uncertain ideas. Prepare a chat repair and check the revised draft. Changed verdicts appear when comparable ideas change status between checks.

Chat mode is a model review, not an independent Jev check. Wrong request tokens, stale replies, missing verdicts and invalid sentence references are rejected. Structural validation does not establish judgment accuracy.

Normal Ctrl/Cmd+Z works inside text boxes. **Undo selection** restores protection edits; Ctrl/Cmd+Z outside text boxes also triggers it. Editing source text clears marks whose offsets may no longer match.

## Optional API and CLI automation

Follow [companion setup](../companion/README.md), then open **Sites and connections → Connect API or local CLI**. Grant optional native-messaging access and connect the registered host. Choose **Local companion** for checking, and **API or local CLI** as writer when it should generate text too.

Provider/model selection, bounded repairs, tightening, style feedback, evidence and history remain available. Keys and CLI authentication stay in the companion. A web subscription is not an API credential. Cancellation detaches from results; a running provider call may finish.

## Compatibility

All five listed origins support permission-gated selection import through the same conservative adapter. Message picking requires accessible article elements; insertion requires exactly one visible composer. Unsupported layouts use copy/paste. DeepSeek's authenticated layout has not been inspected.

The extension presses Send only after the explicit **Send with Lossless** action. It does not intercept cookies or session tokens or import whole conversations in the background. Imported page text is plain text. Streaming completion is confirmed by the user. Inline controls appear on enabled sites; revoking site access removes them.

## Privacy and release status

See [privacy](PRIVACY.md) and [release checks](RELEASE-CHECKLIST.md). Documents use extension session storage until explicitly saved locally. Local saves are not encrypted or synced.

This preview has no billing, paid entitlements or hosted checking service. Managed subscriptions and one-click store installation need separate infrastructure, submission and approval.
