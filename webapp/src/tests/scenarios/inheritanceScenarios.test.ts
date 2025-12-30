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

describe('I-007: 부담부증여 (채무인수 부분) - 소득세법 시행령 제159조', () => {
  it('부담부증여 → 양도가액=채무액, 취득가액=증여자취득가액×비율', () => {
    // 시행령 제159조: 부담부증여 양도차익 계산
    // - 양도가액 = 채무액 = 300,000,000
    // - 비율 = 채무액/증여재산가액 = 300,000,000/1,000,000,000 = 0.3
    // - 취득가액 = 증여자취득가액 × 비율 = 400,000,000 × 0.3 = 120,000,000
    // - 양도차익 = 양도가액 - 취득가액 = 300,000,000 - 120,000,000 = 180,000,000
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2023-06-15',
        acquireCause: '8',
        transferPrice: 1200000000, // 실제 양도가액 (전체)
        acquirePrice: 1000000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        giftWithDebt: {
          enabled: true,
          assessedValue: 1000000000,  // 증여재산가액 (상증법 평가액)
          debtAmount: 300000000,       // 채무액 (수증자 인수)
          donorAcquireCost: 400000000, // 증여자 취득가액
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 시행령 제159조 검증
    expect(assetResult.effectiveTransferPrice).toBe(300000000); // 양도가액 = 채무액
    expect(assetResult.effectiveAcquirePrice).toBe(120000000);  // 취득가액 = 400M × 0.3
    expect(assetResult.transferGainTotal).toBe(180000000);      // 양도차익 = 300M - 120M
    expect(result.errors).toHaveLength(0);
  });

  it('부담부증여 → 증여재산평가방법에 따른 취득가액 결정 (시가평가시 실지취득가액)', () => {
    // 2023년 개정: 증여재산을 시가로 평가한 경우 → 실지취득가액 적용
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1', // 토지
        transferDate: '2024-08-15',
        acquireDate: '2024-01-15',
        acquireCause: '8',
        transferPrice: 800000000,
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 장특공 배제 (1년 미만)
        holdingYears: 0,
        giftWithDebt: {
          enabled: true,
          assessedValue: 600000000,  // 시가평가 증여재산가액
          debtAmount: 200000000,      // 채무액 (담보대출)
          donorAcquireCost: 300000000, // 증여자 실지취득가액
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 비율 = 200M / 600M = 1/3
    // 양도가액 = 채무액 = 200,000,000
    // 취득가액 = 300M × (1/3) = 100,000,000
    // 양도차익 = 200M - 100M = 100,000,000
    expect(assetResult.effectiveTransferPrice).toBe(200000000);
    expect(assetResult.effectiveAcquirePrice).toBe(100000000);
    expect(assetResult.transferGainTotal).toBe(100000000);
    expect(result.errors).toHaveLength(0);
  });

  it('부담부증여 → 채무비율 50%인 경우', () => {
    // 채무가 증여재산의 50%인 경우
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2022-01-15',
        acquireCause: '8',
        transferPrice: 1000000000,
        acquirePrice: 800000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 2,
        giftWithDebt: {
          enabled: true,
          assessedValue: 800000000,
          debtAmount: 400000000,       // 50% 채무 비율
          donorAcquireCost: 200000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 비율 = 400M / 800M = 0.5
    // 양도가액 = 채무액 = 400,000,000
    // 취득가액 = 200M × 0.5 = 100,000,000
    // 양도차익 = 400M - 100M = 300,000,000
    expect(assetResult.effectiveTransferPrice).toBe(400000000);
    expect(assetResult.effectiveAcquirePrice).toBe(100000000);
    expect(assetResult.transferGainTotal).toBe(300000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('I-007-2: 부담부증여 증여재산 평가방법별 취득가액 결정 (시행령 제159조 제1항 2023년 개정)', () => {
  it('시가 평가 → 증여자 실지취득가액 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2024-01-15',
        acquireCause: '8',
        transferPrice: 1000000000,
        acquirePrice: 800000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        holdingYears: 0,
        giftWithDebt: {
          enabled: true,
          assessedValue: 800000000,  // 시가 평가
          debtAmount: 200000000,
          valuationMethod: 'MARKET_PRICE',
          donorActualAcquireCost: 400000000,   // 실지취득가액
          donorStandardPriceAtAcquire: 300000000, // 기준시가 (미사용)
          donorAcquireCost: 400000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 시가평가 → 실지취득가액(400M) 적용
    // 비율 = 200M / 800M = 0.25
    // 취득가액 = 400M × 0.25 = 100,000,000
    expect(assetResult.effectiveAcquirePrice).toBe(100000000);
    expect(assetResult.effectiveTransferPrice).toBe(200000000);
    expect(result.errors).toHaveLength(0);
  });

  it('보충적 평가방법 → 취득 당시 기준시가 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2024-01-15',
        acquireCause: '8',
        transferPrice: 1000000000,
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        holdingYears: 0,
        giftWithDebt: {
          enabled: true,
          assessedValue: 600000000,  // 보충적 평가 (기준시가)
          debtAmount: 300000000,
          valuationMethod: 'SUPPLEMENTARY_STANDARD',
          donorActualAcquireCost: 500000000,   // 실지취득가액 (미사용)
          donorStandardPriceAtAcquire: 200000000, // 기준시가 적용
          donorAcquireCost: 500000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 보충적평가 → 기준시가(200M) 적용
    // 비율 = 300M / 600M = 0.5
    // 취득가액 = 200M × 0.5 = 100,000,000
    expect(assetResult.effectiveAcquirePrice).toBe(100000000);
    expect(assetResult.effectiveTransferPrice).toBe(300000000);
    expect(result.errors).toHaveLength(0);
  });

  it('임대료 환산가액 (2020.2.11 이후 양도) → 기준시가 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15', // 2020.2.11 이후
        acquireDate: '2023-01-15',
        acquireCause: '8',
        transferPrice: 800000000,
        acquirePrice: 500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        giftWithDebt: {
          enabled: true,
          assessedValue: 500000000,
          debtAmount: 250000000,
          valuationMethod: 'RENT_CONVERSION',
          donorActualAcquireCost: 400000000,
          donorStandardPriceAtAcquire: 300000000,
          donorAcquireCost: 400000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 임대료환산(2020.2.11 이후) → 기준시가(300M) 적용
    // 비율 = 250M / 500M = 0.5
    // 취득가액 = 300M × 0.5 = 150,000,000
    expect(assetResult.effectiveAcquirePrice).toBe(150000000);
    expect(assetResult.effectiveTransferPrice).toBe(250000000);
    expect(result.errors).toHaveLength(0);
  });

  it('담보채권액 (2023.2.28 이후 양도) → 기준시가 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-06-15', // 2023.2.28 이후
        acquireDate: '2023-03-15',
        acquireCause: '8',
        transferPrice: 1200000000,
        acquirePrice: 1000000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 1,
        giftWithDebt: {
          enabled: true,
          assessedValue: 1000000000,
          debtAmount: 400000000,
          valuationMethod: 'COLLATERAL_DEBT',
          donorActualAcquireCost: 600000000,
          donorStandardPriceAtAcquire: 500000000,
          donorAcquireCost: 600000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 담보채권액(2023.2.28 이후) → 기준시가(500M) 적용
    // 비율 = 400M / 1000M = 0.4
    // 취득가액 = 500M × 0.4 = 200,000,000
    expect(assetResult.effectiveAcquirePrice).toBe(200000000);
    expect(assetResult.effectiveTransferPrice).toBe(400000000);
    expect(result.errors).toHaveLength(0);
  });

  it('담보채권액 (2023.2.27 이전 양도) → 실지취득가액 적용', () => {
    const testCase = createInheritanceTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2023-02-20', // 2023.2.27 이전
        acquireDate: '2022-06-15',
        acquireCause: '8',
        transferPrice: 900000000,
        acquirePrice: 700000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 0,
        giftWithDebt: {
          enabled: true,
          assessedValue: 700000000,
          debtAmount: 350000000,
          valuationMethod: 'COLLATERAL_DEBT',
          donorActualAcquireCost: 400000000, // 실지취득가액 적용
          donorStandardPriceAtAcquire: 300000000,
          donorAcquireCost: 400000000,
        },
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 담보채권액(2023.2.27 이전) → 실지취득가액(400M) 적용
    // 비율 = 350M / 700M = 0.5
    // 취득가액 = 400M × 0.5 = 200,000,000
    expect(assetResult.effectiveAcquirePrice).toBe(200000000);
    expect(assetResult.effectiveTransferPrice).toBe(350000000);
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
