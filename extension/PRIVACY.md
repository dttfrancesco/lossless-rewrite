# Extension privacy

Applies to the 0.2.0 unpacked preview. Updated 30 September 2026.

- Source text, rewrites, selected ideas and check history use Chrome extension session storage. **Save locally** stores one document in local extension storage; **Clear document** removes that saved copy and resets the session document. Uninstalling removes extension storage. Local saves are not encrypted by Lossless Rewrite. There is no browser sync.
- The extension has no analytics, advertising SDK, account system or hosted data collection endpoint. The local UI test harness is excluded from the installable build.
- Site permissions are optional and limited to the listed AI origins. Clicking import reads your selection or chosen message. Prompt insertion is explicit and checks that the inspected draft has not changed. The extension does not submit chat messages.
- In chat mode, you decide when to send source material, selected ideas and drafts to your chat provider. That provider's terms and privacy settings apply. A chat review is produced by that provider, not by a separate Lossless service.
- In companion mode, the companion sends the necessary text to your configured writer/checker providers, including Jev when configured. Their terms apply. Keys and CLI login credentials are handled by the companion, not stored in the extension or placed in chat prompts.
- The optional native-messaging permission connects only to the configured Lossless companion. No clipboard reading happens in the background. Clipboard writes and downloads require an explicit user action.
- Sharing an exported evidence file can reveal the full source and rewrite. Review it before sharing.

The extension does not make confidentiality, correctness or publisher-compliance guarantees. Use only material you are permitted to process with the chosen provider. Contact the maintainer through the public repository for product questions; do not post private manuscript text or credentials in issues.
