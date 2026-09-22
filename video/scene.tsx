import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { UiIcon } from "../components/ui-icon";
import capture from "../demo/document-repair.json";
import capabilities from "../demo/video-capabilities.json";
import story from "./story.json";

const c = { ink: "#202323", paper: "#faf9f6", line: "#dfdfd8", green: "#256147", muted: "#636860", red: "#a92e3e" };
const starts = story.map((_, i) => story.slice(0, i).reduce((n, s) => n + Math.round(s.seconds * 30), 0));
const button: CSSProperties = { background: c.green, color: "white", borderRadius: 7, padding: "12px 17px", fontSize: 21, fontWeight: 600, display: "inline-block" };
const sourceWords = capture.result.sourceWords.toLocaleString("en-US");
const sourceRef = capture.facts[3]!.sources[0]!;
const sourceExcerpt = capture.source.slice(sourceRef.start, sourceRef.end);
const summaryExcerpt = "Full refunds are available within 14 days. Customers should contact support with their invoice identifier to request one.";
const repairedExcerpt = "The 14-day full refund applies only to the first purchase. Renewal payments are non-refundable.";
if (!capture.initialText.includes(summaryExcerpt) || !capture.result.final.text.includes(repairedExcerpt)) throw new Error("Media excerpts must match the saved evidence.");

function Frame({ children }: { children: ReactNode }) {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / 1280, height / 720);
  return <AbsoluteFill style={{ background: c.paper, color: c.ink, fontFamily: "Arial, sans-serif" }}><div style={{ width: 1280, height: 720, transformOrigin: "top left", transform: `translate(${(width - 1280 * scale) / 2}px, ${(height - 720 * scale) / 2}px) scale(${scale})` }}>{children}</div></AbsoluteFill>;
}
function Brand() { return <div style={{ display: "flex", alignItems: "center", gap: 9, font: "600 25px Georgia, serif" }}><UiIcon name="brand"/>lossless rewrite<span style={{ color: c.green, marginLeft: -8 }}>.</span></div>; }
function Cursor({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return <svg width="31" height="40" viewBox="0 0 31 40" style={{ position: "absolute", left: x, top: y, transform: pressed ? "scale(.87)" : undefined, zIndex: 5 }}><path d="M3 2 4 31 12 24 19 37 25 34 18 21 29 20Z" fill="#161e25" stroke="white" strokeWidth="2.5"/></svg>;
}
function Mark({ children, tone }: { children: ReactNode; tone: "source" | "wrong" | "fixed" }) {
  return <span style={{ background: tone === "source" ? "#f6df9d" : tone === "wrong" ? "#f8d9dd" : "#d9eddf", color: tone === "wrong" ? c.red : tone === "fixed" ? c.green : c.ink, borderRadius: 3, padding: "2px 3px", boxDecorationBreak: "clone", fontWeight: 600 }}>{children}</span>;
}
function Text({ kind, highlighted = true }: { kind: "source" | "wrong" | "fixed"; highlighted?: boolean }) {
  const value = kind === "source" ? sourceExcerpt : kind === "wrong" ? summaryExcerpt : repairedExcerpt;
  const phrase = kind === "wrong" ? "Full refunds are available within 14 days" : "Renewal payments are non-refundable";
  const index = value.indexOf(phrase);
  if (!highlighted || index < 0) return <>{value}</>;
  return <>{value.slice(0, index)}<Mark tone={kind}>{phrase}</Mark>{value.slice(index + phrase.length)}</>;
}

// Edited illustration of the extension flow. Never presented as live site footage.
// Repair uses the configured local CLI and stays in the panel, not a forged chat message.
function ChatAndExtension({ stage, local = 0, hero = false }: { stage: number; local?: number; hero?: boolean }) {
  const fixed = stage === 4;
  const checking = stage === 3 && local >= 86;
  const marking = stage === 3 && !checking;
  const extensionActive = stage >= 3;
  const tab = marking ? "Source" : checking ? "Details" : "Reply";
  return <div style={{ width: 1204, height: 514, position: "relative", background: "white", border: `1px solid ${c.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 30px #22222208", boxSizing: "border-box" }}>
    <div style={{ height: 33, borderBottom: `1px solid ${c.line}`, background: "#f0f0ed", display: "flex", alignItems: "center", gap: 7, padding: "0 16px", fontSize: 14, color: c.muted }}><span>● ● ●</span><span style={{ background: "white", borderRadius: 5, marginLeft: 170, padding: "3px 100px" }}>AI chat · demo</span><span style={{ marginLeft: "auto" }}>Extension preview</span></div>
    <div style={{ position: "absolute", top: 33, bottom: 0, width: 51, background: "#f7f7f5", borderRight: `1px solid ${c.line}`, display: "flex", alignItems: "center", flexDirection: "column", gap: 26, paddingTop: 22 }}><UiIcon name="pen"/><span style={{ fontSize: 25 }}>＋</span><span style={{ fontSize: 25 }}>⌕</span></div>
    <div style={{ position: "absolute", left: 76, top: 50, fontSize: 23, fontWeight: 600 }}>AI chat <span style={{ fontSize: 16, color: c.muted }}>⌄</span></div>
    <div style={{ position: "absolute", right: 526, top: 93, width: 537, padding: "11px 17px", borderRadius: 20, background: "#f4f4f4", boxSizing: "border-box" }}>
      <div style={{ background: "white", border: `1px solid ${c.line}`, borderRadius: 10, padding: "6px 10px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><UiIcon name="document"/>customer-policy.md <span style={{ color: c.muted, marginLeft: "auto" }}>{sourceWords} words</span></div>
      <div style={{ fontSize: 20, marginTop: 10 }}>Summarize this policy. Keep the conditions.</div>
    </div>
    <div style={{ position: "absolute", left: 98, top: 195, width: 575, borderLeft: "3px solid #d4d4d0", paddingLeft: 13, boxSizing: "border-box" }}>
      <div style={{ color: c.muted, fontSize: 14, marginBottom: 6 }}>From the attached policy · §5 excerpt</div>
      <p style={{ margin: 0, fontSize: 19, lineHeight: 1.35 }}><Text kind="source" highlighted={stage >= 1}/></p>
    </div>
    {stage >= 2 && <div style={{ position: "absolute", left: 86, top: 290, width: 586 }}>
      <div style={{ fontSize: 15, color: c.muted, fontWeight: 600, marginBottom: 8 }}>AI reply · excerpt {hero && <span style={{ color: c.red, marginLeft: 10 }}>· Exception missing</span>}</div>
      <p style={{ margin: 0, fontSize: 22, lineHeight: 1.35 }}><Text kind="wrong"/></p>
    </div>}
    <div style={{ position: "absolute", left: 86, right: 526, bottom: 25, height: 60, border: "1px solid #d5d5d5", borderRadius: 31, background: "white", boxShadow: "0 2px 8px #00000008", display: "flex", alignItems: "center", padding: "0 13px 0 18px", gap: 13 }}>
      <span style={{ fontSize: 27, color: "#303030" }}>＋</span><span style={{ fontSize: 20, color: "#777", flex: 1 }}>Ask anything</span>
      <svg width="21" height="25" viewBox="0 0 24 28" fill="none" stroke="#303030" strokeWidth="1.8"><rect x="8" y="2" width="8" height="15" rx="4"/><path d="M5 12v2a7 7 0 0 0 14 0v-2M12 21v5M8 26h8"/></svg>
      <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#171717", color: "white", display: "grid", placeItems: "center", fontSize: 26 }}>↑</span>
    </div>
    <aside style={{ position: "absolute", left: 713, right: 0, top: 33, bottom: 0, borderLeft: `1px solid ${c.line}`, background: "#f4f1ea", padding: "17px 22px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ font: "600 25px Georgia,serif" }}>lossless rewrite.</span><span style={{ color: c.muted, fontSize: 16 }}>↗</span></div>
      <nav style={{ display: "flex", gap: 24, marginTop: 19, borderBottom: `1px solid ${c.line}`, fontSize: 18 }}>
        {["Source", "Reply", "Details"].map(name => <span key={name} style={{ padding: "0 4px 10px", color: name === tab ? c.green : c.muted, fontWeight: name === tab ? 600 : 400, borderBottom: name === tab ? `3px solid ${c.green}` : "3px solid transparent" }}>{name}</span>)}
      </nav>
      {!extensionActive && <div style={{ marginTop: 37, fontSize: 23, lineHeight: 1.65 }}><div style={{ color: c.green, fontWeight: 600 }}>6 selected conditions</div><p style={{ fontSize: 20, color: c.muted }}>Trial billing<br/>Seat changes<br/>Cancellation date<br/>Refund eligibility<br/>Export window<br/>Support hours</p></div>}
      {marking && <>
        <p style={{ fontSize: 16, color: c.muted, margin: "20px 0 12px" }}>§5 excerpt · {sourceWords}-word document</p>
        <p style={{ background: "#fffefb", border: `1px solid ${c.line}`, borderRadius: 5, margin: 0, padding: 17, fontSize: 23, lineHeight: 1.4 }}><Text kind="source"/></p>
        <div style={{ marginTop: 19, ...button }}>Keep meaning</div><Cursor x={180} y={314} pressed={local > 36 && local < 51}/>
        <div style={{ marginTop: 15, color: c.muted, fontSize: 17 }}>5 other conditions selected</div>
      </>}
      {checking && <>
        <div style={{ color: c.red, fontWeight: 600, fontSize: 23, marginTop: 23 }}>5 kept · 1 condition changed</div>
        <p style={{ fontSize: 26, lineHeight: 1.4, margin: "20px 0 12px" }}>Renewal payments are non-refundable.</p>
        <p style={{ fontSize: 21, lineHeight: 1.5, margin: 0, color: c.red }}>The shorter reply leaves this out.</p>
        <div style={{ position: "absolute", bottom: 73, left: 22, ...button }}>Check &amp; repair</div><Cursor x={180} y={368} pressed={local > 145}/>
      </>}
      {fixed && <>
        <div style={{ color: c.green, fontWeight: 600, fontSize: 20, margin: "20px 0 15px" }}>✓ 6 / 6 selected conditions kept</div>
        <div style={{ background: "#fffefb", border: `1px solid ${c.line}`, borderRadius: 5, padding: "16px 18px" }}>
          <div style={{ fontSize: 16, color: c.green, fontWeight: 600, marginBottom: 10 }}>Repaired summary · {capture.result.final.words} words</div>
          <p style={{ margin: 0, fontSize: 25, lineHeight: 1.5 }}><Text kind="fixed"/></p>
          <div style={{ marginTop: 12, color: c.muted, fontSize: 15 }}>Excerpt from the complete summary</div>
        </div>
        <div style={{ position: "absolute", bottom: 59, right: 22, fontSize: 17, color: c.green }}>Copy reply <span style={{ marginLeft: 7 }}>⧉</span></div>
      </>}
      <div style={{ position: "absolute", bottom: 18, left: 22, right: 22, paddingTop: 12, borderTop: `1px solid ${c.line}`, fontSize: 16, color: c.muted }}>Repair writer <span style={{ color: c.ink, marginLeft: 18 }}>Codex CLI ⌄</span></div>
    </aside>
  </div>;
}

function camera(stage: number): [number, number, number] {
  if (stage === 0) return [602, 257, .97];
  if (stage === 1) return [380, 243, 1.25];
  if (stage === 2) return [380, 273, 1.12];
  return [955, stage === 4 ? 273 : 276, 1.12];
}
function Captions({ stage }: { stage: number }) {
  return <div style={{ position: "absolute", left: 80, right: 80, top: 610, height: 72, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
    <span style={{ background: "#202323", color: "white", borderRadius: 9, padding: "10px 22px", fontSize: 28, lineHeight: 1.35 }}>{story[stage]!.narration}</span>
  </div>;
}
function ProblemOpening({ local }: { local: number }) {
  const reveal = interpolate(local, [30, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lines = (widths: number[]) => widths.map((width, i) => <div key={i} style={{ width: `${width}%`, height: 9, borderRadius: 4, background: "#e0e1dd", marginTop: 13 }}/>);
  return <Frame>
    <header style={{ position: "absolute", top: 23, left: 38 }}><Brand/></header>
    <h1 style={{ position: "absolute", top: 77, left: 38, margin: 0, fontSize: 43, letterSpacing: -1.2 }}>Shorter text can lose important ideas.</h1>
    <div style={{ position: "absolute", top: 139, left: 90, fontSize: 24, color: c.muted }}>“Make this shorter. Keep the meaning.”</div>
    <section style={{ ...featurePanel, position: "absolute", left: 90, top: 191, width: 454, height: 387 }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>Original · {sourceWords} words</div>
      <div style={{ fontSize: 18, color: c.muted, marginTop: 8 }}>customer-policy.md</div>
      <div style={{ marginTop: 25 }}>{lines([94, 83, 91])}</div>
      <p style={{ fontSize: 29, lineHeight: 1.4, margin: "25px 0" }}><Mark tone="source">{capabilities.wording.phrase}</Mark></p>
      {lines([88, 74])}
    </section>
    <div style={{ position: "absolute", left: 603, top: 346, fontSize: 63, color: c.muted }}>→</div>
    <section style={{ ...featurePanel, position: "absolute", left: 732, top: 191, width: 454, height: 387 }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>AI summary · {capture.result.attempts[0]!.words} words</div>
      <div style={{ fontSize: 18, color: c.muted, marginTop: 8 }}>Shorter, but incomplete</div>
      <div style={{ marginTop: 25 }}>{lines([94, 78])}</div>
      <div style={{ opacity: reveal, marginTop: 27, border: `2px dashed ${c.red}`, borderRadius: 7, padding: "22px 18px", color: c.red, background: "#fff6f7", fontSize: 28, lineHeight: 1.4 }}>Refund exception<br/><strong>missing</strong></div>
    </section>
    <Captions stage={0}/>
    <footer style={{ position: "absolute", left: 38, top: 697, fontSize: 12, color: c.muted }}>Illustrated example · The omission is deliberate; the following checks and repair are real</footer>
  </Frame>;
}
function FilmScene({ stage, local }: { stage: number; local: number }) {
  const labels = ["Cut words, not ideas.", "Here’s the idea that must survive.", "The shorter version leaves it out.", local < 86 ? "Mark it. Then check the rewrite." : "Jev catches the missing idea.", "Repair the omission. Check again."];
  const target = camera(stage);
  const previous = camera(stage === 1 ? 1 : Math.max(0, stage - 1));
  const t = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = t * t * (3 - 2 * t);
  const x = previous[0] + (target[0] - previous[0]) * ease;
  const y = previous[1] + (target[1] - previous[1]) * ease;
  const zoom = previous[2] + (target[2] - previous[2]) * ease;
  const widths = [1212, 780, 740, 550, 550];
  const previousWidth = widths[stage === 1 ? 1 : Math.max(0, stage - 1)]!;
  const clipWidth = previousWidth + (widths[stage]! - previousWidth) * ease;
  return <Frame>
    <header style={{ position: "absolute", top: 23, left: 38 }}><Brand/></header>
    <h1 style={{ position: "absolute", top: 77, left: 38, margin: 0, fontSize: 43, letterSpacing: -1.2 }}>{labels[stage]}</h1>
    <div style={{ position: "absolute", left: (1280 - clipWidth * .86) / 2, top: 145, width: clipWidth, height: 514, transform: "scale(.86)", transformOrigin: "top left", overflow: "hidden", borderRadius: 14, background: "#eeede8" }}>
      <div style={{ position: "absolute", left: clipWidth / 2, top: 257, transformOrigin: "0 0", transform: `scale(${zoom}) translate(${-x}px, ${-y}px)` }}><ChatAndExtension stage={stage} local={local}/></div>
    </div>
    <Captions stage={stage}/>
    <footer style={{ position: "absolute", left: 38, top: 697, fontSize: 12, color: c.muted }}>Illustrated AI chat + extension preview · Seeded mistake; real check and repair</footer>
  </Frame>;
}

const featurePanel: CSSProperties = { background: "white", border: `1px solid ${c.line}`, borderRadius: 14, padding: 26, boxSizing: "border-box" };
function FeatureScene({ stage, local }: { stage: number; local: number }) {
  const progressed = local > 44;
  const titles = ["Some wording must stay exactly the same.", "A whole section? Choose its key ideas.", "Already have a draft? Check that too.", "Keep editing. Keep checking your ideas."];
  const row: CSSProperties = { fontSize: 28, lineHeight: 1.45, padding: 20, borderRadius: 8, border: `1px solid ${c.line}`, margin: "16px 0 0" };
  return <Frame>
    <header style={{ position: "absolute", top: 23, left: 38 }}><Brand/></header>
    <h1 style={{ position: "absolute", top: 77, left: 38, margin: 0, fontSize: 43, letterSpacing: -1.2 }}>{titles[stage - 5]}</h1>
    <div style={{ position: "absolute", top: 149, left: 68, width: 1144, height: 435 }}>
      {stage === 5 && <>
        <div style={{ ...featurePanel, position: "absolute", left: 0, top: 0, width: 538, height: 348 }}>
          <div style={{ fontSize: 20, color: c.muted }}>Source · selected sentence</div>
          <p style={{ ...row, fontSize: 32, border: 0, padding: "18px 0" }}><Mark tone="source">{capabilities.wording.phrase}</Mark></p>
          <div style={{ ...button, background: "#aa6314", marginTop: 24 }}>Keep wording</div>
          <Cursor x={169} y={239} pressed={local > 28 && local < 43}/>
        </div>
        <div style={{ ...featurePanel, position: "absolute", right: 0, top: 0, width: 538, height: 348 }}>
          <div style={{ fontSize: 20, color: c.muted }}>Rewritten document · matching sentence</div>
          <p style={{ ...row, fontSize: 32, border: 0, padding: "18px 0" }}>{progressed ? <Mark tone="fixed">{capabilities.wording.phrase}</Mark> : capabilities.wording.phrase}</p>
          <div style={{ color: c.green, fontSize: 24, fontWeight: 600, opacity: progressed ? 1 : 0 }}>✓ Exact sentence found</div>
        </div>
        <div style={{ position: "absolute", top: 375, left: 0, fontSize: 22, color: c.muted }}>The rest of the document can be rewritten.</div>
      </>}
      {stage === 6 && <>
        <div style={{ ...featurePanel, position: "absolute", left: 0, top: 0, width: 455, height: 402 }}>
          <div style={{ fontSize: 20, color: c.muted }}>Source · cancellation section excerpt</div>
          <p style={{ fontSize: 26, lineHeight: 1.4, margin: "22px 0", background: "#eef5ff" }}>Cancellation takes effect at the end of the current billing period.</p>
          <p style={{ fontSize: 23, lineHeight: 1.4, margin: "18px 0" }}>Cancellation is not the same operation as deleting a workspace.</p>
          <div style={{ ...button, background: "#235dad", marginTop: 5 }}>Must cover</div>
          <Cursor x={142} y={278} pressed={local > 20 && local < 35}/>
        </div>
        <div style={{ ...featurePanel, position: "absolute", right: 0, top: 0, width: 653, height: 402 }}>
          <div style={{ fontSize: 23, fontWeight: 600 }}>Key ideas to keep</div>
          {capabilities.displayFacts.map((fact, i) => <div key={fact} style={{ ...row, display: "flex", alignItems: "flex-start", gap: 15, background: progressed ? "#f0f7f2" : "white", fontSize: 27 }}><span style={{ color: c.green, flexShrink: 0 }}>{local > 34 + i * 18 ? "☑" : "□"}</span><span>{fact}</span></div>)}
          <p style={{ fontSize: 20, color: c.muted, margin: "16px 0 0" }}>Review or edit the list before rewriting.</p>
        </div>
      </>}
      {stage === 7 && <>
        <div style={{ ...featurePanel, position: "absolute", left: 0, top: 0, width: 536, height: 409 }}>
          <div style={{ fontSize: 23, fontWeight: 600 }}>Reply</div>
          <div style={{ ...row, fontSize: 21, display: "flex", alignItems: "center", gap: 12 }}><UiIcon name="document"/>Existing draft · summary excerpt</div>
          <p style={{ fontSize: 28, lineHeight: 1.45 }}><Mark tone="wrong">Full refunds are available within 14 days.</Mark></p>
          <div style={{ color: c.muted, fontSize: 20, marginTop: 18 }}>☑ This reply is complete</div>
          <div style={{ ...button, marginTop: 21 }}>Check only</div><Cursor x={161} y={344} pressed={local > 28 && local < 44}/>
        </div>
        <div style={{ ...featurePanel, position: "absolute", right: 0, top: 0, width: 570, height: 409 }}>
          <div style={{ color: c.red, fontSize: 26, fontWeight: 600, opacity: progressed ? 1 : .35 }}>5 kept · 1 condition changed</div>
          <p style={{ fontSize: 30, lineHeight: 1.5 }}>The draft leaves out the renewal exception.</p>
          <div style={{ fontSize: 21, color: c.muted }}>Your draft stays unchanged.</div>
          <div style={{ ...button, marginTop: 32, background: "white", border: `1px solid ${c.green}`, color: c.green }}>Check &amp; repair</div>
        </div>
      </>}
      {stage === 8 && <>
        <div style={{ ...featurePanel, position: "absolute", left: 0, top: 0, width: 602, height: 394 }}>
          <div style={{ fontSize: 23, fontWeight: 600 }}>Change style</div>
          <div style={{ ...row, fontSize: 31, padding: 24 }}>Make this friendlier.<br/>Aim for 150 words.</div>
          <div style={{ ...button, marginTop: 23 }}>Apply style feedback</div><Cursor x={239} y={259} pressed={local > 38 && local < 54}/>
          <p style={{ fontSize: 21, color: c.muted }}>Then check the new version again.</p>
        </div>
        <div style={{ ...featurePanel, position: "absolute", right: 0, top: 0, width: 504, height: 394 }}>
          <div style={{ fontSize: 23, fontWeight: 600 }}>Your selections stay attached</div>
          {[["Keep wording", "Exact sentences", "#a45d11"], ["Keep meaning", "Facts and conditions", c.green], ["Must cover", "Key ideas", "#235dad"]].map(([label, description, color]) => <div key={label} style={{ marginTop: 22, borderLeft: `4px solid ${color}`, paddingLeft: 16 }}><div style={{ fontSize: 25, color, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 21, marginTop: 5 }}>{description}</div></div>)}
        </div>
      </>}
    </div>
    <Captions stage={stage}/>
    <footer style={{ position: "absolute", left: 38, top: 697, fontSize: 12, color: c.muted }}>Illustrated controls · Saved wording check and key-idea extraction · Style change shown before generation</footer>
  </Frame>;
}
export function DemoFilm({ voiceover = false }: { voiceover?: boolean }) {
  const frame = useCurrentFrame();
  const stage = Math.max(0, starts.findLastIndex(start => frame >= start));
  const local = frame - starts[stage]!;
  return <>{stage === 0 ? <ProblemOpening local={local}/> : stage < 5 ? <FilmScene stage={stage} local={local}/> : <FeatureScene stage={stage} local={local}/>} {voiceover && <Audio src={staticFile("demo/voiceover.mp3")}/>}</>;
}
export function ComparisonImage() {
  return <Frame>
    <header style={{ position: "absolute", top: 23, left: 38 }}><Brand/></header>
    <h1 style={{ position: "absolute", left: 38, top: 78, margin: 0, fontSize: 43, letterSpacing: -1.1 }}>Cut words, not ideas.</h1>
    <p style={{ position: "absolute", left: 574, top: 94, margin: 0, fontSize: 25, color: c.green }}>Your model rewrites. Jev checks.</p>
    <div style={{ position: "absolute", left: 38, top: 145 }}><ChatAndExtension stage={4} hero/></div>
    <footer style={{ position: "absolute", left: 38, top: 684, fontSize: 14, color: c.muted }}>Illustrated AI chat + extension preview · Seeded mistake; real check and repair</footer>
  </Frame>;
}
export function SocialPreview() { return <ComparisonImage/>; }
