# Chrome release record

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
