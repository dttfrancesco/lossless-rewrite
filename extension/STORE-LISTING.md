# Chrome Web Store submission copy

Prepared for 0.5.15, store draft `cnnhnhonmpadooefbdnpokpipokghigb`. This is a draft, not a publication record. The exact store callback is registered; the user confirmed Google sign-in works in the store-ID test build.

**Name:** Lossless Rewrite

**Short description:** Cut words, not ideas. Keep important passages in AI rewrites and check what survived.

**Category:** Productivity / Tools

**Homepage:** https://lossless-rewrite.vercel.app/

**Privacy:** https://lossless-rewrite.vercel.app/privacy.html

**Support:** https://github.com/dttfrancesco/lossless-rewrite/issues

## Description

Asked AI to shorten something, then noticed an important idea had disappeared?

Lossless Rewrite helps you condense writing while keeping the passages that matter. Use your existing AI chat to write. Lossless adds your selections to the request and checks the finished reply.

1. Select a passage in your chat or a PDF. Choose Keep meaning or Keep wording.
2. Write your request, such as “Shorten this to 150 words.”
3. Press Ctrl+Shift+Enter. On Mac, use Command+Shift+Enter.
4. Check the reply. If something is missing or changed, prepare a fix in the same chat.

A few uses:
- Condense a paper's discussion while keeping its findings and caveats.
- Combine related work without losing selected claims or attribution.
- Simplify a policy while retaining its conditions.
- Change an email's tone while keeping the message.

Works beside ChatGPT, Claude, Gemini, Grok and DeepSeek chats. Mark passages in the conversation or open a local PDF beside it. Toggle source and reply highlights separately, and move or hide the small round control.

Save writing preferences such as “Use British English” or “Avoid em dashes.” Supported explicit style requests at the start of messages you send can be remembered automatically on your device, with Undo. Edit the list or turn capture off under Writing rules. Alt+Shift+R opens it; on Mac, use Option+Shift+R. Saved rules are included in future Lossless sends and can be checked against the finished reply.

Exact wording checks are local and free. Google sign-in includes 25 meaning-check credits each month, powered by Jev. No API key is needed. Larger checks show their credit cost first. PDF files stay on your device; selected passages can be sent with your request.

Plus and Pro are coming soon. Their interest lists require no payment or subscription.

AI checks can be wrong. Review important results. Your chat provider's account and usage requirements still apply. Lossless Rewrite is independent and is not affiliated with the AI chat providers.

## Privacy form answers

**Single purpose:** Preserve user-selected wording and ideas when condensing or rewriting text in an AI chat, and check the completed rewrite for those selections.

**Permissions:**
- sidePanel: display the rewrite editor, instructions, account and settings.
- storage: retain per-chat selections, editor state, sign-in session and optional local saves.
- scripting: insert the selection controls and explicit-send integration on declared AI sites.
- activeTab: identify the current chat when opening the extension.
- identity (optional): complete Google sign-in through Chrome's authentication popup.
- nativeMessaging (optional): connect the user's locally installed Jev companion.
- AI site host permissions: show controls, read the user's selected text and current draft, recognize supported writing preferences locally when a message is sent, insert an explicitly requested prompt, and inspect the completed reply. Automatic rule capture can be disabled; it does not scan conversation history.
- Supabase host permission: authenticate and make account, usage, meaning-check and preregistration requests.

**Remote code:** No remote executable code. JavaScript, PDF.js, workers and fonts ship in the package. Network requests exchange data, not executable scripts. Native messaging is optional and requires a separately installed local companion.

**Collected data categories:** Personally identifiable information (verified email/account ID); authentication information (session tokens); website content (selected text and replies); personal communications if users select messages or emails for rewriting. Do not claim that text cannot contain sensitive information. No payment data is collected during the free launch. No browsing-history collection, advertising or unrelated profiling.

**Use:** Only the described rewriting/checking, authentication, usage limits and opted-in plan updates. Never sell or use for advertising, creditworthiness or unrelated purposes. The public privacy policy describes Supabase, Jev, Brevo, local storage, retention and deletion contact.

## Reviewer instructions

Use a supported signed-in AI chat and synthetic source text, e.g. “The pilot lasted six weeks. Accuracy improved by 12%. There was no control group.” Select the last sentence, choose Keep wording, type “Shorten this to one sentence,” then Ctrl+Shift+Enter. The prepared prompt should be sent once, and the reply's exact wording checked locally. No Lossless account is needed for this path. Alt+Shift+H toggles matching text highlights.

For hosted meaning checks, sign in with Google from Account, protect a passage with Keep meaning and choose Check finished reply after the model finishes. Each new verified account has 25 free credits/month; no paid purchase or API key is necessary. Owner credentials are not needed.

Optional native companion setup is not required for hosted checks. Paid checkout is disabled. Private test accounts can use unreleased automatic checking and saved reference projects; these are not advertised as Free features.

To test writing rules, send “Avoid em dashes.” in an existing chat. The local capture notice offers Undo. Open Writing rules with Alt+Shift+R to inspect, edit or disable capture. More complex preferences can be added manually. Detection does not call an extra model; hosted compliance checks do use Jev and consume displayed credits.
