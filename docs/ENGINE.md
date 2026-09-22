# Use the checking engine

The editor, CLI and extension companion use the same TypeScript engine. Install this source checkout and configure `.env.local` as described in the [README](../README.md#live-rewriting).

Run this example from a TypeScript file at the repo root using `node --import tsx your-file.ts`:

```ts
import { loadEnv } from "./lib/env";
import { DecisionClient } from "./lib/decision/client";
import { verifyRewrite } from "./lib/coverage/verify";
import { splitSentences } from "./lib/text/sentences";

loadEnv();
const text = "Your refund has been approved.";
const check = await verifyRewrite({
  client: new DecisionClient(),
  text,
  sentences: splitSentences(text),
  units: [{
    id: "refund",
    kind: "keep_meaning",
    text: "The refund is still under review; no approval has been given.",
  }],
  keepWording: [],
  judgeModel: "codex-cli/default",
});
console.log(check.units[0]?.status); // kept | missing | altered | uncertain
```

This makes live requests and does not guarantee a particular classification. Use the `units` evidence to inspect the result. Jev supplies primary meaning checks; the configured writer supplies second opinions when needed.

`runRewrite` in `lib/rewrite/pipeline.ts` adds generation, repair and tightening. Use it around document editing, summaries, specifications or rewritten agent instructions. These are uses of the shared engine, not tested integrations with every agent framework. This is reusable source, not a published SDK.
