# Local companion

This source-run native host provides decision-only verification to the extension. It is an implemented development transport, not a packaged installer or a tested browser-store release. Node 22.16+ and this repository's `npm install` are required. Keep this checkout at its installed location; moving it requires regenerating registration.

## Install for a private local trial

1. Build/load the unpacked extension following `extension/README.md`. Copy its exact 32-character extension ID from the browser's extensions page.
2. Configure `.env.local` as for the app. Set TYPESAFE_API_KEY for Jev. No writing-model key or CLI login is needed. No keys are copied to the extension. “Configured” reports presence of configuration, not a tested login.
3. Generate installation files (this does **not** register anything):

   ```sh
   npx tsx companion/setup.ts --extension-id YOUR_EXTENSION_ID --browser chrome
   ```

   Use `edge` for Edge. On PowerShell, use `npx.cmd` if the shell's wrapper drops arguments. The generator refuses to overwrite an existing setup.

4. Review the files in `companion/local`. On Windows run `build-launcher.ps1`, then deliberately run `register.ps1`. The build uses the Windows .NET Framework C# compiler to create a small binary relay; registration writes a single **current-user** native-host registry key. No administrator rights are required. On macOS/Linux run `sh companion/local/register.sh`, which copies the manifest into your browser's current-user native-messaging directory.
5. Reopen the extension panel and check the companion and checker statuses. Try a wording-only check before a paid semantic request.

Uninstall using the generated `unregister.ps1` or `unregister.sh`, then remove the unpacked extension. These scripts only remove registration when it still belongs to this installation. The source checkout, `.env.local` and local CLI logins remain. Do not commit `companion/local` or `local-config.json`; both are ignored.

The launcher forwards binary stdio unchanged, sets the repository working directory and uses the absolute installed Node path. Windows requires a real launcher executable; the generator does not rely on Chrome supporting batch files. Linux/macOS launch scripts and their registration paths still require a real-platform trial. Edge browser integration is also unverified.

## Troubleshooting

| Symptom | Check |
|---|---|
| Companion disconnected | Build the Windows launcher before registering it. Confirm the generated manifest uses the exact currently loaded extension ID. Reopen the panel after registration. |
| Checker not configured | Put `TYPESAFE_API_KEY` in this checkout's `.env.local`, then reconnect the companion. A configured key can still be rejected by the service. |
| Update companion required | Update this source checkout and restart Chrome. Version 0.4.6 requires a companion reporting decision-only-v1; older hosts could call a second model. |
| Source/reply cannot be imported | Enable access for that chat site in the panel. Unsupported or ambiguous layouts can use copy/paste; review the complete captured text. |
| Registration points to an old checkout | Use that installation's generated unregister script. Generate setup for the current location and extension ID; the generator intentionally refuses to overwrite an existing setup. |

## Protocol 1

Host name: `com.lossless_rewrite.companion`. Open a persistent `runtime.connectNative` port. There is no HTTP listener or cross-origin Next.js bridge.

Every request contains `version: 1`, `requestId`, `documentId`, `revision` (nonnegative integer), `operation`, and `payload`. IDs accept letters, digits, underscores and hyphens, maximum 100 characters. Replies echo those fields plus increasing `sequence`, `type` and `payload`.

| Operation | Payload | Result |
|---|---|---|
| `hello` | `{}` | Capabilities, version, limits and cancellation limitations |
| `models.list` | `{}` | Checker configuration status (operation name retained for compatibility) |
| `check` | Shared rewrite request, with `initialText` required | Shared `RewriteResult`, one `edit` attempt; no generation or tightening |
| `cancel` | `{runId}` | Stop forwarding results; provider request may still finish |
| `run.status` | `{runId}` | Known status and retained result for same document/revision |

The hello response includes `checkMode: decision-only-v1`. The panel requires this before enabling checks. Legacy extraction and rewrite operations are rejected before inference. Writer settings in legacy check payloads are ignored: a check never invokes an API or CLI writer. Jev returns evidence; uncertain units stay uncertain. Exact wording checks need no network call or Jev key. Zero requirements return empty evidence, never a verified success indicator.

Optional idea extraction, writing and repairs are prompts the user sends in the existing chat. The standalone app and CLI retain their separate generation features.

Response types: `accepted`, `event`, `result`, `error`, `status`. Event payloads are current `PipelineEvent` objects; `done` is sent once as `result`, not a duplicate event. Errors use `{code, message}` and intentionally omit provider exception text, which can contain sensitive request data.

Messages use UTF-8 JSON prefixed by a native-endian unsigned 32-bit byte count. Incoming messages are limited to 4 MiB. Responses above 384 KiB are chunked into `{version:1,type:'chunk',transferId,index,count,totalBytes,data}`. `data` is base64 of serialized response bytes; reassemble in order, validate all metadata, then decode once. Maximum complete response is 16 MiB. Never accept a partial transfer as success. Stdout contains frames only; stderr diagnostics omit document bodies and secrets.

Only one inference run can be active. The host deduplicates request IDs for its current port session, rejecting reused IDs with different input. It retains IDs rather than evicting them and starting duplicate paid requests; after 256 requests reconnect deliberately. Retained terminal results are bounded; older statuses may no longer include their result. A new process does not know past requests. A disconnect is **interrupted**, not a reason to automatically retry generation. `run.status` cannot recover work from an exited host. Cancellation is currently **detach-only**, and the run keeps occupying the inference slot until its provider finishes.

The host checks the browser-provided origin against the generated exact allowlist as well as the native manifest allowlist. Requests cannot specify credentials, endpoints, command lines, file paths or environment variables. Local configuration is trusted. This does not protect against another program already running as the same OS user; native messaging is a browser-to-local transport, not an OS user isolation boundary.

## Verification

Run `npx tsx --test lib/companion/*.test.ts`. Tests cover fragmented frames, encoded byte lengths, oversized/truncated/invalid input, chunk reconstruction, exact origins, check-only parity, duplicate requests, stale revisions, cancellation and error redaction with no paid calls. Child-process handshakes exercise the actual source-run host **and compiled Windows launcher** using a temporary checkout with spaces in its path. Both complete framed hello, models and exact-wording verification. The tests do not modify real registration or local configuration.

Official transport reference: [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging). Actual browser startup/registration and ChatGPT/Claude interaction remain separate manual acceptance checks; unit tests do not establish those claims.
