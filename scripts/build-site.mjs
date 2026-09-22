import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "dist/site");
await mkdir(out, { recursive: true });
for (const file of ["index.html", "style.css", "replay.js"]) {
  await copyFile(resolve(root, "website", file), resolve(out, file));
}
for (const [from, to] of [
  ["public/demo/social.mp4", "walkthrough.mp4"],
  ["public/demo/poster.jpg", "poster.jpg"],
  ["public/demo/captions.vtt", "captions.vtt"],
  ["docs/social-preview.png", "social-preview.png"],
  ["demo/customer-policy.md", "customer-policy.md"],
]) await copyFile(resolve(root, from), resolve(out, to));
const demo = JSON.parse(await readFile(resolve(root, "demo/document-repair.json"), "utf8"));
await writeFile(resolve(out, "replay.json"), JSON.stringify({
  source: demo.source,
  instruction: demo.instruction,
  facts: demo.facts,
  before: demo.result.attempts[0],
  after: demo.result.final,
}));
await writeFile(resolve(out, ".nojekyll"), "");
console.log(`Built static saved-run demo: ${out}`);
