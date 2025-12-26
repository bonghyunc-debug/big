#!/usr/bin/env node
/**
 * spec 게이트 검사
 * - Gate=Y 필드/규칙이 (근거/출력매핑/테스트/구현매핑) 요건을 만족하는지 확인
 *
 * 사용:
 *   node scripts/spec/check-spec.mjs
 */
import fs from "node:fs";
import path from "node:path";

function readText(p) {
  return fs.readFileSync(p, "utf-8");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row = {};
    header.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

function fail(msg) {
  console.error("❌ " + msg);
  process.exitCode = 1;
}

const root = process.cwd();
const fieldPath = path.join(root, "docs/spec/field_catalog.csv");
const rulePath = path.join(root, "docs/spec/rule_matrix.csv");
const implPath = path.join(root, "docs/spec/implementation_map.csv");

if (!fs.existsSync(fieldPath)) fail(`missing: ${fieldPath}`);
if (!fs.existsSync(rulePath)) fail(`missing: ${rulePath}`);
if (!fs.existsSync(implPath)) fail(`missing: ${implPath}`);

const fields = parseCsv(readText(fieldPath));
const rules = parseCsv(readText(rulePath));
const impl = parseCsv(readText(implPath));

const implIndex = new Map();
for (const r of impl) {
  implIndex.set(`${r.Type}:${r.ID}`, r);
}

let ok = true;

// Field gate checks
for (const f of fields.filter((x) => x.Gate === "Y")) {
  const key = `FIELD:${f.FieldID}`;
  const m = implIndex.get(key);
  if (!f.Evidence) { ok = false; fail(`Field ${f.FieldID} missing Evidence`); }
  if (!f.OutputMapping) { ok = false; fail(`Field ${f.FieldID} missing OutputMapping`); }
  if (!f.UIPath && f.InputOrCalc !== "OUT_ONLY") { ok = false; fail(`Field ${f.FieldID} missing UIPath`); }
  if (!m) { ok = false; fail(`ImplementationMap missing row for ${key}`); }
  else {
    if ((m.Status || "").toUpperCase() !== "DONE") { ok = false; fail(`Field ${f.FieldID} Status not DONE (now=${m.Status})`); }
    if (!m.ImplRef) { ok = false; fail(`Field ${f.FieldID} missing ImplRef`); }
  }
}

// Rule gate checks
for (const r of rules.filter((x) => x.Gate === "Y")) {
  const key = `RULE:${r.RuleID}`;
  const m = implIndex.get(key);
  if (!r.Evidence) { ok = false; fail(`Rule ${r.RuleID} missing Evidence`); }
  if (!r.TestID) { ok = false; fail(`Rule ${r.RuleID} missing TestID`); }
  if (!m) { ok = false; fail(`ImplementationMap missing row for ${key}`); }
  else {
    if ((m.Status || "").toUpperCase() !== "DONE") { ok = false; fail(`Rule ${r.RuleID} Status not DONE (now=${m.Status})`); }
    if (!m.ImplRef) { ok = false; fail(`Rule ${r.RuleID} missing ImplRef`); }
    if (!m.TestRef) { ok = false; fail(`Rule ${r.RuleID} missing TestRef`); }
  }
}

if (ok) {
  console.log("✅ spec gate PASS");
} else {
  console.log("⚠️ spec gate FAIL (see errors above)");
  process.exitCode = 1;
}
