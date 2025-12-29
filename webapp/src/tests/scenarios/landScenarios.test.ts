// 토지 양도 시나리오 테스트 (소득세법 제94조, 제104조)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP1Asset } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '토지투자자',
  rrn: '750101-1234567',
  address: '경기도 수원시',
};

function createLandTestCase(lands: Omit<BP1Asset, 'id'>[], overrides: Partial<TaxCase> = {}): TaxCase {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: 'FINAL',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: lands.map((l, i) => ({ ...l, id: uuidv4() })),
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

describe('L-001: 일반토지 3년 이상 보유 (기본세율 + 장특공)', () => {
  it('일반토지 5년 보유 → 기본세율, 장특공 10%', () => {
    // 소득세법 제95조 제2항, 시행령 제167조의3
    const testCase = createLandTestCase([
      {
        rateCode: '1-10', // 기본세율
        assetTypeCode: '1', // 토지
        transferDate: '2024-08-15',
        acquireDate: '2019-03-15', // 5년 4개월 보유
        transferPrice: 800000000, // 8억
        acquirePrice: 400000000,  // 4억
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02', // 일반 장특공
        holdingYears: 5,
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 기본세율 (누진세율)
    expect(assetResult.rateType).toBe('progressive');

    // 장기보유특별공제: 5년 = 10% (토지: 3년 6%, +1년당 2%)
    expect(assetResult.ltDeductionRate).toBe(10);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-002: 일반토지 1년 미만 양도 (50% 세율)', () => {
  it('토지 6개월 보유 후 양도 → 50% 단일세율', () => {
    // 소득세법 제104조 제1항 제5호
    const testCase = createLandTestCase([
      {
        rateCode: '1-15', // 1년 미만 50%
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2024-02-20', // 6개월 보유
        transferPrice: 300000000,
        acquirePrice: 200000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 장특공 배제
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 1년 미만: 50% 단일세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(50);

    // 장특공 배제
    expect(assetResult.ltDeductionRate).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-003: 일반토지 1-2년 양도 (40% 세율)', () => {
  it('토지 1년 6개월 보유 후 양도 → 40% 단일세율', () => {
    // 소득세법 제104조 제1항 제5호
    const testCase = createLandTestCase([
      {
        rateCode: '1-21', // 1-2년 40%
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2023-02-15', // 1년 6개월 보유
        transferPrice: 400000000,
        acquirePrice: 300000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '03', // 장특공 배제
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 1-2년: 40% 단일세율
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(40);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-004: 비사업용토지 (기본세율 + 10%p)', () => {
  it('비사업용토지 양도 → 기본세율 + 10%p 가산', () => {
    // 소득세법 제104조 제1항 제8호
    const testCase = createLandTestCase([
      {
        rateCode: '1-33', // 비사업용토지
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2018-01-15', // 6년 보유
        transferPrice: 600000000,
        acquirePrice: 300000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 6,
        userFlags: {
          ...defaultUserFlags,
          nonBusinessLand: true,
        },
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 비사업용토지: 기본세율 + 10%p
    expect(assetResult.additionalRate).toBe(10);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-005: 자경농지 8년 이상 (100% 감면)', () => {
  it('8년 자경 농지 양도 → 양도세 100% 감면 (연 1억 한도)', () => {
    // 조세특례제한법 제69조
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-08-15',
          acquireDate: '2015-01-15', // 9년 보유
          transferPrice: 500000000,
          acquirePrice: 150000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 9,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'SELF_FARM_8Y',
            reliefName: '자경농지 8년 감면',
            reliefType: 'TAX',
            reliefRate: 100,
            reliefAmount: 100000000, // 연 1억 한도
            baseAmount: 100000000,
            legalBasis: '조세특례제한법 제69조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: true,
            isSelfFarmLand: true,
          },
        ],
      }
    );

    // Update asset ID to match relief
    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 8년 이상 자경: 감면 적용
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-006: 자경농지 8년 미만 (감면 없음)', () => {
  it('5년 자경 농지 양도 → 감면 없음', () => {
    const testCase = createLandTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2019-06-15', // 5년 보유
        transferPrice: 300000000,
        acquirePrice: 150000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 5,
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);

    // 8년 미만: 자경농지 감면 불가
    expect(result.mainResult.line11_taxRelief).toBe(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-007: 농지대토 (대체취득 100% 감면)', () => {
  it('농지 대토 → 양도세 100% 감면 (1억 한도)', () => {
    // 조세특례제한법 제70조
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-08-15',
          acquireDate: '2014-01-15', // 10년 보유
          transferPrice: 400000000,
          acquirePrice: 100000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 10,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'FARM_SUBSTITUTE',
            reliefName: '농지대토 감면',
            reliefType: 'TAX',
            reliefRate: 100,
            reliefAmount: 100000000,
            baseAmount: 100000000,
            legalBasis: '조세특례제한법 제70조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: true,
            isSelfFarmLand: true,
          },
        ],
      }
    );

    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 농지대토: 감면 적용
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-008: 공익사업 현금수용 (10% 감면)', () => {
  it('공익사업 현금 보상 → 양도세 10% 감면', () => {
    // 조세특례제한법 제77조
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-08-15',
          acquireDate: '2010-01-15',
          acquireCause: '2', // 수용
          transferPrice: 1000000000, // 10억 수용보상금
          acquirePrice: 300000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 14,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'PUBLIC_CASH',
            reliefName: '공익사업 현금보상 감면',
            reliefType: 'TAX',
            reliefRate: 10,
            reliefAmount: 50000000,
            baseAmount: 500000000,
            legalBasis: '조세특례제한법 제77조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: false,
            isSelfFarmLand: false,
          },
        ],
      }
    );

    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 현금수용: 10% 감면
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-009: 공익사업 채권수용 3년 (30% 감면)', () => {
  it('공익사업 3년 만기 채권 보상 → 양도세 30% 감면', () => {
    // 조세특례제한법 제77조
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-08-15',
          acquireDate: '2012-01-15',
          acquireCause: '2',
          transferPrice: 600000000,
          acquirePrice: 200000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 12,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'PUBLIC_BOND_3Y',
            reliefName: '공익사업 3년 채권 감면',
            reliefType: 'TAX',
            reliefRate: 30,
            reliefAmount: 90000000,
            baseAmount: 300000000,
            legalBasis: '조세특례제한법 제77조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: false,
            isSelfFarmLand: false,
          },
        ],
      }
    );

    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 3년 채권: 30% 감면
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-010: 공익사업 채권수용 5년 (40% 감면)', () => {
  it('공익사업 5년 만기 채권 보상 → 양도세 40% 감면', () => {
    // 조세특례제한법 제77조
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-08-15',
          acquireDate: '2008-01-15',
          acquireCause: '2',
          transferPrice: 900000000,
          acquirePrice: 250000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 16,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'PUBLIC_BOND_5Y',
            reliefName: '공익사업 5년 채권 감면',
            reliefType: 'TAX',
            reliefRate: 40,
            reliefAmount: 160000000,
            baseAmount: 400000000,
            legalBasis: '조세특례제한법 제77조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: false,
            isSelfFarmLand: false,
          },
        ],
      }
    );

    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 5년 채권: 40% 감면
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('L-011: 임야 (산림지) 감면', () => {
  it('산림경영 임야 양도 → 100% 감면 (조세특례제한법)', () => {
    // 조세특례제한법 제106조의2
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createLandTestCase(
      [
        {
          rateCode: '1-10',
          assetTypeCode: '1', // 임야도 토지 코드 사용
          transferDate: '2024-08-15',
          acquireDate: '2000-01-15', // 24년 보유
          transferPrice: 800000000,
          acquirePrice: 50000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          holdingYears: 24,
          userFlags: defaultUserFlags,
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'FOREST_MGMT',
            reliefName: '산림경영 감면',
            reliefType: 'TAX',
            reliefRate: 100,
            reliefAmount: 100000000,
            baseAmount: 100000000,
            legalBasis: '조세특례제한법 제106조의2',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: true,
            isSelfFarmLand: false,
          },
        ],
      }
    );

    testCase.bp1Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 산림경영 임야: 감면 적용
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);

    expect(result.errors).toHaveLength(0);
  });
});

describe('토지 장기보유특별공제 계산', () => {
  it('10년 보유 토지 → 장특공 20%', () => {
    // 소득세법 제95조 제2항, 시행령 제167조의3
    // 토지: 3년 6% + (보유연수-3) × 2%
    const testCase = createLandTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2014-03-15', // 10년 5개월 보유
        transferPrice: 1200000000, // 12억
        acquirePrice: 500000000,   // 5억
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 10,
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 10년: 6% + 7×2% = 20%
    expect(assetResult.ltDeductionRate).toBe(20);

    expect(result.errors).toHaveLength(0);
  });

  it('15년 보유 토지 → 장특공 30% (최대)', () => {
    // 토지 장특공 최대 30%
    const testCase = createLandTestCase([
      {
        rateCode: '1-10',
        assetTypeCode: '1',
        transferDate: '2024-08-15',
        acquireDate: '2008-01-15', // 16년 보유
        transferPrice: 1500000000,
        acquirePrice: 400000000,
        acquirePriceType: 'ACTUAL',
        ltDeductionCode: '02',
        holdingYears: 16,
        userFlags: defaultUserFlags,
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 15년 이상: 최대 30%
    expect(assetResult.ltDeductionRate).toBe(30);

    expect(result.errors).toHaveLength(0);
  });
});
