# Chrome release record

## 0.4.9 identity and pricing polish

- Added a geometric text/L mark, matching sidebar and pricing wordmarks, and refreshed Chrome icons at all four sizes. SVG source is included.
- Refined the white plan cards with aligned pricing, quieter borders, consistent spacing and checkmark lists.
- Extension build passed; pricing and sidebar were visually reviewed, with no horizontal overflow at 360px. Installed Chrome still requires reload.

## 0.4.8 plan comparison

- Compare plans opens a bundled comparison page with Free, Plus and Pro cards, prices, proposed allowances and concise feature bullets. Desktop shows three columns; narrow screens stack cards.
- The page labels subscriptions and included checks as unavailable. Paid buttons are disabled Coming soon; Use free preview opens the working extension panel. No checkout or account collection is implied.
- Build and local browser navigation/layout checks passed. Reload the installed extension to get the new page.

## 0.4.7 white theme

- Sidebar, dialogs, inline controls and PDF reader use white surfaces, neutral borders and dark controls. Only semantic text highlights and errors retain colour.
- Fixed the launcher hint rule so the shortcut label inside Show kept text does not inherit a divider and oversized padding.
- Built and visually checked the sidebar at 420px; white page/header backgrounds verified in the local browser harness. Installed-extension verification still requires reload.

## 0.4.6 decision-only companion

- Companion checks explicitly disable LLM adjudication. Missing/uncertain results remain visible; no writer, extraction, repair or CLI call can be requested through this host.
- The extension removes writer/model/pass controls and routes Fix in chat, style edits and optional idea extraction to explicit prompts in the current conversation.
- Requires decision-only-v1 in the companion handshake; old hosts are refused. Restart Chrome after updating the source-run companion.
- Regression tests cover uncertain/missing evidence, rejection of legacy generation operations, and the old-host guard. Type checking, extension build, native source/Windows launcher tests and the local browser UI harness passed. Installed-extension/provider verification remains separate.

## 0.4.5 insert command shortcut

- Alt+Shift+L (Mac: Option+Shift+L) inserts /lossless into the focused chat draft without submitting; existing text stays intact and repeated presses do not duplicate the command.
- Ctrl+Shift+Enter still sends directly. Keyboard help and onboarding say text marked to keep, with selection instructions.
- 42 extension tests and the production extension build passed. Installed-browser verification of this new shortcut remains pending a manual reload.

## 0.4.4 send shortcut

- Ctrl+Shift+Enter (Mac: Command+Shift+Enter) sends the focused chat draft with its saved passages without requiring /lossless. Normal Enter remains unchanged; empty drafts and empty selections are refused. Existing draft/navigation/access checks and duplicate-send prevention remain in place.
- The sidebar header has visible Shortcuts help, and the inline popup has a ? button. Onboarding and PDF save guidance explain the shortcut. Mac labels are adapted to Command/Option.
- All 41 extension tests pass. The local browser harness verified a single enriched send from a plain textarea draft and a rich editor, two rapid shortcut presses producing only one request, an unchanged ordinary Enter send, and Shift-Enter preserving its newline. Installed platform shortcut acceptance remains pending.

## 0.4.3 reply highlights

- Show kept text and Alt+Shift+H toggle visual matches in the latest identifiable assistant reply. Wording is amber, meaning selections green, and wording wins for overlapping spans. No model or API request is made by highlighting.
- Uses browser highlight ranges without replacing reply nodes or editing content. Whitespace is normalized for locating visible text; paraphrases and semantic correctness are not inferred. Unmatched passages remain unverified.
- The local browser harness verified a match spanning bold and plain text, shortcut activation, button dismissal and clearing after a reply edit. All 39 extension tests pass, including repeated matches, offsets, overlaps, missing passages, Unicode and range limits. Installed highlight rendering still requires acceptance on each advertised provider.

## 0.4.2 quieter controls and command feedback

- Removed the permanent composer bar. Controls appear for a text selection, a leading /lossless request, or an explicit Selections & PDF action. Click outside, press Escape or use × to dismiss; receipts expire after eight seconds.
- Empty-selection requests stay unsent with the original draft intact. Readiness and receipts distinguish prompt enrichment from Jev checking. Sending still does not automatically check the reply.
- Set up Jev is available on the launcher's first screen, with the key-console link, local configuration instructions, an extension-ID-specific companion command and connection feedback. No credentials are stored in prompts or in the extension.
- Installed ChatGPT inspection found the cause of literal commands reaching chat unchanged: an editable answer made the composer ambiguous. The adapter now recognizes the labelled Ask ChatGPT input inside its form; a regression test confirms that insertion never edits the answer block.
- All 36 extension tests pass. The local browser harness verified empty-selection refusal, single submission through textarea and rich-text composers, Shift-Enter, outside-click dismissal, automatic receipt expiry and the setup screen at 400px width. Installed acceptance of the composer fix remains pending; no new cross-provider or live Jev claim is made.

## 0.4.0 conversation workflow

- Chat origins are declared at installation for automatic detection and injection. Chrome may require accepting the changed permissions when reloading/updating from 0.3.x. No all-sites or history permission is added.
- Select chat text, Keep meaning/Keep wording, then send a leading /lossless request with normal Enter or Send. A bundled local PDF reader adds selected passages with filename/page provenance to that same conversation. Source files are not uploaded.
- Browser harness verified a real DOM passage selection, one normal-button slash send, an unchanged ordinary Enter send, Shift-Enter newline, a rich-text slash Enter send, PDF.js rendering/page navigation/selection, and one combined chat+PDF request. Tests use the actual bundled content script and worker selection store with simulated Chrome transport, not a claim of installed compatibility.
- Unit tests cover isolation between conversations, new-chat migration only after an explicit send, serialized concurrent additions, stale reader rejection, bounded passages, overlapping protections and slash parsing. The public PDF.js basicapi.pdf was used only as a private test fixture; no unpublished paper content was used.
- Installed 0.4.0 site acceptance is still pending. Live output checking remains a separate editor/companion operation; there is no automatic semantic verdict from slash sending.

## 0.3.1 activation fix

- Removed the disabled-button dead end when Chrome does not expose the active tab URL before host access is granted. The launcher now offers an explicit five-site picker and requests only the selected origin.
- The current window is used for tab detection and is checked again after permission is granted. Activation distinguishes an available composer from an enabled site without an identifiable composer.
- Verified in the browser harness with the active tab URL initially withheld: Choose your chat site → ChatGPT → simulated permission grant → activation confirmation. All 31 extension tests pass. Installed confirmation is still pending.

## 0.3.0 preview

- User confirmed the 0.2.0 installed sidebar opens, but reported a crowded and confusing interface.
- Replaced the default view with a small launcher. Added optional inline controls, complete prompt review and explicit sending through the current chat provider. The full checker remains behind Check a rewrite.
- Local browser harness verified one send through textarea and contenteditable composers using the actual bundled content script. The harness is a synthetic page with simulated extension permission APIs; it does not establish installed-provider compatibility.
- Transaction tests cover draft edits, navigation, permission revocation, unknown send controls, prompt limits and rich-editor blank blocks. No auto-send, automatic verification or subscription service is claimed.
- Installed 0.3.0 acceptance remains pending. Reload the extension and refresh chat tabs before testing this version.

## 0.2.0 preview

- Packaged MV3 source, no remote executable code, no all-sites permission.
- Optional native messaging; chat workflow and local exact checks do not require the companion.
- TypeScript checking passed. All 29 engine/native tests and 23 extension tests passed. One synthetic check was sent to Claude and its real JSON response was accepted by the UI harness, identifying the omitted speed finding. This verifies the manual round-trip only, not installed content-script behavior or general model accuracy.
- Browser UI harness uses the actual built panel bundle with simulated Chrome APIs. It does not prove installation, permissions, native messaging or content-script injection.
- Browser control blocks chrome://extensions; installed reload/testing could not be completed automatically.
- ChatGPT and Gemini expose accessible contenteditable textboxes in the observed browser; Grok exposes a textarea. DeepSeek requires login. These observations do not establish installed adapter acceptance.

## Before store submission

- Load the package and test each claimed platform: enable/revoke access, selected import, message picking or clear fallback, complete prompt insertion, draft-change refusal, streaming/regeneration/navigation invalidation.
- Verify only explicit actions send text to providers. Test worker restart and absent native host. Exercise selection, overlapping marks, undo, 320px sidebar, 200% zoom and expanded editor.
- Test actual model inventory/check JSON with correct and malformed responses. Review judgment accuracy separately from parser validation.
- Publish privacy at a stable public URL. Complete store data-use disclosures consistently with behavior and configured providers.
- Capture genuine installed-extension screenshots, verify icon and package contents, and complete publisher account and submission requirements.
- Resolve provider access/automation constraints for advertised integrations. User-clicked actions do not by themselves settle provider terms.
- Before a managed paid plan: implement real authentication, server-enforced quotas, checkout, entitlement verification, deletion and processing disclosure. No client-side paid toggle or unavailable-plan advertising.

No store publication or subscription launch is claimed by this preview.
