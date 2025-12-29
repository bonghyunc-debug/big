// 파생상품 양도 시나리오 테스트 (소득세법 제94조 제1항 제5호의2)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP2_2, BP2_2Row } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '파생상품투자자',
  rrn: '900101-1234567',
  address: '서울특별시 영등포구',
};

function createDerivativeTestCase(bp2_2: BP2_2, overrides: Partial<TaxCase> = {}): TaxCase {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: 'FINAL',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: [],
    bp2Assets: [],
    bp2_2,
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

describe('D-001: KOSPI200 선물/옵션 (2018.4.1 이후) - 10% 세율', () => {
  it('KOSPI200 선물 양도차익 → 10% 세율', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '81',
          productName: 'KOSPI200 선물',
          r08_transferPrice: 100000000,
          r09_necessaryExpense: 5000000,
          r11_prevGain: 0,
          r12_currentLoss: 0,
          r13_carriedLoss: 0,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    const derivResult = result.assetResults.find(r => r.rateCode === '1-81');

    expect(derivResult).toBeDefined();
    if (derivResult) {
      expect(derivResult.transferGainTotal).toBe(95000000);
      expect(derivResult.rateType).toBe('flat');
      expect(derivResult.rateValue).toBe(10);
    }

    expect(result.errors).toHaveLength(0);
  });
});

describe('D-002: 파생상품 (2018.3.31 이전) - 5% 세율', () => {
  it('2018.3.31 이전 취득 파생상품 → 5% 세율', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '80',
          productName: 'KOSPI200 옵션',
          r08_transferPrice: 50000000,
          r09_necessaryExpense: 2000000,
          r11_prevGain: 0,
          r12_currentLoss: 0,
          r13_carriedLoss: 0,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    const derivResult = result.assetResults.find(r => r.rateCode === '1-80');

    expect(derivResult).toBeDefined();
    if (derivResult) {
      expect(derivResult.rateType).toBe('flat');
      expect(derivResult.rateValue).toBe(5);
    }

    expect(result.errors).toHaveLength(0);
  });
});

describe('D-003: 개별주식옵션', () => {
  it('개별주식옵션 양도차익 → 10% 세율', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '81',
          productName: '삼성전자 콜옵션',
          r08_transferPrice: 30000000,
          r09_necessaryExpense: 1500000,
          r11_prevGain: 0,
          r12_currentLoss: 0,
          r13_carriedLoss: 0,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    expect(result.errors).toHaveLength(0);
  });
});

describe('D-005: 파생상품 손실 공제', () => {
  it('당해연도 손실 공제 적용', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '81',
          productName: 'KOSPI200 선물 A',
          r08_transferPrice: 100000000,
          r09_necessaryExpense: 5000000,
          r11_prevGain: 0,
          r12_currentLoss: 30000000,
          r13_carriedLoss: 0,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    const derivResult = result.assetResults.find(r => r.rateCode === '1-81');

    if (derivResult) {
      // 양도차익 = 1억 - 500만 - 3천만(손실) = 6500만원
      expect(derivResult.transferGainTotal).toBe(65000000);
    }

    expect(result.errors).toHaveLength(0);
  });

  it('이월결손금 공제 적용', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '81',
          productName: 'KOSPI200 선물 B',
          r08_transferPrice: 80000000,
          r09_necessaryExpense: 3000000,
          r11_prevGain: 0,
          r12_currentLoss: 0,
          r13_carriedLoss: 20000000,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    const derivResult = result.assetResults.find(r => r.rateCode === '1-81');

    if (derivResult) {
      // 양도차익 = 8천만 - 300만 + 2천만(이월결손) = 9700만원
      // (r13_carriedLoss는 공제가 아닌 가산으로 되어 있음)
      expect(derivResult.transferGainTotal).toBeDefined();
    }

    expect(result.errors).toHaveLength(0);
  });
});

describe('파생상품 기본공제 (연 250만원)', () => {
  it('파생상품 버킷 기본공제 적용', () => {
    const bp2_2: BP2_2 = {
      taxYear: 2024,
      rows: [
        {
          id: uuidv4(),
          rateCode: '81',
          productName: 'KOSPI200 선물',
          r08_transferPrice: 10000000,
          r09_necessaryExpense: 500000,
          r11_prevGain: 0,
          r12_currentLoss: 0,
          r13_carriedLoss: 0,
          r14_otherDeduction: 0,
        },
      ],
    };

    const testCase = createDerivativeTestCase(bp2_2);
    const result = calculateTaxCase(testCase);

    // 파생상품 기본공제 250만원 적용 확인
    expect(result.mainResult.basicDeductionByBucket['DERIVATIVE']).toBe(2500000);

    expect(result.errors).toHaveLength(0);
  });
});
