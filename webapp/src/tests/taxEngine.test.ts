// 양도소득세 계산 엔진 테스트
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../engine/taxEngine';
import {
  calculateHoldingYears,
  calculateHighValueRatio,
  calculateConvertedAcquirePrice,
  calculateProgressiveTax,
  calculateFlatTax,
  roundToWon,
  getShortTermType,
} from '../engine/utils';
import type { TaxCase } from '../schemas';

describe('유틸리티 함수', () => {
  describe('roundToWon', () => {
    it('원단위 반올림', () => {
      expect(roundToWon(100.4)).toBe(100);
      expect(roundToWon(100.5)).toBe(101);
      expect(roundToWon(100.6)).toBe(101);
    });
  });

  describe('calculateHoldingYears', () => {
    it('보유기간 계산 (년)', () => {
      expect(calculateHoldingYears('2020-01-01', '2024-01-01')).toBe(4);
      expect(calculateHoldingYears('2020-06-15', '2024-06-14')).toBe(3);
      expect(calculateHoldingYears('2020-06-15', '2024-06-15')).toBe(4);
    });
  });

  describe('getShortTermType', () => {
    it('단기보유 구분', () => {
      expect(getShortTermType('2024-01-01', '2024-06-01')).toBe('UNDER_1Y');
      expect(getShortTermType('2023-01-01', '2024-06-01')).toBe('1Y_TO_2Y');
      expect(getShortTermType('2022-01-01', '2024-06-01')).toBe('OVER_2Y');
    });
  });

  describe('calculateHighValueRatio', () => {
    it('고가주택 안분 비율', () => {
      expect(calculateHighValueRatio(1200000000)).toBe(0);
      expect(calculateHighValueRatio(1800000000)).toBeCloseTo(0.3333, 4);
      expect(calculateHighValueRatio(2400000000)).toBe(0.5);
    });
  });

  describe('calculateConvertedAcquirePrice', () => {
    it('환산취득가액 계산', () => {
      // 양도가액 5억, 취득시 기준시가 2억, 양도시 기준시가 4억
      // 환산취득가액 = 5억 × (2억/4억) = 2.5억
      const result = calculateConvertedAcquirePrice(
        500000000,
        100000000, // 취득시 건물
        100000000, // 취득시 토지
        200000000, // 양도시 건물
        200000000  // 양도시 토지
      );
      expect(result).toBe(250000000);
    });

    it('양도시 기준시가 0이면 에러', () => {
      expect(() =>
        calculateConvertedAcquirePrice(500000000, 100000000, 100000000, 0, 0)
      ).toThrow();
    });
  });

  describe('calculateProgressiveTax', () => {
    it('누진세율 계산', () => {
      const brackets = [
        { over: 0, upTo: 14000000, rate: 6, deduction: 0 },
        { over: 14000000, upTo: 50000000, rate: 15, deduction: 1260000 },
        { over: 50000000, upTo: 88000000, rate: 24, deduction: 5760000 },
        { over: 88000000, upTo: null, rate: 35, deduction: 15440000 },
      ];

      // 1천만원: 6% = 60만원
      expect(calculateProgressiveTax(10000000, brackets)).toBe(600000);

      // 3천만원: 15% - 126만원 = 324만원
      expect(calculateProgressiveTax(30000000, brackets)).toBe(3240000);

      // 7천만원: 24% - 576만원 = 1104만원
      expect(calculateProgressiveTax(70000000, brackets)).toBe(11040000);

      // 1억원: 35% - 1544만원 = 1956만원
      expect(calculateProgressiveTax(100000000, brackets)).toBe(19560000);
    });
  });

  describe('calculateFlatTax', () => {
    it('단일세율 계산', () => {
      expect(calculateFlatTax(100000000, 10)).toBe(10000000);
      expect(calculateFlatTax(100000000, 20)).toBe(20000000);
      expect(calculateFlatTax(100000000, 70)).toBe(70000000);
    });
  });
});

describe('계산 엔진', () => {
  it('토지 일반세율 + 장특공 케이스', () => {
    const testCase: TaxCase = {
      id: 'test-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '홍길동',
        rrn: '800101-1234567',
        address: '서울시 강남구',
      },
      bp1Assets: [
        {
          id: 'asset-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2009-06-15',
          transferPrice: 500000000,
          acquirePrice: 200000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
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
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 양도차익 = 5억 - 2억 = 3억
    expect(result.assetResults[0].transferGainTotal).toBe(300000000);

    // 15년 보유 → 장특공 30%
    expect(result.assetResults[0].ltDeductionRate).toBe(30);

    // 양도소득금액 = 3억 - 9천만(장특공) = 2.1억
    expect(result.assetResults[0].gainIncome).toBe(210000000);

    // 기본공제 250만원
    expect(result.mainResult.line07_basicDeduction).toBe(2500000);

    // 전자신고세액공제 2만원
    expect(result.mainResult.line15_eFilingCredit).toBe(20000);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('미등기 양도 케이스 - 70% 세율, 기본공제 제외', () => {
    const testCase: TaxCase = {
      id: 'test-002',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '이영희',
        rrn: '900101-2234567',
        address: '서울시 마포구',
      },
      bp1Assets: [
        {
          id: 'asset-002',
          rateCode: '1-35',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2023-01-15',
          transferPrice: 200000000,
          acquirePrice: 100000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '03',
          userFlags: {
            unregistered: true,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: false,
            highValueHousing: false,
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 양도차익 = 2억 - 1억 = 1억
    expect(result.assetResults[0].transferGainTotal).toBe(100000000);

    // 미등기 → 장특공 배제
    expect(result.assetResults[0].ltDeductionRate).toBe(0);

    // 미등기 → 기본공제 제외
    expect(result.mainResult.line07_basicDeduction).toBe(0);

    // 70% 세율 적용
    expect(result.assetResults[0].rateType).toBe('flat');
    expect(result.assetResults[0].rateValue).toBe(70);
  });

  it('주식 양도 케이스 - 중소기업 10%', () => {
    const testCase: TaxCase = {
      id: 'test-003',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'FINAL',
      taxYear: 2024,
      taxpayer: {
        name: '박민수',
        rrn: '850315-1234567',
        address: '경기도 성남시',
      },
      bp1Assets: [],
      bp2Assets: [
        {
          id: 'stock-001',
          issuerName: '테크스타트업',
          domesticForeign: '1',
          stockTypeCode: '33',
          transferType: '1',
          acquireType: '1',
          quantity: 10000,
          transferDate: '2024-08-15',
          transferPrice: 500000000,
          acquirePrice: 100000000,
          necessaryExpense: 5000000,
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 양도소득금액 = 5억 - 1억 - 500만 = 3.95억
    expect(result.assetResults[0].gainIncome).toBe(395000000);

    // 중소기업주식 → 10% 세율
    expect(result.assetResults[0].rateCode).toBe('1-61');

    // 주식 버킷 기본공제 250만원
    expect(result.mainResult.line07_basicDeduction).toBe(2500000);
  });

  it('감면 + 농어촌특별세 케이스 - 공익사업수용 10%', () => {
    const testCase: TaxCase = {
      id: 'test-relief-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '김철수',
        rrn: '750101-1234567',
        address: '경기도 화성시',
      },
      bp1Assets: [
        {
          id: 'asset-relief-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2014-06-15',
          transferPrice: 500000000,
          acquirePrice: 200000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
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
      ],
      bp2Assets: [],
      reliefs: [
        {
          id: 'relief-001',
          assetId: 'asset-relief-001',
          reliefCode: 'PUBLIC_CASH',
          reliefName: '공익사업수용 감면 (현금보상)',
          reliefType: 'TAX',
          reliefRate: 10,
          reliefAmount: 5000000, // 감면액 500만원
          baseAmount: 50000000,  // 산출세액 기준
          legalBasis: '조세특례제한법 제77조',
          limitGroup: 'PUBLIC',
          prevYearReliefUsed: 0,
          ruralSpecialTaxExempt: false,
          isSelfFarmLand: false,
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 감면세액 500만원
    expect(result.mainResult.line11_taxRelief).toBe(5000000);

    // 농특세 과세 대상 (공익사업수용은 농특세 과세)
    expect(result.mainResult.ruralSpecialTax.taxableReliefAmount).toBe(5000000);
    expect(result.mainResult.ruralSpecialTax.exemptReliefAmount).toBe(0);

    // 농특세 = 500만원 × 20% = 100만원
    expect(result.mainResult.ruralSpecialTax.taxRate).toBe(20);
    expect(result.mainResult.ruralSpecialTax.taxAmount).toBe(1000000);

    // 총 납부세액 = 양도소득세 + 농특세
    expect(result.mainResult.totalTaxDue).toBe(
      result.mainResult.line18_taxDue + result.mainResult.ruralSpecialTax.taxAmount
    );

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('자경농지 감면 - 농특세 비과세 케이스', () => {
    const testCase: TaxCase = {
      id: 'test-relief-002',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '박농부',
        rrn: '650101-1234567',
        address: '전라남도 나주시',
      },
      bp1Assets: [
        {
          id: 'asset-farm-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2010-06-15',
          transferPrice: 300000000,
          acquirePrice: 100000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
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
      ],
      bp2Assets: [],
      reliefs: [
        {
          id: 'relief-farm-001',
          assetId: 'asset-farm-001',
          reliefCode: 'SELF_FARM_8Y',
          reliefName: '8년 자경농지 감면',
          reliefType: 'TAX',
          reliefRate: 100,
          reliefAmount: 30000000, // 감면액 3천만원
          baseAmount: 30000000,
          legalBasis: '조세특례제한법 제69조',
          limitGroup: 'FARM',
          prevYearReliefUsed: 0,
          ruralSpecialTaxExempt: true, // 자경농지는 농특세 비과세
          isSelfFarmLand: true,
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 감면세액 3천만원
    expect(result.mainResult.line11_taxRelief).toBe(30000000);

    // 자경농지는 농특세 비과세
    expect(result.mainResult.ruralSpecialTax.exemptReliefAmount).toBe(30000000);
    expect(result.mainResult.ruralSpecialTax.taxableReliefAmount).toBe(0);
    expect(result.mainResult.ruralSpecialTax.taxAmount).toBe(0);

    // 농특세 상세 내역 확인
    expect(result.mainResult.ruralSpecialTax.details).toHaveLength(1);
    expect(result.mainResult.ruralSpecialTax.details[0].isExempt).toBe(true);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('감면 종합한도 적용 케이스 - 연 1억 초과', () => {
    const testCase: TaxCase = {
      id: 'test-relief-limit-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '최부농',
        rrn: '600101-1234567',
        address: '충청남도 공주시',
      },
      bp1Assets: [
        {
          id: 'asset-limit-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2005-06-15',
          transferPrice: 2000000000, // 20억
          acquirePrice: 500000000,   // 5억
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
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
      ],
      bp2Assets: [],
      reliefs: [
        {
          id: 'relief-limit-001',
          assetId: 'asset-limit-001',
          reliefCode: 'SELF_FARM_8Y',
          reliefName: '8년 자경농지 감면',
          reliefType: 'TAX',
          reliefRate: 100,
          reliefAmount: 150000000, // 감면액 1.5억 (한도 초과)
          baseAmount: 150000000,
          legalBasis: '조세특례제한법 제69조',
          limitGroup: 'FARM',
          prevYearReliefUsed: 0,
          ruralSpecialTaxExempt: true,
          isSelfFarmLand: true,
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);

    // 감면 한도 적용 확인
    expect(result.mainResult.reliefLimitResult.requestedAmount).toBe(150000000);
    expect(result.mainResult.reliefLimitResult.annualLimit).toBe(100000000);
    expect(result.mainResult.reliefLimitResult.exceededAmount).toBe(50000000);
    expect(result.mainResult.reliefLimitResult.limitedAmount).toBe(100000000);

    // 한도 적용 후 감면세액 = 1억원
    expect(result.mainResult.line11_taxRelief).toBe(100000000);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });
});

// 이월과세 테스트 (소득세법 제97조의2)
describe('이월과세 (소득세법 제97조의2)', () => {
  it('부동산 이월과세 - 10년 이내 양도 (2023년 이후 증여)', () => {
    const testCase: TaxCase = {
      id: 'test-carryover-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '이월과세',
        rrn: '700101-1234567',
        address: '서울특별시 강남구',
      },
      bp1Assets: [
        {
          id: 'asset-carryover-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2023-06-15', // 증여받은 날
          transferPrice: 500000000, // 5억
          acquirePrice: 400000000,  // 증여 시 평가액 (사용 안 함)
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          userFlags: {
            unregistered: false,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: false,
            highValueHousing: false,
          },
          carryoverTax: {
            enabled: true,
            giftDate: '2023-06-15',
            donorAcquireDate: '2010-01-01', // 증여자 취득일
            donorAcquireCost: 100000000, // 증여자 취득가액 1억
            giftTaxPaid: 50000000, // 증여세 5천만원
            giftTaxBase: 300000000,
            totalGiftTaxBase: 300000000,
            donorRelation: 'spouse',
            exclusionReason: 'NONE',
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 유효 취득가액 = 증여자 취득가액 1억
    expect(assetResult.effectiveAcquirePrice).toBe(100000000);

    // 양도차익 = 5억 - 1억 = 4억
    // 증여세 상당액은 양도차익(4억) 한도로 산입되므로 5천만원 전액 산입
    // 최종 양도차익 = 4억 - 5천만원 = 3.5억
    expect(assetResult.transferGainTotal).toBe(350000000);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('이월과세 증여세 상당액 한도 적용 (양도차익 초과)', () => {
    const testCase: TaxCase = {
      id: 'test-carryover-limit-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '한도초과',
        rrn: '750101-1234567',
        address: '서울특별시 서초구',
      },
      bp1Assets: [
        {
          id: 'asset-carryover-limit-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2023-06-15',
          transferPrice: 150000000, // 1.5억
          acquirePrice: 140000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          userFlags: {
            unregistered: false,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: false,
            highValueHousing: false,
          },
          carryoverTax: {
            enabled: true,
            giftDate: '2023-06-15',
            donorAcquireDate: '2015-01-01',
            donorAcquireCost: 100000000, // 증여자 취득가액 1억
            giftTaxPaid: 80000000, // 증여세 8천만원 (양도차익 5천만원 초과)
            giftTaxBase: 0,
            totalGiftTaxBase: 0,
            donorRelation: 'lineal',
            exclusionReason: 'NONE',
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 양도차익(증여세 적용 전) = 1.5억 - 1억 = 5천만원
    // 증여세 8천만원 > 양도차익 5천만원 → 한도로 5천만원만 산입
    // 최종 양도차익 = 5천만원 - 5천만원 = 0
    expect(assetResult.transferGainTotal).toBe(0);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('이월과세 기간 초과 - 미적용', () => {
    const testCase: TaxCase = {
      id: 'test-carryover-period-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '기간초과',
        rrn: '800101-1234567',
        address: '서울특별시 마포구',
      },
      bp1Assets: [
        {
          id: 'asset-period-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2012-06-15', // 증여받은 날 (12년 전)
          transferPrice: 500000000,
          acquirePrice: 300000000, // 증여 시 평가액
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02',
          userFlags: {
            unregistered: false,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: false,
            highValueHousing: false,
          },
          carryoverTax: {
            enabled: true,
            giftDate: '2012-06-15', // 12년 전 증여 (5년 초과)
            donorAcquireDate: '2005-01-01',
            donorAcquireCost: 100000000,
            giftTaxPaid: 50000000,
            giftTaxBase: 0,
            totalGiftTaxBase: 0,
            donorRelation: 'spouse',
            exclusionReason: 'NONE',
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 2012년 증여(5년 기간)는 2017년에 만료 → 2024년 양도 시 이월과세 미적용
    // 취득가액 = 증여 시 평가액 3억 (증여자 취득가액 아님)
    expect(assetResult.effectiveAcquirePrice).toBe(300000000);

    // 양도차익 = 5억 - 3억 = 2억
    expect(assetResult.transferGainTotal).toBe(200000000);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('이월과세 적용배제 - 1세대 1주택 비과세', () => {
    const testCase: TaxCase = {
      id: 'test-carryover-exclusion-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '비과세',
        rrn: '850101-1234567',
        address: '서울특별시 강서구',
      },
      bp1Assets: [
        {
          id: 'asset-exclusion-001',
          rateCode: '1-52',
          assetTypeCode: '7', // 주택
          transferDate: '2024-06-15',
          acquireDate: '2023-06-15',
          transferPrice: 900000000, // 9억 (12억 이하 비과세)
          acquirePrice: 700000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '01',
          holdingYears: 3,
          residenceYears: 3,
          userFlags: {
            unregistered: false,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: true, // 1세대 1주택 비과세
            highValueHousing: false,
          },
          carryoverTax: {
            enabled: true,
            giftDate: '2023-06-15',
            donorAcquireDate: '2020-01-01',
            donorAcquireCost: 500000000,
            giftTaxPaid: 30000000,
            giftTaxBase: 0,
            totalGiftTaxBase: 0,
            donorRelation: 'spouse',
            exclusionReason: 'NONE', // 자동으로 배제됨
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 1세대 1주택 비과세 시 이월과세 자동 배제
    // 취득가액 = 증여 시 가액 7억 (증여자 취득가액 아님)
    expect(assetResult.effectiveAcquirePrice).toBe(700000000);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });

  it('이월과세 보유기간 기산일 - 증여자 취득일 적용', () => {
    const testCase: TaxCase = {
      id: 'test-carryover-holding-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportType: 'PRELIM',
      taxYear: 2024,
      taxpayer: {
        name: '보유기간',
        rrn: '900101-1234567',
        address: '경기도 성남시',
      },
      bp1Assets: [
        {
          id: 'asset-holding-001',
          rateCode: '1-10',
          assetTypeCode: '1',
          transferDate: '2024-06-15',
          acquireDate: '2023-01-01', // 증여받은 날 (1.5년)
          transferPrice: 500000000,
          acquirePrice: 400000000,
          acquirePriceType: 'ACTUAL',
          ltDeductionCode: '02', // 일반 장특공
          userFlags: {
            unregistered: false,
            nonBusinessLand: false,
            multiHomeSurtax: false,
            multiHomeCount: 0,
            adjustedArea: false,
            oneHouseExemption: false,
            highValueHousing: false,
          },
          carryoverTax: {
            enabled: true,
            giftDate: '2023-01-01',
            donorAcquireDate: '2010-01-01', // 증여자 취득일 (14년)
            donorAcquireCost: 100000000,
            giftTaxPaid: 0,
            giftTaxBase: 0,
            totalGiftTaxBase: 0,
            donorRelation: 'lineal',
            exclusionReason: 'NONE',
          },
        },
      ],
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
    };

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 이월과세 적용 시 보유기간 = 증여자 취득일(2010)부터 양도일(2024)까지 = 14년
    // 장기보유특별공제율 = 14년 × 2% = 28%
    expect(assetResult.ltDeductionRate).toBe(28);

    // 오류 없음
    expect(result.errors).toHaveLength(0);
  });
});
