# Chrome release record

## 0.5.16 selection and rule workflow · 4 October 2026

- Keep meaning / Keep wording / Remove this are available for chat and PDF selections. Remove requests omit the selected content and paraphrases, while Unmark cancels a selection.
- Hosted checks evaluate removals separately from preservation. Exact forbidden wording is a local failure; local absence is never claimed as semantic success. Fix prompts delete excluded content rather than restoring it.
- Check reply works on the latest completed ordinary chat reply, without requiring a previous Lossless send. It includes saved writing rules, blocks streaming, discards stale results, and retains explicit confirmation for larger checks.
- The six quick actions are Selections, Check reply, Writing rules, PDF, Highlights and Sidebar. Highlights contains independent Source and Reply toggles. The X hides the launcher.
- Rule capture accepts natural style phrasing and explicit `Writing rules:` blocks. Verified newly sent user turns support remounted composers and new-chat URL changes. It never scans assistant replies for preferences.
- 86 extension tests and TypeScript checks pass. Hosted removal support deployed to lossless-api. Installed Chrome test captured a custom rule and returned a correct still-present removal finding on fictional text.
- Rebuild/package and Chrome Store upload are separate from installed testing. This version does not change permissions.

## 0.5.15 store identity · 1 October 2026

- Store draft ID: `cnnhnhonmpadooefbdnpokpipokghigb`. User-provided public key hashes to that exact Chrome ID; store builds fail on a mismatch.
- Exact store callback added to Supabase with user approval and verified in URL Configuration. Existing three redirects and shared Site URL remain unchanged. Callback guard accepts only the current unpacked and store identities; tests reject cross-identity completion and unexpected URLs.
- Separate `extension/store-dist` build pins the store public key without changing the existing unpacked installation's identity. Build with `npm run extension:build:store`; audit with `node scripts/audit-extension.mjs --store`.
- Five numbered 1280x800 RGB JPEG store screenshots prepared in `extension/store-assets`; all inspected. Images 01-03 use installed-extension captures; 04-05 are explicitly labelled source-derived UI previews. All examples are fictional. Upload archive: `chrome-store-five-screenshots.zip`.
- Store ZIP: `private/extension-release/lossless-rewrite-chrome-store-0.5.15.zip`. 77 extension tests pass. User confirmed Google sign-in works after installing the store-ID test build. Not submitted for review.

## 0.5.14 store preparation · 1 October 2026

- 77 extension tests pass; build and package audit pass. Candidate ZIP is `private/extension-release/lossless-rewrite-chrome-0.5.14.zip` (not yet the final store sign-in build).
- Automatic local capture of supported explicit writing preferences includes Undo, an off switch, bounded storage and no additional model call. Alt+Shift+R opens writing rules from the chat or panel, with help labels.
- User reports working ChatGPT, Claude, Gemini, Grok and DeepSeek flows. These reports supersede earlier login blockers; they are not a complete independent acceptance test of every feature on every provider.
- Publication blockers: obtain the store draft ID, add its exact Google/Supabase callback, rebuild and test sign-in with that identity, and refresh listing screenshots.
- Current writing-rule privacy disclosure deployed to production on 1 October 2026, deployment `dpl_JDtxs186Lf5dsGThXN3WuV3qGWyt`; canonical privacy URL responds with HTTP 200 and the new automatic-capture disclosure.
- Browser control rejects the developer dashboard. The user must create/upload the draft there; upload alone does not publish it. No submission or approval has occurred.

## 0.5.12 centred quick actions

- The round launcher sits at the exact centre of its open six-action menu. Edge clamping moves the wheel and centre together; dragging starts from the displayed position.
- Added direct PDF action. Source becomes Add source when there are no marked passages and opens a guide with the PDF alternative. Selections, PDF and highlight controls use visible button borders and active states.
- 72 extension tests and TypeScript checks pass. Local browser fixture confirmed zero-pixel centre difference, the empty-source guide, and PDF routing without sending a chat message. The installed build needs reload and chat refresh.

## 0.5.11 compact PDF reader

- After opening a PDF, collapse upload guidance, shorten the file row and hide the linked-chat label to give the document more height. Initial guidance explains that a chat attachment is not automatically available inside Lossless. Fit/zoom and selected passages stay available.
- Reset browser test viewport and closed the duplicate ChatGPT preview to restore chat space. Further narrow layout tests use a local fixed-width fixture, not browser-wide emulation.


## 0.5.10 PDF panel and writing rules · 30 September 2026

- Open PDF switches the tab-specific Chrome side panel to a local reader. Drag/drop or click a PDF; fit, zoom and page navigation retain selectable text. The UI distinguishes marked passages sent to chat from the full PDF, which stays local.
- Writing rules are explicitly saved on this device, editable and switchable, and included in future Lossless sends across chats. Rule-only sends work. Hosted Jev checks evaluate compliance separately from semantic coverage, use the existing credit quote/reservation flow, and preserve uncertainty. The companion and full editor do not check these saved rules yet.
- 71 extension tests and TypeScript checks pass. Browser fixture checks cover PDF rendering, navigation, zoom, selection and marking, plus narrow rules-dialog editing and saving. Chrome transport is simulated in these UI fixtures.
- Hosted API v12 deployed with existing authenticated-user validation. A synthetic live run returned kept for an English-language rule and missing for a numbered-list rule, and preserved the source claim. Earlier active-voice judgment was uncertain. This is a smoke test, not evidence of general style-check accuracy. Duplicate request rejection and one-credit usage recording passed. Temporary test accounts were removed.
- Installed ChatGPT content script reports 0.5.10 after the user's reload. Open PDF was clicked without sending or altering the user's pending draft. User screenshot confirms the native PDF panel opened beside ChatGPT. The empty reader and ChatGPT attachment preview are separate. Browser-control viewport override was cleared after it squeezed the user chat; ChatGPT viewport width restored to 1534px. No user prompt was sent.


## 0.5.9 overlay fixes · 30 September 2026

- Fixed the Selections card inheriting the 44px launcher width; card and menu are clamped to the viewport. Removed repeated instructions from the selections view.
- Reply highlighting compares rendered text before invalidating: cosmetic nodes/action buttons and same-text reply replacements now rebuild ranges without losing highlights. Actual reply changes still invalidate them.
- Five menu actions: Source highlights, Reply highlights, Selections, Sidebar and Hide. Source/reply preferences persist independently; Alt+Shift+H toggles both. The logo can be dragged (or moved with Alt+arrow keys), with its position saved. × hides the launcher; sidebar Selections & PDF restores it.
- 66 extension tests pass, including highlight lifecycle, independent preferences and viewport bounds. Local browser checks confirmed readable selections, dragging without sending/opening, five actions, reply highlights surviving added markup and replacement nodes, separate toggle states, and Hide. Installed 0.5.9 still requires reload and refresh.

## 0.5.8 quieter controls · 30 September 2026

- Keep wording and Keep meaning use consistent amber/green buttons in the chat, editor and PDF reader. Marking a chat passage leaves its source colour and returns focus to the composer without a success popup.
- Completed checks use a small logo badge. Findings are available on demand; they do not open the card or scroll the page. A compact radial menu opens Highlights, Selections/checks and Sidebar. Escape and outside clicks close it.
- Reply highlights distinguish matching marked wording from other wording (blue), without guessing semantic evidence. The colour preference persists and applies to sources and replies. Regeneration invalidates old reply highlights.
- Worker tracks sidebar presence per browser window; the launcher returns on close. Only trusted extension panel ports and supported top-level chat tabs can use these controls. Opening the sidebar does not run a check or send a prompt.
- 63 extension tests and typecheck passed. Local browser fixture verified mixed source/reply colours, one send, quiet check results, off toggle, stale reply clearing, and sidebar visibility. This uses simulated Chrome transport; installed 0.5.8 needs the usual manual reload and refresh.
- Supersedes the 0.5.7 candidate. Not submitted to the store; store callback registration and broader installed-platform acceptance remain pending.

## 0.5.7 release candidate · 30 September 2026

Status: packaged and prepared; NOT submitted or published to the store.

- Reproduced the reported prompt rejection in installed ChatGPT 0.5.6. The editor inserted all text but rendered paragraph separators as double/five newlines. The verifier now tolerates paragraph spacing while rejecting changed/missing words, punctuation, spaces and merged lines. Explicit-send and stale-draft tests remain in place.
- Browser verification with the actual 0.5.7 bundle and a paragraph-based contenteditable composer sent the complete prompt exactly once. The local fixture simulates Chrome APIs and calls no model; installed provider acceptance remains separate.
- Gemini composer detection now prefers its observed labelled textbox over its Quill clipboard helper. Claude and Gemini reply selectors target observed assistant-only content bodies. These fixes require a reload for installed acceptance.
- 60 extension tests pass; TypeScript and extension build pass. Package audit: 209 files, 8,801,348 uncompressed bytes; no matched credential patterns or external script tags. Audit output and candidate ZIP are in ignored private/extension-release.
- Updated public privacy policy: https://lossless-rewrite.vercel.app/privacy.html. Store description, privacy answers and reviewer instructions are in STORE-LISTING.md. Paid plans remain Coming soon; checkout disabled.
- Captured a genuine installed ChatGPT selection screenshot at 1280×800 and a 440×280 promotional image. The screenshot shows the existing 0.5.6 UI; it is not proof that the 0.5.7 send fix passed installed testing.

### Acceptance status

| Boundary | Evidence | Remaining |
| --- | --- | --- |
| ChatGPT | Installed error reproduced; paragraph-spacing regression passes | Reload and test one complete 0.5.7 send/check |
| Claude | Signed-in synthetic prompt and reply observed; precise assistant body identified | Reload and verify Lossless send, check, highlighting |
| Gemini | Labelled composer and second Quill editor observed; detection fixed | Service returned an error to the plain sample prompt; full Lossless test pending |
| Grok | Composer and Submit control observed | Logged out; sending presents acceptance of provider terms, so no test sent |
| DeepSeek | Sign-in page observed | User login/terms required; no credentials or account created |
| Google / Free checks | Existing unpacked callback and backend tests previously verified | Register and test the separate store-issued extension ID |
| PDF | Existing local reader/selection harness and project tests pass | Installed 0.5.7 PDF round-trip pending |
| Preregistration | Confirmation delivered to owner Gmail; footer unsubscribe removed only owner Pro interest | Complete |
| Store upload | Candidate ZIP, copy, privacy and artwork prepared | Browser control rejects developer dashboard access; manual draft upload required |

Do not advertise complete platform compatibility until the corresponding installed checks pass. Uploading a draft is necessary to obtain the store ID; it does not authorize declaring untested functionality ready. Add that exact callback to Supabase's redirect allowlist and the extension callback guard, rebuild, then verify Google login before submitting for review. Do not replace the shared project's Site URL or remove other applications' redirects.

Official submission references: https://developer.chrome.com/docs/webstore/publish, https://developer.chrome.com/docs/webstore/images, https://developer.chrome.com/docs/webstore/cws-dashboard-privacy.

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
