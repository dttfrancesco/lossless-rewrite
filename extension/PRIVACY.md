# Extension privacy

Applies to the 0.4.0 unpacked preview. Updated 30 September 2026.

- Source text, rewrites, selected ideas and check history use Chrome extension session storage. **Save locally** stores one document in local extension storage; **Clear document** removes that saved copy and resets the session document. Uninstalling removes extension storage. Local saves are not encrypted by Lossless Rewrite. There is no browser sync.
- The extension has no analytics, advertising SDK, account system or hosted data collection endpoint. The local UI test harness is excluded from the installable build.
- The manifest requests access only to ChatGPT, Claude, Gemini, Grok and DeepSeek origins so controls can appear automatically. Chrome manages that access. No all-sites or browsing-history permission is requested.
- Selecting a passage and clicking Keep wording or Keep meaning saves that passage, its protection type and source label in extension session storage for the current chat tab and conversation. PDF selections include filename and page number. Clear selections removes them; closing the chat tab removes its selections and reader bindings. They are not synchronized or encrypted by Lossless.
- The PDF reader opens files chosen from your device using bundled PDF.js code, worker, fonts and character maps. It does not upload the PDF. Selected passages are sent only with a subsequent `/lossless` request. Scanned-image OCR is not included.
- Submitting a draft beginning with `/lossless` through Enter or the site's Send button reads that draft, adds the chat's saved selections locally, and submits the resulting prompt to that same chat provider. There is no separate confirmation dialog. Messages without the command are unchanged. Shift-Enter remains a newline. Unknown send controls leave the prompt staged for manual sending; there are no automatic retries. Site permission is checked before insertion and submission.
- In chat mode, you decide when to send source material, selected ideas and drafts to your chat provider. That provider's terms and privacy settings apply. A chat review is produced by that provider, not by a separate Lossless service.
- In companion mode, the companion sends the necessary text to your configured writer/checker providers, including Jev when configured. Their terms apply. Keys and CLI login credentials are handled by the companion, not stored in the extension or placed in chat prompts.
- The optional native-messaging permission connects only to the configured Lossless companion. No clipboard reading happens in the background. Clipboard writes and downloads require an explicit user action.
- Sharing an exported evidence file can reveal the full source and rewrite. Review it before sharing.

The extension does not make confidentiality, correctness or publisher-compliance guarantees. Use only material you are permitted to process with the chosen provider. Contact the maintainer through the public repository for product questions; do not post private manuscript text or credentials in issues.
