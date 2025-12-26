#!/usr/bin/env node
/**
 * 스펙 진행률 계산 + docs/PROGRESS.md 자동 업데이트
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

const root = process.cwd();
const fieldPath = path.join(root, "docs/spec/field_catalog.csv");
const rulePath = path.join(root, "docs/spec/rule_matrix.csv");
const implPath = path.join(root, "docs/spec/implementation_map.csv");
const outPath = path.join(root, "docs/PROGRESS.md");

const fields = parseCsv(readText(fieldPath)).filter((x) => x.Gate === "Y");
const rules = parseCsv(readText(rulePath)).filter((x) => x.Gate === "Y");
const impl = parseCsv(readText(implPath));

const implIndex = new Map();
for (const r of impl) implIndex.set(`${r.Type}:${r.ID}`, r);

function doneCount(type, ids) {
  let done = 0;
  for (const id of ids) {
    const row = implIndex.get(`${type}:${id}`);
    if (row && (row.Status || "").toUpperCase() === "DONE") done++;
  }
  return done;
}

const fieldIds = fields.map((x) => x.FieldID);
const ruleIds = rules.map((x) => x.RuleID);

const fieldDone = doneCount("FIELD", fieldIds);
const ruleDone = doneCount("RULE", ruleIds);

const fieldPct = fieldIds.length ? Math.round((fieldDone / fieldIds.length) * 100) : 0;
const rulePct = ruleIds.length ? Math.round((ruleDone / ruleIds.length) * 100) : 0;

const now = new Date().toISOString().slice(0, 10);
const md = `# 진행률(자동 업데이트)

- 업데이트: ${now}
- Field Gate: ${fieldDone}/${fieldIds.length} (${fieldPct}%)
- Rule Gate: ${ruleDone}/${ruleIds.length} (${rulePct}%)

## 다음 작업(권장)
1) Field Gate 미완료 항목의 UI/출력 매핑 구현
2) Rule Gate 미완료 항목의 계산/검증 구현 + 테스트 추가
3) 시나리오 대표세트 추가 및 홈택스 골든 비교

`;
fs.writeFileSync(outPath, md, "utf-8");
console.log(md);
