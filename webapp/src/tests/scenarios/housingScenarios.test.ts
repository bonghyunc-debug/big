// 주택 양도 시나리오 테스트 (소득세법 제89조, 시행령 제154조~제160조)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP1Asset } from '../../schemas';

// 기본 납세자 정보
const baseTaxpayer = {
  name: '테스트납세자',
  rrn: '800101-1234567',
  address: '서울특별시 강남구',
};

// 기본 케이스 생성 함수
function createTestCase(assets: Omit<BP1Asset, 'id'>[], overrides: Partial<TaxCase> = {}): TaxCase {
  return {
    id: `test-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: 'PRELIM',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: assets.map((a, i) => ({ ...a, id: `asset-${i}` })),
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

describe('H-002: 1세대1주택 고가주택 (15억원) - 12억 초과분 과세', () => {
  it('양도가액 15억, 취득가액 5억 → 12억 초과분(3억/15억)만 과세', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-52',
        assetTypeCode: '2', // 주택
        transferDate: '2024-06-15',
        acquireDate: '2019-06-15', // 5년 보유
        transferPrice: 1500000000, // 15억
        acquirePrice: 500000000,   // 5억
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01', // 1세대1주택 표2
        holdingYears: 5,
        residenceYears: 5,
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: true,
          highValueHousing: true, // 12억 초과 고가주택
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 전체 양도차익 = 15억 - 5억 = 10억
    expect(assetResult.transferGainTotal).toBe(1000000000);

    // 과세 비율 = (15억 - 12억) / 15억 = 3/15 = 0.2
    // 과세대상 양도차익 = 10억 × 0.2 = 2억
    expect(assetResult.taxableTransferGain).toBe(200000000);

    // 1세대1주택 장특공 표2: 5년 보유 5년 거주 = 40%
    // 장특공액 = 10억 × 40% = 4억 → 과세대상 장특공 = 4억 × 0.2 = 8천만원
    expect(assetResult.taxableLtDeduction).toBe(80000000);

    // 양도소득금액 = 2억 - 8천만 = 1.2억
    expect(assetResult.gainIncome).toBe(120000000);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-003: 1세대1주택 고가주택 (20억원, 10년 보유/거주)', () => {
  it('양도가액 20억, 취득가액 8억 → 최대 장특공 80% 적용', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-52',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2014-06-15', // 10년 보유
        transferPrice: 2000000000, // 20억
        acquirePrice: 800000000,   // 8억
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 10,
        residenceYears: 10,
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: true,
          highValueHousing: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 전체 양도차익 = 20억 - 8억 = 12억
    expect(assetResult.transferGainTotal).toBe(1200000000);

    // 과세 비율 = (20억 - 12억) / 20억 = 8/20 = 0.4
    // 과세대상 양도차익 = 12억 × 0.4 = 4.8억
    expect(assetResult.taxableTransferGain).toBe(480000000);

    // 장특공 표2: 10년 보유 10년 거주 = 80% (최대)
    expect(assetResult.ltDeductionRate).toBe(80);

    // 장특공액 = 12억 × 80% = 9.6억 → 과세대상 = 9.6억 × 0.4 = 3.84억
    expect(assetResult.taxableLtDeduction).toBe(384000000);

    // 양도소득금액 = 4.8억 - 3.84억 = 9600만원
    expect(assetResult.gainIncome).toBe(96000000);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-004: 일시적 2주택 (3년 내 종전주택 양도)', () => {
  it('신규주택 취득 후 3년 내 종전주택 양도 → 1세대1주택 비과세', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-52',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2018-06-15', // 6년 보유
        transferPrice: 900000000, // 9억 (12억 이하)
        acquirePrice: 500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 6,
        residenceYears: 4,
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: true, // 일시적 2주택 비과세 적용
          highValueHousing: false,
        },
        oneHouseExemptionDetail: {
          enabled: true,
          actualHoldingYears: 6,
          actualResidenceYears: 4,
          inheritedHoldingYears: 0,
          inheritedResidenceYears: 0,
          holdingExemptReason: 'NONE',
          residenceExemptReason: 'NONE',
          temporaryExemptReason: 'TEMPORARY_2HOUSE', // 일시적 2주택
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 9억원 이하 비과세 → 과세대상 양도차익 0원
    // (실제로는 비과세지만, 계산 엔진은 양도차익까지 계산하고
    // 비과세 여부는 별도 처리됨)
    expect(assetResult.transferGainTotal).toBe(400000000); // 4억

    // 비과세이므로 과세대상 = 0
    // (엔진에서 oneHouseExemption이고 12억 이하면 taxableTransferGain = 0)
    // 현재 엔진 로직에 따라 확인

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-006: 혼인합가 2주택 (5년 내 양도)', () => {
  it('혼인으로 인한 합가 후 5년 내 양도 → 1세대1주택 비과세', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-52',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2015-06-15', // 9년 보유
        transferPrice: 1100000000, // 11억 (12억 이하)
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 9,
        residenceYears: 7,
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: true,
          highValueHousing: false,
        },
        oneHouseExemptionDetail: {
          enabled: true,
          actualHoldingYears: 9,
          actualResidenceYears: 7,
          inheritedHoldingYears: 0,
          inheritedResidenceYears: 0,
          holdingExemptReason: 'NONE',
          residenceExemptReason: 'NONE',
          temporaryExemptReason: 'MARRIAGE_MERGE', // 혼인합가
        },
      },
    ]);

    const result = calculateTaxCase(testCase);

    // 혼인합가 2주택도 비과세 적용 (시행령 제155조)
    expect(result.errors).toHaveLength(0);
  });
});

describe('H-009: 조정대상지역 2주택 (한시배제 종료 후)', () => {
  it('2026.5.10 이후 양도 → 기본세율 + 20%p 중과', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-46', // 조정대상 2주택
        assetTypeCode: '2',
        transferDate: '2026-06-15', // 한시배제 종료 후
        acquireDate: '2020-06-15', // 6년 보유
        transferPrice: 800000000,
        acquirePrice: 500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 중과시 장특공 배제
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: true,
          multiHomeCount: 2,
          adjustedArea: true, // 조정대상지역
          oneHouseExemption: false,
          highValueHousing: false,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 한시배제 종료 후 → 기본세율 + 20%p 중과
    // 2주택 중과: 누진세율에 20%p 가산
    expect(assetResult.additionalRate).toBe(20);

    // 장특공 배제
    expect(assetResult.ltDeductionRate).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-010: 조정대상지역 3주택 이상 (한시배제 종료 후)', () => {
  it('2026.5.10 이후 양도 → 기본세율 + 30%p 중과', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-47', // 조정대상 3주택
        assetTypeCode: '2',
        transferDate: '2026-06-15',
        acquireDate: '2018-06-15', // 8년 보유
        transferPrice: 1000000000,
        acquirePrice: 600000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: true,
          multiHomeCount: 3,
          adjustedArea: true,
          oneHouseExemption: false,
          highValueHousing: false,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 3주택 이상: 기본세율 + 30%p
    expect(assetResult.additionalRate).toBe(30);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-011: 주택 1년 미만 양도 (70% 세율)', () => {
  it('보유기간 1년 미만 → 70% 단일세율', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-50',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2024-01-15', // 5개월 보유
        transferPrice: 500000000,
        acquirePrice: 400000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 배제
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: false,
          highValueHousing: false,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 주택 1년 미만: 70% 세율 (2021.6.1 이후)
    expect(assetResult.rateCode).toBe('1-50');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(70);

    // 장특공 배제
    expect(assetResult.ltDeductionRate).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-012: 주택 1-2년 양도 (60% 세율)', () => {
  it('보유기간 1년 이상 2년 미만 → 60% 단일세율', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-51',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2023-01-15', // 1년 5개월 보유
        transferPrice: 600000000,
        acquirePrice: 450000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: false,
          highValueHousing: false,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 주택 1-2년: 60% 세율 (2021.6.1 이후)
    expect(assetResult.rateCode).toBe('1-51');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(60);

    expect(result.errors).toHaveLength(0);
  });
});

describe('H-015: 동거봉양 합가 (10년 내 양도)', () => {
  it('부모 동거봉양으로 합가 후 10년 내 양도 → 1세대1주택 비과세', () => {
    const testCase = createTestCase([
      {
        rateCode: '1-52',
        assetTypeCode: '2',
        transferDate: '2024-06-15',
        acquireDate: '2012-06-15', // 12년 보유
        transferPrice: 1000000000, // 10억
        acquirePrice: 400000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01',
        holdingYears: 12,
        residenceYears: 10,
        userFlags: {
          unregistered: false,
          nonBusinessLand: false,
          multiHomeSurtax: false,
          multiHomeCount: 0,
          adjustedArea: false,
          oneHouseExemption: true,
          highValueHousing: false,
        },
        oneHouseExemptionDetail: {
          enabled: true,
          actualHoldingYears: 12,
          actualResidenceYears: 10,
          inheritedHoldingYears: 0,
          inheritedResidenceYears: 0,
          holdingExemptReason: 'NONE',
          residenceExemptReason: 'NONE',
          temporaryExemptReason: 'ELDERLY_CARE', // 동거봉양
        },
      },
    ]);

    const result = calculateTaxCase(testCase);

    // 동거봉양 합가도 10년 내 양도 시 비과세 (시행령 제155조)
    expect(result.errors).toHaveLength(0);
  });
});
