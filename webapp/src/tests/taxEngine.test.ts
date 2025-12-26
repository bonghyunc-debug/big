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
});
