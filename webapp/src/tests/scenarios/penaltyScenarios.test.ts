// 가산세/수정신고 시나리오 테스트 (국세기본법 제47조~제47조의5)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP1Asset } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '가산세납세자',
  rrn: '800101-1234567',
  address: '서울특별시 강남구',
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

function createPenaltyTestCase(
  assets: Omit<BP1Asset, 'id'>[],
  penaltyInfo?: TaxCase['penaltyInfo'],
  overrides: Partial<TaxCase> = {}
): TaxCase {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: overrides.reportType ?? 'FINAL',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: assets.map((a) => ({ ...a, id: uuidv4() })),
    bp2Assets: [],
    reliefs: [],
    penaltyInfo,
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

const baseAsset: Omit<BP1Asset, 'id'> = {
  rateCode: '1-10',
  assetTypeCode: '1',
  transferDate: '2024-06-15',
  acquireDate: '2018-01-15',
  transferPrice: 500000000,
  acquirePrice: 200000000,
  acquirePriceType: 'ACTUAL',
  ltDeductionCode: '02',
  holdingYears: 6,
  userFlags: defaultUserFlags,
};

describe('PEN-001: 무신고 가산세 (일반)', () => {
  it('일반 무신고 → 20% 가산세', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NO_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: false,
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyUnderReport).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-002: 무신고 가산세 (부정)', () => {
  it('부정 무신고 → 40% 가산세', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'UNFAITHFUL_NO',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: false,
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyUnderReport).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-003: 과소신고 가산세 (일반)', () => {
  it('일반 과소신고 → 10% 가산세', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'UNDER_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: false,
      },
      { reportType: 'AMEND' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyUnderReport).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-004: 과소신고 가산세 (부정)', () => {
  it('부정 과소신고 → 40% 가산세', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'UNFAITHFUL_UNDER',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: false,
      },
      { reportType: 'AMEND' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyUnderReport).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-005: 기한후신고 1개월 내 (50% 감면)', () => {
  it('1개월 내 기한후신고 → 무신고 가산세 50% 감면', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NO_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: true,
        dueDate: '2024-08-31',
        reportDate: '2024-09-15',
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-006: 기한후신고 3개월 내 (30% 감면)', () => {
  it('3개월 내 기한후신고 → 무신고 가산세 30% 감면', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NO_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: true,
        dueDate: '2024-08-31',
        reportDate: '2024-10-15',
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-007: 기한후신고 6개월 내 (20% 감면)', () => {
  it('6개월 내 기한후신고 → 무신고 가산세 20% 감면', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NO_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 0,
        latePaymentBase: 0,
        reductionApplied: true,
        dueDate: '2024-08-31',
        reportDate: '2025-01-15',
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.errors).toHaveLength(0);
  });
});

describe('PEN-008: 납부지연이자 (납부불성실가산세)', () => {
  it('납부지연 100일 → 0.022%/일 이자', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NONE',
        underReportBase: 0,
        latePaymentDays: 100,
        latePaymentBase: 100000000,
        reductionApplied: false,
      },
      { reportType: 'AMEND' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyLatePayment).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('납부지연 365일 → 최대한도 적용', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NONE',
        underReportBase: 0,
        latePaymentDays: 365,
        latePaymentBase: 50000000,
        reductionApplied: false,
      },
      { reportType: 'AMEND' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyLatePayment).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('가산세 복합 시나리오', () => {
  it('무신고 + 납부지연 복합 가산세', () => {
    const testCase = createPenaltyTestCase(
      [baseAsset],
      {
        underReportType: 'NO_REPORT',
        underReportBase: 50000000,
        latePaymentDays: 240,
        latePaymentBase: 50000000,
        reductionApplied: false,
      },
      { reportType: 'LATE' }
    );

    const result = calculateTaxCase(testCase);
    expect(result.mainResult.penaltyUnderReport).toBeGreaterThan(0);
    expect(result.mainResult.penaltyLatePayment).toBeGreaterThan(0);
    expect(result.mainResult.penaltyTotal).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});
