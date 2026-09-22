# Long-document rewrite example

This example uses a fictional 1,115-word customer policy. The initial summary deliberately omits a refund condition; Jev checks and the Codex CLI repair came from a real run.

[Full source document (.md)](customer-policy.md) · [Machine-readable evidence](document-repair.json) · [Back to the README](../README.md#watch-the-demo)

## Instruction

> Summarize this policy for support staff in about 150 words. Keep the selected conditions and exceptions.

## Selected conditions

- New workspaces receive a 14-day trial that does not automatically convert to a paid subscription.
- Added seats are prorated for the remainder of the current period; seat reductions take effect at the next billing period.
- Cancellation takes effect at the end of the current billing period and prevents the next renewal.
- The 14-day full refund applies only to the first purchase. Renewal payments are non-refundable.
- Owners can export content for 30 days after cancellation takes effect; the workspace is read-only during that period.
- Standard support operates Monday through Friday, from 09:00 to 17:00 UTC.

## Initial summary

Five selected conditions passed; refund eligibility was altered.

New workspaces get a 14-day trial and are not charged automatically; the owner must choose and pay for a plan. Account owners manage membership, billing contacts and subscription changes. Added seats are prorated for the rest of the current billing period, while seat reductions apply next period.

Cancellation stops the next renewal and takes effect at the end of the current billing period, so the team can use its remaining paid time. Full refunds are available within 14 days. Customers should contact support with their invoice identifier to request one. Payment-provider processing times vary.

Owners have 30 days after cancellation takes effect to export content from the read-only workspace. Content is then scheduled for deletion, and recovery is not guaranteed. Standard support is available Monday through Friday, 09:00–17:00 UTC. Include the workspace identifier and relevant invoice details, but never share passwords or recovery codes.

## Repaired summary

All six selected checks passed. The complete summary contains 163 words.

New workspaces receive a 14-day trial that does not automatically convert to a paid subscription; the owner must choose and pay for a plan. Account owners manage membership, billing contacts and subscription changes. Added seats are prorated for the remainder of the current billing period, while seat reductions take effect in the next period.

Cancellation prevents the next renewal and takes effect at the end of the current billing period, allowing the team to use its remaining paid time. The 14-day full refund applies only to the first purchase. Renewal payments are non-refundable. Customers should contact support with the relevant invoice identifier; payment-provider processing times vary after approval.

For 30 days after cancellation takes effect, owners can export content while the workspace remains read-only. Content is then scheduled for deletion, and recovery is not guaranteed. Standard support operates Monday through Friday, from 09:00 to 17:00 UTC. Include the workspace identifier and relevant invoice details, but never share passwords or recovery codes.

## Replay locally

After installing the repository, run `npm run demo`. This replays the saved checks and repair without API keys, model calls or network requests.
