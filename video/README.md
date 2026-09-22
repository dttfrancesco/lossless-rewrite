# Media production

| Asset | Role |
|---|---|
| `docs/hero-ai-chat.png` | 1600×900 README hero: long document, missing exception, repaired summary |
| `public/demo/social.mp4` | About 48 seconds, male voice, on-screen captions and focused capability demonstrations |
| `public/demo/poster.jpg` | Video preview image |
| `public/demo/captions.vtt` | Optional English caption track aligned with the on-screen narration |
| `docs/social-preview.png` | 1280×640 social-link image |

The generic AI conversation and extension sidebar are illustrations. The complete policy has 1,115 words; on-screen source and summary excerpts are explicitly labeled. The original error is deliberate; checks and repair are from the saved real run. Codex CLI repairs the summary in the panel, rather than fabricating a new chat reply.

The expanded scenes show exact wording, key-idea coverage, checking an existing draft, and style/length changes. `demo/video-capabilities.json` holds the real extraction and exact-wording evidence. The final style scene stops before generation.

## Reproduce

1. Optional: `node --import tsx eval/capture-demo.ts --document` captures new evidence. Requires Codex login and Jev credentials. Inspect the result before exporting. The capture script saves unsuccessful runs under ignored `eval/results/`.
2. Check the excerpts in `scene.tsx` against the saved run. Rendering rejects excerpts absent from the capture. If a new repair changes the wording, update the excerpts and inspect the composition.
3. `python video/narrate.py` generates narration with `en-US-GuyNeural` at normal speed and aligned captions. Requires Python, Edge TTS and FFmpeg; the speech service is online. Scene durations are written to `story.json`.
4. `npm run video:render` renders the film; `npm run video:still` renders its poster.
5. `npm run hero:still` and `npm run social:still` render the static assets.

The editor, CLI replay and extension's saved demo use `demo/document-repair.json`. Earlier fixtures remain as historical test examples. Remotion may download Chrome Headless Shell on first render. The square composition has not been validated for publication.

Read the [storyboard](STORYBOARD.md). A social-preview file must still be configured in GitHub repository settings after publication approval.

References: [Remotion rendering](https://www.remotion.dev/docs/cli/render), [Edge TTS](https://github.com/rany2/edge-tts), [GitHub social previews](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repositorys-social-media-preview).
