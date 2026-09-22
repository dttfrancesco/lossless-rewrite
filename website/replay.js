"use strict";
const labels = { F1: "Trial and payment", F2: "Seat billing", F3: "Cancellation", F4: "Refund exception", F5: "Export window", F6: "Support hours" };
let stage = "before";
let selected = "F4";
let demo;
const text = (id, value) => { document.getElementById(id).textContent = value; };
function render() {
  if (!demo) return;
  const attempt = demo[stage];
  const fact = demo.facts.find(f => f.id === selected);
  const check = attempt.verification.units.find(u => u.unit.id === selected);
  const kept = check.status === "kept";
  text("source-passage", fact.sources.map(s => demo.source.slice(s.start, s.end)).join("\n\n"));
  const evidence = attempt.sentences.filter(s => check.sentences.includes(s.id)).map(s => attempt.text.slice(s.start, s.end)).join(" ");
  text("output-passage", evidence || (selected === "F4" && stage === "before" ? "Full refunds are available within 14 days." : "No matching passage was found in this summary."));
  text("result-label", kept ? "Selected meaning kept" : `Selected meaning: ${check.status}`);
  document.getElementById("result-label").classList.toggle("kept", kept);
  const title = stage === "before" ? "Summary before repair" : "Summary after repair";
  text("output-title", title); text("full-output-title", `Complete ${title.toLowerCase()} (${attempt.words} words)`);
  text("full-source", demo.source); text("full-output", attempt.text); text("instruction", demo.instruction);
  const passed = attempt.verification.units.filter(u => u.status === "kept").length;
  text("check-summary", `${passed} of ${attempt.verification.units.length} selected ideas kept. Select a check to inspect its source and summary.`);
  const checks = document.getElementById("checks"); checks.replaceChildren();
  for (const unit of attempt.verification.units) {
    const button = document.createElement("button"); button.type = "button";
    button.setAttribute("aria-pressed", String(unit.unit.id === selected));
    const icon = document.createElement("span"); icon.className = `check-icon${unit.status === "kept" ? "" : " problem"}`;
    icon.textContent = unit.status === "kept" ? "✓" : "!"; icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span"); label.textContent = `${labels[unit.unit.id]} · ${unit.status}`;
    button.append(icon, label); button.addEventListener("click", () => { selected = unit.unit.id; render(); }); checks.append(button);
  }
  for (const button of document.querySelectorAll("[data-stage]")) button.setAttribute("aria-pressed", String(button.dataset.stage === stage));
}
for (const button of document.querySelectorAll("[data-stage]")) button.addEventListener("click", () => { stage = button.dataset.stage; render(); });
fetch("replay.json").then(r => { if (!r.ok) throw new Error("Replay unavailable"); return r.json(); }).then(data => { demo = data; render(); }).catch(() => text("check-summary", "The replay could not load. You can still watch the walkthrough below."));
