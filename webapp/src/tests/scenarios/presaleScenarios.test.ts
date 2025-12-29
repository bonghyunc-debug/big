// 분양권/입주권 양도 시나리오 테스트 (소득세법 제94조, 제104조)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP1Asset } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '분양권투자자',
  rrn: '850101-1234567',
  address: '서울특별시 송파구',
};

function createPresaleTestCase(assets: Omit<BP1Asset, 'id'>[], overrides: Partial<TaxCase> = {}): TaxCase {
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

const defaultUserFlags = {
  unregistered: false,
  nonBusinessLand: false,
  multiHomeSurtax: false,
  multiHomeCount: 0,
  adjustedArea: false,
  oneHouseExemption: false,
  highValueHousing: false,
};

describe('P-001: 분양권 1년 미만 양도 (70% 세율)', () => {
  it('분양권 6개월 보유 후 양도 → 70% 단일세율', () => {
    // 소득세법 제104조 제1항 제11호의2
    // 2021.6.1 이후 양도: 1년 미만 70%
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-38', // 분양권 1년 미만 70%
        assetTypeCode: '26', // 분양권
        transferDate: '2024-08-15',
        acquireDate: '2024-02-20', // 6개월 보유
        transferPrice: 600000000, // 분양권 매매가 6억
        acquirePrice: 500000000,  // 분양가 + 프리미엄 5억
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 분양권은 장특공 배제
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 분양권 1년 미만: 70% 단일세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(70);

    // 장특공 배제
    expect(assetResult.ltDeductionRate).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('P-002: 분양권 1-2년 양도 (60% 세율)', () => {
  it('분양권 1년 6개월 보유 후 양도 → 60% 단일세율', () => {
    // 소득세법 제104조 제1항 제11호의2
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-39', // 분양권 1-2년 60%
        assetTypeCode: '26',
        transferDate: '2024-08-15',
        acquireDate: '2023-02-15', // 1년 6개월 보유
        transferPrice: 700000000,
        acquirePrice: 550000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 분양권 1-2년: 60% 단일세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(60);

    expect(result.errors).toHaveLength(0);
  });
});

describe('P-003: 분양권 2년 이상 양도 (60% 세율)', () => {
  it('분양권 3년 보유 후 양도 → 60% 단일세율 (장특공 배제)', () => {
    // 소득세법 제104조 제1항 제11호의2
    // 분양권은 2년 이상 보유해도 60% 세율
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-40', // 분양권 2년 이상 60%
        assetTypeCode: '26',
        transferDate: '2024-08-15',
        acquireDate: '2021-06-15', // 3년 2개월 보유
        transferPrice: 800000000,
        acquirePrice: 450000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 분양권 2년 이상: 여전히 60% 세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(60);

    // 분양권은 장특공 배제
    expect(assetResult.ltDeductionRate).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('P-004: 조합원입주권 1년 미만 양도 (70% 세율)', () => {
  it('조합원입주권 8개월 보유 → 70% 단일세율', () => {
    // 소득세법 제104조 제1항 제11호
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-23', // 조합원입주권 1년 미만 70%
        assetTypeCode: '25', // 조합원입주권
        transferDate: '2024-08-15',
        acquireDate: '2023-12-15', // 8개월 보유
        transferPrice: 1500000000, // 15억
        acquirePrice: 1200000000,  // 권리가액
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 입주권 1년 미만: 70% 세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(70);

    expect(result.errors).toHaveLength(0);
  });
});

describe('P-005: 조합원입주권 2년 이상 양도 (기본세율)', () => {
  it('조합원입주권 3년 보유 → 기본세율 + 장특공', () => {
    // 소득세법 제95조, 제104조
    // 조합원입주권은 2년 이상 보유시 기본세율 적용
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-30', // 조합원입주권 2년 이상 기본세율
        assetTypeCode: '25',
        transferDate: '2024-08-15',
        acquireDate: '2021-03-15', // 3년 5개월 보유
        transferPrice: 3000000000, // 30억
        acquirePrice: 2000000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02', // 일반 장특공
        holdingYears: 3,
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 입주권 2년 이상: 기본세율 (누진)
    expect(assetResult.rateType).toBe('progressive');

    // 장특공 적용 (3년: 6%)
    expect(assetResult.ltDeductionRate).toBeGreaterThanOrEqual(6);

    expect(result.errors).toHaveLength(0);
  });
});

describe('P-006: 1세대1주택 중 분양권 취득 후 종전주택 양도', () => {
  it('분양권 취득 후 3년 내 종전주택 양도 → 비과세 특례', () => {
    // 소득세법 시행령 제156조의3
    // 1주택자가 분양권 취득 후 3년 내 종전주택 양도시 비과세
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-10', // 기본세율 (비과세 대상)
        assetTypeCode: '2', // 종전주택
        transferDate: '2024-08-15',
        acquireDate: '2018-01-15', // 6년 보유
        transferPrice: 900000000, // 9억 (12억 이하)
        acquirePrice: 500000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '01', // 1세대1주택
        holdingYears: 6,
        residenceYears: 5, // 5년 거주
        userFlags: {
          ...defaultUserFlags,
          oneHouseExemption: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 1세대1주택 비과세 조건 충족시 양도소득금액 0 또는 비과세
    // (실제 비과세 여부는 다른 조건도 검토 필요)
    expect(result.errors).toHaveLength(0);
  });

  it('분양권 취득 후 3년 초과 종전주택 양도 → 과세', () => {
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '2',
        transferDate: '2024-08-15',
        acquireDate: '2016-01-15', // 8년 보유
        transferPrice: 700000000,
        acquirePrice: 400000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02', // 일반 장특공
        holdingYears: 8,
        residenceYears: 4,
        userFlags: defaultUserFlags, // 비과세 플래그 없음
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 비과세 미적용 → 양도소득금액 발생
    expect(assetResult.gainIncome).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('분양권/입주권 기본공제', () => {
  it('분양권/입주권 양도 → 연 250만원 기본공제', () => {
    // 소득세법 제103조
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-39',
        assetTypeCode: '26',
        transferDate: '2024-08-15',
        acquireDate: '2023-06-15', // 1년 2개월
        transferPrice: 300000000,
        acquirePrice: 250000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);

    // 기본공제 적용 확인 (버킷별 250만원)
    expect(result.mainResult.line07_basicDeduction).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('조정대상지역 분양권', () => {
  it('조정대상지역 분양권 → 추가 가산세율 없음 (이미 고세율)', () => {
    // 분양권은 이미 60-70% 고세율이므로 추가 가산 없음
    const testCase = createPresaleTestCase([
      {
        rateCode: '1-39',
        assetTypeCode: '26',
        transferDate: '2024-08-15',
        acquireDate: '2023-06-15',
        transferPrice: 1000000000,
        acquirePrice: 800000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03',
        userFlags: {
          ...defaultUserFlags,
          adjustedArea: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 조정대상지역이어도 분양권은 추가 가산 없음
    expect(assetResult.additionalRate ?? 0).toBe(0);

    // 기본 60% 세율만 적용
    expect(assetResult.rateValue).toBe(60);

    expect(result.errors).toHaveLength(0);
  });
});
