/**
 * Accuracy eval for ClauseCheck.
 *
 *   npm run eval                 # rule engine only (free, deterministic)
 *   npm run eval -- --ai         # rules + Claude review (needs ANTHROPIC_API_KEY)
 *   npm run eval -- --min-precision 0.9 --min-recall 0.6   # fail CI below thresholds
 *
 * Compares findings on each sample lease against the hand labels in
 * eval/labels.json and reports precision, recall and F1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLease } from "../src/lib/analyze";
import type { AnalysisResult } from "../src/lib/types";

interface Label {
  ruleId: string;
  clause: string;
}

const ROOT = join(import.meta.dirname, "..");
const labels = JSON.parse(
  readFileSync(join(ROOT, "eval", "labels.json"), "utf8"),
) as Record<string, Label[] | string>;

const args = process.argv.slice(2);
const useAi = args.includes("--ai");
function numArg(name: string): number | null {
  const i = args.indexOf(name);
  return i === -1 ? null : Number(args[i + 1]);
}
const minPrecision = numArg("--min-precision");
const minRecall = numArg("--min-recall");

interface FileScore {
  file: string;
  tp: number;
  fp: number;
  fn: number;
  misses: Label[];
  falseAlarms: string[];
  other: number;
  aiUsed: boolean;
}

function scoreFile(file: string, expected: Label[], result: AnalysisResult): FileScore {
  const clauseText = new Map(result.clauses.map((c) => [c.id, c.text]));
  const remaining = [...expected];
  let tp = 0;
  const falseAlarms: string[] = [];
  let other = 0;

  for (const f of result.findings) {
    if (f.ruleId === "ai:other") {
      other++;
      continue;
    }
    const text = clauseText.get(f.clauseId) ?? "";
    const hit = remaining.findIndex((l) => l.ruleId === f.ruleId && text.includes(l.clause));
    if (hit >= 0) {
      tp++;
      remaining.splice(hit, 1);
    } else {
      falseAlarms.push(`${f.ruleId} @ "${text.slice(0, 50)}..."`);
    }
  }

  return {
    file,
    tp,
    fp: falseAlarms.length,
    fn: remaining.length,
    misses: remaining,
    falseAlarms,
    other,
    aiUsed: result.meta.aiUsed,
  };
}

const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const scores: FileScore[] = [];
  for (const [file, expected] of Object.entries(labels)) {
    if (file.startsWith("$") || typeof expected === "string") continue;
    const text = readFileSync(join(ROOT, "public", "samples", file), "utf8");
    const result = await analyzeLease(text, { useAi });
    if (useAi && !result.meta.aiUsed) {
      console.warn(`warning: AI review did not run for ${file}: ${result.meta.aiNote}`);
    }
    scores.push(scoreFile(file, expected, result));
  }

  const tp = scores.reduce((s, x) => s + x.tp, 0);
  const fp = scores.reduce((s, x) => s + x.fp, 0);
  const fn = scores.reduce((s, x) => s + x.fn, 0);
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  console.log(`\nClauseCheck eval (${useAi ? "rules + Claude review" : "rules only"})\n`);
  console.log("| Lease | TP | FP | FN | Precision | Recall | Extra AI flags |");
  console.log("|---|---|---|---|---|---|---|");
  for (const s of scores) {
    console.log(
      `| ${s.file} | ${s.tp} | ${s.fp} | ${s.fn} | ${pct(ratio(s.tp, s.tp + s.fp))} | ${pct(ratio(s.tp, s.tp + s.fn))} | ${s.other} |`,
    );
  }
  console.log(`| **Total** | ${tp} | ${fp} | ${fn} | **${pct(precision)}** | **${pct(recall)}** | |`);
  console.log(`\nF1: ${pct(f1)}`);

  for (const s of scores) {
    for (const m of s.misses) console.log(`  missed     ${s.file}: ${m.ruleId} ("${m.clause}")`);
    for (const a of s.falseAlarms) console.log(`  false alarm ${s.file}: ${a}`);
  }

  let failed = false;
  if (minPrecision !== null && precision < minPrecision) {
    console.error(`\nPrecision ${pct(precision)} is below the threshold ${pct(minPrecision)}`);
    failed = true;
  }
  if (minRecall !== null && recall < minRecall) {
    console.error(`\nRecall ${pct(recall)} is below the threshold ${pct(minRecall)}`);
    failed = true;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
