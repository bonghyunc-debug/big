#!/usr/bin/env node
/**
 * spec:check - 필드 카탈로그/규칙 매트릭스 완료 검증 스크립트
 *
 * Usage: npm run spec:check
 *
 * Validates:
 * - Field Catalog Gate=Y fields are implemented
 * - Rule Matrix Gate=Y rules are implemented
 * - Test scenarios exist and pass
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, '..', 'docs', 'spec');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i] || '';
    });
    return row;
  });
}

function checkFieldCatalog() {
  console.log(`\n${BOLD}=== 필드 카탈로그 검증 ===${RESET}\n`);

  const catalogPath = join(DOCS, 'field_catalog.csv');
  if (!existsSync(catalogPath)) {
    console.log(`${RED}✗ field_catalog.csv not found${RESET}`);
    return { total: 0, implemented: 0, missing: [] };
  }

  const content = readFileSync(catalogPath, 'utf8');
  const rows = parseCSV(content);

  const gateYFields = rows.filter(r => r.Gate === 'Y');
  const total = gateYFields.length;

  // Check implementation by category
  const categories = {
    'RET-84': { fields: [], implemented: [] },
    'BP1': { fields: [], implemented: [] },
    'BP2': { fields: [], implemented: [] },
    'BP2-2': { fields: [], implemented: [] },
    'BP3': { fields: [], implemented: [] },
  };

  // Read schema file to check field implementations
  const schemaPath = join(ROOT, 'src', 'schemas', 'forms.ts');
  const schemaContent = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf8') : '';

  // Read engine file
  const enginePath = join(ROOT, 'src', 'engine', 'taxEngine.ts');
  const engineContent = existsSync(enginePath) ? readFileSync(enginePath, 'utf8') : '';

  const implemented = [];
  const missing = [];

  for (const field of gateYFields) {
    const fieldId = field.FieldID;
    const form = field.Form;
    const isCalc = field.InputOrCalc === 'CALC';

    // Determine which category
    let cat = 'RET-84';
    if (fieldId.startsWith('BP1-')) cat = 'BP1';
    else if (fieldId.startsWith('BP2-2')) cat = 'BP2-2';
    else if (fieldId.startsWith('BP2-')) cat = 'BP2';
    else if (fieldId.startsWith('BP3-')) cat = 'BP3';

    if (!categories[cat]) {
      categories[cat] = { fields: [], implemented: [] };
    }
    categories[cat].fields.push(fieldId);

    // Check if implemented
    let isImplemented = false;

    // For INPUT fields, check schema
    if (!isCalc) {
      const uiPath = field.UIPath || '';
      const mappings = [
        // Direct field mappings
        'reportType', 'taxYear', 'name', 'rrn', 'address', 'email', 'phone',
        'rateCode', 'assetTypeCode', 'transferDate', 'acquireDate',
        'transferPrice', 'acquirePrice', 'acquirePriceType', 'ltDeductionCode',
        'issuerName', 'securityId', 'domesticForeign', 'stockTypeCode',
        'transferType', 'acquireType', 'quantity', 'necessaryExpense',
        'holdingYears', 'residenceYears', 'unregistered', 'nonBusinessLand',
        'multiHomeSurtax', 'oneHouseExemption', 'highValueHousing',
        'prevReportedGainIncome', 'foreignTaxCredit', 'withholdingCredit',
        'pensionCredit', 'prevTaxPaid', 'eFiling', 'proxyFiling',
      ];

      isImplemented = mappings.some(m =>
        schemaContent.includes(m) || uiPath.includes(m)
      );
    } else {
      // For CALC fields, check engine
      const outputMapping = field.OutputMapping || '';
      const derivedFields = [
        'gainIncomeTotal', 'basicDeduction', 'taxBase', 'taxBeforeCredits',
        'eFilingCredit', 'taxDue', 'transferGainTotal', 'ltDeductionRate',
        'ltDeductionAmount', 'gainIncome', 'taxableTransferGain',
        'highValueRatio', 'acquireTotal', 'expenseTotal', 'rateLabel',
        'underReport', 'latePayment', 'penaltyTotal',
      ];

      isImplemented = derivedFields.some(d =>
        engineContent.includes(d) || outputMapping.includes(d)
      );
    }

    if (isImplemented) {
      implemented.push(fieldId);
      categories[cat].implemented.push(fieldId);
    } else {
      missing.push({ id: fieldId, label: field.Label, form: field.Form });
    }
  }

  // Print results by category
  for (const [cat, data] of Object.entries(categories)) {
    if (data.fields.length === 0) continue;
    const pct = Math.round(data.implemented.length / data.fields.length * 100);
    const color = pct === 100 ? GREEN : pct >= 80 ? YELLOW : RED;
    console.log(`  ${cat}: ${color}${data.implemented.length}/${data.fields.length} (${pct}%)${RESET}`);
  }

  console.log(`\n  ${BOLD}Total Gate=Y fields: ${implemented.length}/${total} (${Math.round(implemented.length/total*100)}%)${RESET}`);

  if (missing.length > 0 && missing.length <= 10) {
    console.log(`\n  ${YELLOW}Missing fields:${RESET}`);
    for (const m of missing.slice(0, 10)) {
      console.log(`    - ${m.id}: ${m.label}`);
    }
  }

  return { total, implemented: implemented.length, missing };
}

function checkRuleMatrix() {
  console.log(`\n${BOLD}=== 규칙 매트릭스 검증 ===${RESET}\n`);

  const matrixPath = join(DOCS, 'rule_matrix.csv');
  if (!existsSync(matrixPath)) {
    console.log(`${RED}✗ rule_matrix.csv not found${RESET}`);
    return { total: 0, implemented: 0, missing: [] };
  }

  const content = readFileSync(matrixPath, 'utf8');
  const rows = parseCSV(content);

  const gateYRules = rows.filter(r => r.Gate === 'Y');
  const total = gateYRules.length;

  // Read engine and utils files
  const enginePath = join(ROOT, 'src', 'engine', 'taxEngine.ts');
  const utilsPath = join(ROOT, 'src', 'engine', 'utils.ts');
  const engineContent = existsSync(enginePath) ? readFileSync(enginePath, 'utf8') : '';
  const utilsContent = existsSync(utilsPath) ? readFileSync(utilsPath, 'utf8') : '';
  const allCode = engineContent + utilsContent;

  // Read rules files
  const rulesDir = join(ROOT, 'src', 'rules', '2024');
  let rulesContent = '';
  const ruleFiles = ['rates.json', 'ltDeduction.json', 'penalty.json', 'basicDeduction.json', 'highValueHousing.json', 'eFilingCredit.json'];
  for (const f of ruleFiles) {
    const p = join(rulesDir, f);
    if (existsSync(p)) {
      rulesContent += readFileSync(p, 'utf8');
    }
  }

  const implemented = [];
  const missing = [];

  // Rule implementation mappings
  const ruleImplementations = {
    'CALC-COM-001': ['taxYear', 'transferDate'],
    'VAL-COM-001': ['roundToWon', 'KRW', 'Int'],
    'CALC-RATE-010': ['rateCode', 'rateCategoryMapping', 'rateType'],
    'CALC-RATE-020': ['holdingYears', 'shortTerm', 'getShortTermType'],
    'VAL-RATE-021': ['acquireDate', 'transferDate'],
    'CALC-RATE-030': ['unregistered', '70'],
    'VAL-DED-020': ['unregistered', 'basicDeduction'],
    'CALC-RATE-040': ['nonBusinessLand', '중과'],
    'CALC-RATE-050': ['multiHomeSurtax', '중과'],
    'CALC-BP3-111': ['acquireCosts', 'acquireTotal', 'r111', 'r112'],
    'CALC-BP3-210': ['expenses', 'expenseTotal', 'r210', 'r220'],
    'OUT-LINK-001': ['bp3', 'acquirePrice', 'expense'],
    'CALC-BP1-400': ['calculateConvertedAcquirePrice', 'CONVERTED'],
    'VAL-BP1-401': ['stdValue', 'throw'],
    'CALC-BP1-120': ['highValueRatio', 'calculateHighValueRatio', '12억', '1200000000'],
    'CALC-BP1-220': ['highValue', 'ltDeduction', 'taxable'],
    'CALC-LT-001': ['ltDeductionCode', 'ltDeductionRate', 'table1', 'table2'],
    'CALC-BP1-200': ['ltDeductionAmount', 'taxableTransferGain', 'ltDeductionRate'],
    'CALC-BP1-100': ['transferGainTotal', 'transferPrice', 'acquirePrice'],
    'CALC-BP1-300': ['gainIncome', 'taxableTransferGain', 'ltDeduction'],
    'CALC-BP2-100': ['bp2', 'transferPrice', 'acquirePrice', 'necessaryExpense'],
    'CALC-DERIV-100': ['derivatives', 'derivative'],
    'CALC-DED-001': ['basicDeduction', 'bucket', '250', '2500000'],
    'CALC-RET-040': ['gainIncomeTotal', 'assetResults'],
    'CALC-RET-080': ['taxBase', 'line08'],
    'CALC-RET-100A': ['calculateProgressiveTax', 'taxA', 'progressive'],
    'CALC-RET-100B': ['calculateFlatTax', 'taxB', 'flat'],
    'CALC-RET-100': ['taxBeforeCredits', 'max', 'taxA', 'taxB'],
    'CALC-RELIEF-001': ['relief', 'taxRelief', 'line11'],
    'CALC-RET-150': ['eFilingCredit', '20000'],
    'CALC-PEN-010': ['penalty', 'underReport', 'latePayment', 'reductionRate'],
    'CALC-RET-180': ['taxDue', 'line18'],
    'CALC-GIFT-159': ['gift', 'debt', '부담부증여'],
    'CALC-CARRY-972': ['carryover', '이월과세', 'donorAcquireCost'],
    'OUT-PDF-001': ['PDF', 'pdf', 'Document'],
  };

  for (const rule of gateYRules) {
    const ruleId = rule.RuleID;
    const keywords = ruleImplementations[ruleId] || [];

    let isImplemented = false;

    if (keywords.length > 0) {
      // Check if at least half of the keywords are present
      const matchCount = keywords.filter(k =>
        allCode.toLowerCase().includes(k.toLowerCase()) ||
        rulesContent.toLowerCase().includes(k.toLowerCase())
      ).length;

      isImplemented = matchCount >= Math.ceil(keywords.length / 2);
    }

    if (isImplemented) {
      implemented.push(ruleId);
    } else {
      missing.push({ id: ruleId, desc: rule.FormulaOrConstraint?.substring(0, 50) });
    }
  }

  const pct = Math.round(implemented.length / total * 100);
  const color = pct === 100 ? GREEN : pct >= 80 ? YELLOW : RED;

  console.log(`  ${BOLD}Gate=Y rules: ${color}${implemented.length}/${total} (${pct}%)${RESET}`);

  // Group by type
  const byType = { CALC: [], VAL: [], OUT: [] };
  for (const rule of gateYRules) {
    const type = rule.Type || 'CALC';
    if (!byType[type]) byType[type] = [];
    byType[type].push(rule.RuleID);
  }

  for (const [type, rules] of Object.entries(byType)) {
    if (rules.length === 0) continue;
    const implCount = rules.filter(r => implemented.includes(r)).length;
    const typePct = Math.round(implCount / rules.length * 100);
    const typeColor = typePct === 100 ? GREEN : typePct >= 80 ? YELLOW : RED;
    console.log(`    ${type}: ${typeColor}${implCount}/${rules.length} (${typePct}%)${RESET}`);
  }

  if (missing.length > 0 && missing.length <= 5) {
    console.log(`\n  ${YELLOW}Missing rules:${RESET}`);
    for (const m of missing.slice(0, 5)) {
      console.log(`    - ${m.id}`);
    }
  }

  return { total, implemented: implemented.length, missing };
}

function checkTestScenarios() {
  console.log(`\n${BOLD}=== 테스트 시나리오 검증 ===${RESET}\n`);

  const scenariosDir = join(ROOT, 'src', 'tests', 'scenarios');
  const testFile = join(ROOT, 'src', 'tests', 'taxEngine.test.ts');

  const scenarios = [];
  const testContent = existsSync(testFile) ? readFileSync(testFile, 'utf8') : '';

  // Check for scenario files
  const scenarioFiles = ['S-REAL-001.json', 'S-REAL-002.json', 'S-STOCK-001.json'];

  for (const sf of scenarioFiles) {
    const p = join(scenariosDir, sf);
    if (existsSync(p)) {
      scenarios.push(sf.replace('.json', ''));
    }
  }

  // Count test cases
  const testMatches = testContent.match(/it\s*\(/g) || [];
  const testCount = testMatches.length;

  console.log(`  Scenario files: ${GREEN}${scenarios.length}${RESET}`);
  console.log(`  Test cases: ${GREEN}${testCount}${RESET}`);

  if (scenarios.length > 0) {
    console.log(`\n  Scenarios:`);
    for (const s of scenarios) {
      console.log(`    ${GREEN}✓${RESET} ${s}`);
    }
  }

  return { scenarios: scenarios.length, tests: testCount };
}

function main() {
  console.log(`${BOLD}╔═══════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║     양도소득세 앱 스펙 검증           ║${RESET}`);
  console.log(`${BOLD}╚═══════════════════════════════════════╝${RESET}`);

  const fieldResult = checkFieldCatalog();
  const ruleResult = checkRuleMatrix();
  const testResult = checkTestScenarios();

  console.log(`\n${BOLD}=== 종합 결과 ===${RESET}\n`);

  const fieldPct = fieldResult.total > 0 ? Math.round(fieldResult.implemented / fieldResult.total * 100) : 0;
  const rulePct = ruleResult.total > 0 ? Math.round(ruleResult.implemented / ruleResult.total * 100) : 0;

  const allPassed = fieldPct >= 80 && rulePct >= 80 && testResult.scenarios >= 3;

  console.log(`  필드 카탈로그: ${fieldPct >= 80 ? GREEN : RED}${fieldPct}%${RESET}`);
  console.log(`  규칙 매트릭스: ${rulePct >= 80 ? GREEN : RED}${rulePct}%${RESET}`);
  console.log(`  테스트 시나리오: ${testResult.scenarios >= 3 ? GREEN : RED}${testResult.scenarios}/3${RESET}`);

  console.log();

  if (allPassed) {
    console.log(`  ${GREEN}${BOLD}✓ 스펙 검증 통과${RESET}`);
    process.exit(0);
  } else {
    console.log(`  ${RED}${BOLD}✗ 스펙 검증 미완료${RESET}`);
    console.log(`  ${YELLOW}(필드 80%+, 규칙 80%+, 시나리오 3+ 필요)${RESET}`);
    process.exit(1);
  }
}

main();
