# Lossless Rewrite for Chrome

**Cut words, not ideas.** Keep selected ideas, exact wording and writing requirements when condensing text in your existing AI chat.

Version **0.5.15** supports ChatGPT, Claude, Gemini, Grok and DeepSeek. The store listing is being prepared; this guide installs the source build. Site layouts can change. [Validation status](../docs/REVIEW.md).

## Install

Requires Git, Node.js 22.16+ and Chrome 116+.

```sh
git clone https://github.com/dttfrancesco/lossless-rewrite.git
cd lossless-rewrite
npm ci
npm run extension:build:store
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `extension/store-dist`.
3. Pin Lossless, open a supported chat and click the extension icon.

The public key in `store-identity.json` gives this build the project's store identity and registered Google sign-in callback. It is not a secret. For a separate development identity use `npm run extension:build` and load `extension/dist`; hosted sign-in only works with a registered callback. Forks need their own identity and backend configuration.

To update, rebuild the same folder, click **Reload** and refresh chat tabs. Disable any older duplicate installation. On PowerShell, use `npm.cmd` if needed.

## Rewrite in your chat

1. Select a passage. Choose **Keep meaning** to allow paraphrasing, or **Keep wording** for exact text. You can keep several passages and overlap protections.
2. Write an instruction in the chat box, such as `Condense this discussion to 300 words.`
3. Press **Ctrl+Shift+Enter** (Mac: **Command+Shift+Enter**). Lossless adds the marked passages and enabled writing rules, then sends through the current chat.
4. After the reply finishes, choose **Check finished reply**. Open **Selections** to inspect findings. **Fix in chat** prepares a complete repair request; review it and send it yourself.

Your last chat selection is remembered when you move to the composer, even without pressing Keep meaning. Use the Keep buttons to retain several passages. The send shortcut also works while source text is selected, provided you already have a draft in the chat box. Marking a passage alone does not choose an editing instruction or send a message.

A leading `/lossless` or `/loseless` with normal Send still works. Ordinary messages and Shift+Enter are unchanged. If the chat changes, access is removed or the composer cannot accept the complete prompt, Lossless stops. An unrecognized Send control leaves the prepared draft for manual sending; it does not retry automatically.

Selections are scoped to the tab and conversation. They survive refresh during the browser session, clear when the tab closes or you move to a different existing conversation, and follow a new chat into its assigned URL after the first explicit send.

## Check meaning

Open **Account → Continue with Google**. Free includes **25 check credits per calendar month**, with no checking API key or companion installation. Your existing chat provider's account and limits still apply.

On Free, choose **Check finished reply**. One normal-sized check uses one credit; larger checks show a quote first. Both selected meanings and enabled writing rules count toward check size. Exact-wording checks run locally. Failed provider requests release reserved credits; no automatic retry is made.

Hosted checks currently use Jev through the project's Supabase endpoint. A meaning verdict can be wrong or uncertain. Only marked requirements and enabled rules are individually checked, not the truth or completeness of the entire document.

## PDF references

Choose **PDF** from the round menu, or **Selections & PDF → Open PDF** in the sidebar. Drop a PDF into the reader or click to choose one. The reader replaces the Lossless sidebar and leaves the chat visible. Drag the panel edge to resize it.

Select text on a page and click **Keep meaning** or **Keep wording**. Its filename and page number accompany the passage when you send with Lossless.

**Only marked passages are sent.** The full PDF stays on your device. Attach it in the chat as well if you want the model to read the whole document. Opening a file in the chat does not automatically open it in the Lossless reader.

Selectable-text PDFs up to 25 MB are supported. Scanned pages need OCR elsewhere. Saved multi-PDF reference projects are in private testing for the planned Pro tier; the basic PDF reader is available now.

## Writing rules

Open **Writing rules** or press **Alt+Shift+R**. Add one specific rule per line, such as `Keep uncertainty explicit when discussing results.` Save, edit or disable rules at any time.

Rules apply to future **Lossless sends across chats on this device**. They do not modify ordinary chat messages. Supported explicit preferences at the start of a sent message, such as `Always use British English.` or `Avoid em dashes.`, can be remembered automatically. Capture offers Undo and an off switch. It runs locally, without another model call or scanning earlier conversations. Temporary word limits, quoted examples and AI replies are ignored.

Hosted reply checks assess enabled rules alongside selected ideas. Failed rules can be included in **Fix in chat**. Rules can be used without any marked passage. The full editor and optional native companion do not currently check these saved rules.

## Highlights and quick controls

- **Amber:** matching text from Keep wording selections.
- **Green:** matching text from Keep meaning selections.
- **Blue:** other wording in the reply.

Colours are a text comparison, not a semantic verdict. A paraphrase may be blue even when its meaning is retained. Source and Reply toggle independently.

Drag the round logo to move it. Its six actions are **Source, Reply, Selections, PDF, Sidebar and Hide**. With no source selected, Add source opens guidance. Check status stays on the logo; results open when requested. Hide or × dismisses the launcher; restore it from the sidebar. Escape or an outside click closes open controls.

| Shortcut | Action |
|---|---|
| Ctrl+Shift+Enter / Command+Shift+Enter | Send the current draft with selections and enabled rules. |
| Alt+Shift+L / Option+Shift+L | Add `/lossless` without sending. |
| Alt+Shift+H / Option+Shift+H | Toggle source and reply highlights. |
| Alt+Shift+R / Option+Shift+R | Open writing rules. |
| Shift+Enter | Insert a new line. |
| Escape | Close the popup or menu. |

The sidebar's **Shortcuts** button and the popup's **?** explain these in the app.

## Full editor

Open **Check a rewrite** for the source/reply editor. It supports existing drafts, overlapping protections, undo, evidence and export.

- **Keep wording / Keep meaning:** mark source passages.
- **Must cover:** prepare a request to extract a section's ideas. Send it in your chat, import its structured response and review the checklist.
- **Prepare rewrite:** review the prompt, copy or insert it, then send in your chat.
- **Check only:** verify exact wording locally; use chat-based review or the optional companion for meaning.
- **Fix in chat / style feedback:** prepare a revision and recheck the result.

Chat-based review requires importing the full structured response. It is separate from hosted inline checks. Editing source or reply invalidates old checks. Ctrl/Cmd+Z works inside text fields; **Undo selection** restores marks. The full editor's local saves are unencrypted.

## Use your own checking key

Available on Free, but requires the optional local companion. Open **Set up checks → Use your own Jev key instead** for instructions and the setup command with your extension ID.

1. Get a key from the [TypeSafe console](https://console.typesafe.ai/keys).
2. Add `TYPESAFE_API_KEY=your_key_here` to the repository's private `.env.local` file.
3. Follow the [companion guide](../companion/README.md) to register the local host, then choose **Connect and check setup**.
4. For the full editor, choose **Sites and connections → Jev · local connection**. For inline replies, enable automatic companion checks in the setup dialog.

Signed-in hosted account checks take priority. Sign out of the Lossless account to use the companion for inline checks. Companion usage goes to your own provider account, not the 25 included credits. Connection setup checks configuration, not key validity. The companion checks meaning only; writing and repairs stay in your chat, and uncertain checks do not call a second model. Saved writing-rule checks currently require the hosted path.

## Plans and privacy

**Free is available now. Plus and Pro are coming soon.** Compare plans shows provisional pricing and capabilities, with an interest list rather than checkout. Joining sends a confirmation email; unsubscribe in that email or remove interest in the extension. Private testers have access to automatic checks and saved reference projects. These are not public Free entitlements.

[Privacy policy](PRIVACY.md) explains local storage, Google/Supabase authentication, text sent for hosted checks, optional companion processing, plan-update emails and deletion requests. Do not put API keys or private manuscript text in public issues.

## Troubleshooting

- **Old UI or “Extension context invalidated”:** Reload the extension, then refresh the chat. Old tabs cannot keep using a replaced extension context.
- **Nothing to send:** write an instruction in the composer and select a passage, or enable a writing rule.
- **No controls:** ensure this is a supported site and Chrome allows the extension access. Reopen the sidebar and detect the current chat.
- **Reply not automatically detected:** choose Check finished reply. Free checks are manual by design.
- **Changed provider layout:** use the full editor's copy/paste path and report the site and behaviour with fictional text.
- **Sign-in callback error:** use the store build above. Custom IDs and forks need their own registered callback.

The user has reported working flows on all five declared platforms. That is not a complete automated acceptance test of every account, locale or site layout. [Release record](RELEASE-CHECKLIST.md).
