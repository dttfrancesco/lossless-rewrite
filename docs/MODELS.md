# Writers and connections

Jev performs primary semantic checks. Your selected generative model writes, extracts requirements, repairs, and gives second opinions on uncertain results.

| Connection | Authentication | Review status |
|---|---|---|
| `codex-cli/default` | Local Codex login; eligible ChatGPT subscription or configured CLI account | Live UI and CLI extraction, writing and repair verified |
| `claude-cli/sonnet` | Local Claude Code login | Existing integration; subscription session limit prevented new live generation in this review |
| `openai/<model>` | `OPENAI_API_KEY` | Implemented; paid credentials not available for a live test |
| `anthropic/<model>` | `ANTHROPIC_API_KEY` | Implemented; paid credentials not available for a live test |
| `google/<model>` | `GOOGLE_GENERATIVE_AI_API_KEY` | Implemented; paid credentials not available for a live test |
| `gateway/<provider>/<model>` | `AI_GATEWAY_API_KEY` | Multi-provider routing implemented; no live paid test |
| `compatible/<model>` | `LLM_BASE_URL`, optional `LLM_API_KEY` | Real local HTTP contract tested, including schema rejection; individual third-party services not validated |

Model suggestions are conveniences, not guarantees of account access. Custom model IDs are accepted. Compatible endpoints can connect services or local servers implementing the required API and output behavior.

## Minimal Codex configuration

```dotenv
TYPESAFE_API_KEY=your-jev-key
LLM_PROVIDER=codex-cli
LLM_MODEL=default
```

Install the CLI and sign in if needed: `npm install -g @openai/codex`, then `codex login`.

Explicit UI model selections and CLI `--model` override the per-task defaults. The UI's **Use server defaults** respects `LLM_MODEL_WRITE`, `LLM_MODEL_EXTRACT`, and `LLM_MODEL_JUDGE` before `LLM_MODEL`. See [.env.example](../.env.example).

Subscriptions and API billing are separate. A subscription login does not supply an API key, and live Jev checks still need a Jev key. Keys are read on the server or by the local CLI. Text is sent to your selected writer and the checker. The saved `npm run demo` replay is the no-network exception.
