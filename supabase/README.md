# Hosted service source

The extension's Free hosted checks use this backend. You do not need to deploy it to use the official extension. Forks and independent deployments need their own accounts and configuration.

## Components

- `lossless-api`: authenticated account, usage, quote, check and plan-interest requests. It validates the access token with `auth.getUser`; identity is never accepted from a request body.
- `lossless-unsubscribe`: token-scoped status and explicit unsubscribe requests. No login is required; only a hash of the random token is stored.
- `migrations/`: account/usage tables, transaction functions, private tester access, interest and confirmation delivery records. Apply migrations in filename order to an isolated project. They contain schema, not production records.
- `lossless-billing-webhook` and `billing.ts`: future billing scaffolding. Checkout and portal actions are rejected during the Free launch. Do not deploy or enable paid billing as part of a Free setup.

## Configure your own deployment

1. Create a Supabase project and enable Google authentication. Apply the migrations after reviewing them against your project. All Lossless tables use RLS and deny direct access to public clients; privileged operations run in authenticated server handlers.
2. Set `LOSSLESS_JEV_KEY` as an Edge Function secret. The hosted checker calls Jev; it does not call another writing model. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function environment. Never place the service-role key in an extension or public file.
3. For optional interest confirmations, configure `LOSSLESS_BREVO_KEY` and `LOSSLESS_MAIL_FROM` with your own verified sender. Deploy the public unsubscribe page and update `mailSite` in `lossless-api/mail-content.ts` to your own site. Without those secrets, interest registration can be saved but confirmation delivery reports unavailable.
4. Deploy `lossless-api` with gateway JWT verification disabled: the handler validates the bearer token itself. Deploy `lossless-unsubscribe` with gateway JWT verification disabled too: its handler validates the scoped unsubscribe token. Do not expose another function without reviewing its authentication.
5. Change `extension/cloud-config.js`, the extension's backend host permission and `mail-site/unsubscribe.js` to your project. The client uses a **publishable** key, not a secret key.
6. Use your own extension public key / ID. Update the explicit callback allowlist in `extension/auth-callback.js` and register that exact `https://<extension-id>.chromiumapp.org/lossless` redirect in Supabase. Do not change another application's Site URL or unrelated callbacks when sharing a project.
7. Host your own privacy policy and assets, update contact details, then test sign-in, a quoted check, usage accounting, failure handling, interest confirmation and unsubscribe with synthetic data.

Use the installed Supabase CLI's `--help` and current [function deployment documentation](https://supabase.com/docs/guides/functions/deploy) for project linking, secrets and deployment. Do not commit a secrets file or a production database export.

Private testers are managed in `lossless_owner_allowlist` by an administrator. The API binds access only after verifying the account email. This repository includes no private email list or access codes. Hourly and concurrency limits still apply to testers even when the monthly allowance is removed.

## Validation

Pure checker behaviour has regression coverage in `extension/writing-rules.test.mjs`. Deno tests beside the confirmation and unsubscribe handlers cover those modules separately. A passing unit test does not validate your OAuth, provider key, sender domain or deployed database permissions. No production configuration is changed by running the repository's Node tests.
