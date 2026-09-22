import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "cli/rewrite.ts", ...args], { encoding: "utf8", timeout: 15_000 });

test("CLI replay emits parseable evidence, separates logs, and needs no live provider", () => {
  const output = run("--replay", "--json");
  assert.equal(output.status, 0, output.stderr);
  const report = JSON.parse(output.stdout);
  assert.equal(report.mode, "recorded");
  assert.equal(report.passed, true);
  assert.match(report.result.final.text, /renewal payments are non-refundable/i);
  assert.match(report.result.final.text, /14-day full refund/);
  assert.match(report.result.final.text, /support/i);
  assert.ok(report.result.sourceWords > 1000);
  assert.ok(report.result.final.words < 200);
  assert.equal(report.result.final.verification.units.length, 6);
  assert.ok(report.result.attempts[0].verification.units.some((unit: { status: string }) => unit.status !== "kept"));
  assert.match(output.stderr, /no model calls/);
});

test("CLI rejects conflicting replay flags and invalid budgets before model calls", () => {
  for (const args of [["--replay", "--model", "codex-cli/default"], ["--file", "demo/quick-cleanup.md", "--repairs", "10"], ["--typo"]]) {
    const output = run(...args);
    assert.equal(output.status, 1);
    assert.equal(output.stdout, "");
  }
});

test("CLI never overwrites existing output or source files", () => {
  const directory = mkdtempSync(join(tmpdir(), "lossless-cli-test-"));
  try {
    const path = join(directory, "rewrite.md");
    writeFileSync(path, "Keep my file");
    const output = run("--replay", "--out", path);
    assert.equal(output.status, 1);
    assert.equal(readFileSync(path, "utf8"), "Keep my file");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
