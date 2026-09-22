"use client";
import { useEffect, useState } from "react";
import { CATALOG, type Provider } from "@/lib/llm/catalog";
import { UiIcon } from "./ui-icon";
import { useDismiss } from "./use-dismiss";

export function ModelPicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  useDismiss(open, ".model-picker", () => setOpen(false));
  const [provider, setProvider] = useState<Provider>("claude-cli");
  const [model, setModel] = useState("sonnet");
  const [config, setConfig] = useState<{ defaultModel: string; providers: Array<{ id: Provider; configured: boolean | null }> }>();
  useEffect(() => { void fetch("/api/models").then((r) => r.ok ? r.json() : undefined).then(setConfig).catch(() => {}); }, []);
  const selected = CATALOG.find((p) => p.id === provider)!;
  const configured = config?.providers.find((p) => p.id === provider)?.configured;
  const current = value === "configured" ? (config?.defaultModel ?? "Configured writer") : value;
  const currentProvider = CATALOG.find((p) => current.startsWith(`${p.id}/`));
  const currentModel = currentProvider ? current.slice(currentProvider.id.length + 1) : current;
  const currentLabel = currentProvider?.id === "claude-cli" ? `Claude ${currentModel.charAt(0).toUpperCase()}${currentModel.slice(1)}` : currentProvider ? `${currentProvider.name} / ${currentModel}` : current;
  const valid = /^[a-zA-Z0-9_./:-]+$/.test(model);
  function show() {
    if (currentProvider) { setProvider(currentProvider.id); setModel(current.slice(currentProvider.id.length + 1)); }
    setOpen(!open);
  }
  return <div className="model-picker">
    <button type="button" className="writer-select" onClick={show} disabled={disabled} aria-expanded={open} aria-controls="model-options">{currentLabel}<UiIcon name="chevrons"/></button>
    {open && <div id="model-options" className="model-options" role="region" aria-label="Choose writer">
      <div className="flex justify-between items-center"><b>Choose your writer</b><button type="button" aria-label="Close model selector" onClick={() => setOpen(false)}>×</button></div>
      <label>Connection<select aria-label="Connection" value={provider} onChange={(e) => { const p = CATALOG.find((p) => p.id === e.target.value)!; setProvider(p.id); setModel(p.models[0] ?? ""); }}>
        <optgroup label="Your subscriptions · local CLI">{CATALOG.filter((p) => p.mode === "CLI").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
        <optgroup label="API keys">{CATALOG.filter((p) => p.mode === "API").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
      </select></label>
      <label>Model<select aria-label="Suggested model" value={selected.models.includes(model) ? model : "custom"} onChange={(e) => setModel(e.target.value === "custom" ? "" : e.target.value)}>{selected.models.map((m) => <option key={m} value={m}>{m === "default" ? "Codex default model" : m}</option>)}<option value="custom">Custom model ID…</option></select></label>
      <input aria-label="Model ID" value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "gateway" ? "provider/model-id" : "Model ID"} />
      <p>{selected.mode === "CLI" ? "Uses the CLI login on this machine. Subscription limits apply." : configured ? "Server configuration found. Model access depends on your account." : `Add ${selected.key} to .env.local on the server.`}</p>
      <p className="text-[10px]">This model writes, extracts ideas, and gives second opinions. Jev checks coverage.</p>
      <button type="button" className="model-apply" disabled={!valid || disabled} onClick={() => { onChange(`${provider}/${model}`); setOpen(false); }}>Use this model →</button>
      <button type="button" className="text-[11px] mt-2" onClick={() => { onChange("configured"); setOpen(false); }}>Use server defaults</button>
    </div>}
  </div>;
}
