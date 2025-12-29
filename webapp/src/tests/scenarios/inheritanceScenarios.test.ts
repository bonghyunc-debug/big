// 상속/증여 취득 양도 시나리오 테스트 (소득세법 제97조, 제97조의2)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP1Asset } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '상속인',
  rrn: '700101-1234567',
  address: '서울특별시 송파구',
};

const defaultUserFlags = {
  unregistered: false,
  nonBusinessLand: false,
  multiHomeSurtax: false,
  multiHomeCount: 0,
  adjustedArea: false,
  oneHouseExemption: false,
  highValueHousing: false,
};

function createInheritanceTestCase(assets: Omit<BP1Asset, 'id'>[], overrides: Partial<TaxCase> = {}): TaxCase {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: 'FINAL',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: assets.map((a) => ({ ...a, id: uuidv4() })),
    bp2Assets: [],
    reliefs: [],
    adjustments: {
      prevReportedGainIncome: 0,
      foreignTaxCredit: 0,
      withholdingCredit: 0,
      pensionCredit: 0,
      prevTaxPaid: 0,
    },
    flags: {
      eFiling: true,
      proxyFiling: false,
    },
    ...overrides,
  };
}

describe('I-001: 상속주택 동일세대 (보유기간 통산)', () => {
  it('피상속인과 동일세대 → 피상속인 보유기간 통산', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2022-03-15',
        acquireCause: '7',
        transferPrice: 2000000000,
        acquirePrice: 1500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 14,
        residenceYears: 10,
        inheritanceInfo: {
          enabled: true,
          inheritanceDate: '2022-03-15',
          decedentAcquireDate: '2010-01-15',
          decedentAcquireCost: 500000000,
          inheritanceTaxValue: 1500000000,
          sameHousehold: true,
          decedentHoldingYears: 12,
          decedentResidenceYears: 10,
          businessSuccession: false,
        },
        userFlags: {
          ...defaultUserFlags,
          oneHouseExemption: true,
          highValueHousing: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0]).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-002: 상속주택 별도세대 (본인 보유기간만)', () => {
  it('피상속인과 별도세대 → 상속인 보유기간만 산정', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2023-01-15',
        acquireCause: '7',
        transferPrice: 800000000,
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        inheritanceInfo: {
          enabled: true,
          inheritanceDate: '2023-01-15',
          decedentAcquireDate: '2005-06-15',
          decedentAcquireCost: 200000000,
          inheritanceTaxValue: 600000000,
          sameHousehold: false,
          decedentHoldingYears: 18,
          decedentResidenceYears: 16,
          businessSuccession: false,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0]).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-003: 상속토지 (취득가액 = 상속세평가액)', () => {
  it('상속토지 양도 → 상속세 평가액 기준 양도차익 계산', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2020-06-15',
        acquireCause: '7',
        transferPrice: 1000000000,
        acquirePrice: 700000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 4,
        inheritanceInfo: {
          enabled: true,
          inheritanceDate: '2020-06-15',
          decedentAcquireDate: '2010-01-15',
          decedentAcquireCost: 300000000,
          inheritanceTaxValue: 700000000,
          sameHousehold: false,
          decedentHoldingYears: 10,
          decedentResidenceYears: 0,
          businessSuccession: false,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];
    expect(assetResult.effectiveAcquirePrice).toBe(700000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-004: 증여재산 이월과세 5년 내 (2022년 이전 증여)', () => {
  it('5년 내 양도 → 증여자 취득가액 및 보유기간 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2021-03-15',
        acquireCause: '8',
        transferPrice: 600000000,
        acquirePrice: 400000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 3,
        carryoverTax: {
          enabled: true,
          giftDate: '2021-03-15',
          donorAcquireDate: '2012-01-15',
          donorAcquireCost: 150000000,
          giftTaxPaid: 40000000,
          giftTaxBase: 400000000,
          totalGiftTaxBase: 400000000,
          donorRelation: 'lineal',
          exclusionReason: 'NONE',
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];
    expect(assetResult.effectiveAcquirePrice).toBe(150000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-005: 증여재산 이월과세 10년 내 (2023년 이후 증여)', () => {
  it('10년 내 양도 → 증여자 취득가액 및 보유기간 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2023-06-15',
        acquireCause: '8',
        transferPrice: 1500000000,
        acquirePrice: 1200000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        carryoverTax: {
          enabled: true,
          giftDate: '2023-06-15',
          donorAcquireDate: '2008-03-15',
          donorAcquireCost: 300000000,
          giftTaxPaid: 150000000,
          giftTaxBase: 1200000000,
          totalGiftTaxBase: 1200000000,
          donorRelation: 'lineal',
          exclusionReason: 'NONE',
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];
    expect(assetResult.effectiveAcquirePrice).toBe(300000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-006: 증여재산 이월과세 배제 (1세대1주택 비과세)', () => {
  it('1세대1주택 비과세 요건 충족 → 이월과세 배제', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2020-03-15',
        acquireCause: '8',
        transferPrice: 900000000,
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 4,
        residenceYears: 3,
        carryoverTax: {
          enabled: false,
          giftDate: '2020-03-15',
          donorAcquireDate: '2010-01-15',
          donorAcquireCost: 200000000,
          giftTaxPaid: 50000000,
          giftTaxBase: 600000000,
          totalGiftTaxBase: 600000000,
          donorRelation: 'lineal',
          exclusionReason: 'ONE_HOUSE_EXEMPTION',
        },
        userFlags: {
          ...defaultUserFlags,
          oneHouseExemption: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];
    expect(assetResult.effectiveAcquirePrice).toBe(600000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-007: 부담부증여 (채무인수 부분)', () => {
  it('부담부증여 → 채무인수 부분은 양도, 나머지는 증여', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2023-06-15',
        acquireCause: '8',
        transferPrice: 1200000000,
        acquirePrice: 1000000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        giftWithDebt: {
          enabled: true,
          assessedValue: 1000000000,
          debtAmount: 300000000,
          donorAcquireCost: 400000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0]).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-008: 가업상속공제 대상', () => {
  it('가업상속공제 대상 자산 양도 → 경고 표시', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        acquireCause: '7',
        transferPrice: 2000000000,
        acquirePrice: 1500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 4,
        inheritanceInfo: {
          enabled: true,
          inheritanceDate: '2020-01-15',
          decedentAcquireDate: '2000-01-15',
          decedentAcquireCost: 500000000,
          inheritanceTaxValue: 1500000000,
          sameHousehold: false,
          decedentHoldingYears: 20,
          decedentResidenceYears: 0,
          businessSuccession: true,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0]).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('상속/증여 취득시기 및 취득가액', () => {
  it('상속: 상속개시일이 취득일, 상속세평가액이 취득가액', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2023-03-15',
        acquireCause: '7',
        transferPrice: 400000000,
        acquirePrice: 350000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        inheritanceInfo: {
          enabled: true,
          inheritanceDate: '2023-03-15',
          decedentAcquireDate: '2015-01-15',
          decedentAcquireCost: 200000000,
          inheritanceTaxValue: 350000000,
          sameHousehold: false,
          decedentHoldingYears: 8,
          decedentResidenceYears: 8,
          businessSuccession: false,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0].effectiveAcquirePrice).toBe(350000000);
    expect(result.errors).toHaveLength(0);
  });

  it('증여: 이월과세 배제시 증여세평가액이 취득가액', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2018-06-15',
        acquireCause: '8',
        transferPrice: 500000000,
        acquirePrice: 300000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 6,
        carryoverTax: {
          enabled: false,
          giftDate: '2018-06-15',
          donorAcquireDate: '2005-01-15',
          donorAcquireCost: 100000000,
          giftTaxPaid: 30000000,
          giftTaxBase: 300000000,
          totalGiftTaxBase: 300000000,
          donorRelation: 'lineal',
          exclusionReason: 'LOWER_TAX_BENEFIT',
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.assetResults[0].effectiveAcquirePrice).toBe(300000000);
    expect(result.errors).toHaveLength(0);
  });
});
