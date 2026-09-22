import Link from "next/link";
import story from "@/video/story.json";

export default function DemoPage() {
  const seconds = Math.round(story.reduce((total, card) => total + card.seconds, 0));
  return <main className="demo-page">
    <nav><Link href="/">← Open the editor</Link><span>lossless / rewrite</span></nav>
    <h1>Cut words, not ideas.</h1>
    <p className="demo-description">See meaning checks, exact wording, key-idea coverage and draft repair in {seconds} seconds. Captions are included on screen.</p>
    <video controls playsInline preload="metadata" poster="/demo/poster.jpg?v=story-v9" aria-label="Lossless Rewrite: captioned capabilities walkthrough"><source src="/demo/social.mp4?v=story-v9" type="video/mp4"/><track kind="captions" src="/demo/captions.vtt?v=story-v9" srcLang="en" label="English" /></video>
    <details className="demo-about"><summary>About this demo</summary><p>{seconds}-second illustrated AI chat and extension preview. The seeded omission, checks and repair use a saved run. Exact wording is checked against that output; the key-idea checklist comes from a separate saved extraction. Style controls are shown before generation. Male narration, on-screen captions and an optional English caption track are included. This is not a recording of an installed integration.</p><a href="/demo/social.mp4" download>Download video</a></details>
  </main>;
}
