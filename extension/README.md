# Lossless Rewrite for Chrome

**Cut words, not ideas.** Protect key ideas or exact wording, condense your text in your usual AI chat, and review what survived.

Version 0.4.0 is an unpacked preview, not a Chrome Web Store release. ChatGPT, Claude, Gemini, Grok and DeepSeek are the five declared chat origins. Full installed-site acceptance remains pending. Copy/paste works with other tools too.

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

1. Open a supported chat. Lossless detects it automatically after Chrome grants the extension access to the five declared chat sites.
2. Select text in the conversation and choose **Keep meaning** or **Keep wording**. Overlapping selections can use both. The **Lossless · N kept** button shows your selections and lets you remove them.
3. To use a PDF reference, choose **Open PDF** beside the chat box. Open a file from your device, select text on a page, and choose what must stay. The reader is linked to that conversation.
4. Start your request with **/lossless**, for example `/lossless Condense this discussion to 300 words.` Press Enter or click the chat's normal Send button once.

Lossless removes the command, adds your selected passages and preservation instructions, then sends through the current site's composer. Ordinary messages and Shift-Enter are unchanged. There is no second submission or prompt-review dialog. If a Send button cannot be identified, the enhanced text stays in the composer for manual sending. No automatic retries are made.

Selections belong to the current tab and conversation, survive a page reload during the browser session, and are removed when the chat tab closes. Moving between existing conversations clears them. After an explicit first send, selections follow a new chat into its assigned conversation URL.

The local PDF reader supports selectable text, page navigation, files up to 25 MB, and passages up to 12,000 characters. It includes the filename and page number with each selected passage. The entire PDF is not uploaded. Scanned pages need OCR elsewhere. Chrome's built-in PDF viewer and arbitrary embedded PDF viewers are not injected; open the downloaded reference using **Open PDF**.

This streamlines sending. It does not automatically check or repair the resulting reply. Use the checker below for that.

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

The extension presses Send only as part of your explicit `/lossless` submission. It does not intercept cookies or session tokens or import whole conversations in the background. Imported page text is plain text. Streaming completion is confirmed by the user. Inline controls appear on the declared chat sites. Chrome manages site access.

## Privacy and release status

See [privacy](PRIVACY.md) and [release checks](RELEASE-CHECKLIST.md). Documents use extension session storage until explicitly saved locally. Local saves are not encrypted or synced.

This preview has no billing, paid entitlements or hosted checking service. Managed subscriptions and one-click store installation need separate infrastructure, submission and approval.
