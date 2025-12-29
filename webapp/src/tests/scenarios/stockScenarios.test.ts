// 주식 양도 시나리오 테스트 (소득세법 제94조, 제104조)
import { describe, it, expect } from 'vitest';
import { calculateTaxCase } from '../../engine/taxEngine';
import type { TaxCase, BP2Asset } from '../../schemas';
import { v4 as uuidv4 } from 'uuid';

const baseTaxpayer = {
  name: '주식투자자',
  rrn: '850101-1234567',
  address: '서울특별시 서초구',
};

function createStockTestCase(stocks: Omit<BP2Asset, 'id'>[], overrides: Partial<TaxCase> = {}): TaxCase {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportType: 'FINAL',
    taxYear: 2024,
    taxpayer: baseTaxpayer,
    bp1Assets: [],
    bp2Assets: stocks.map((s) => ({ ...s, id: uuidv4() })),
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

describe('S-001: 비상장주식 중소기업 (10% 세율)', () => {
  it('중소기업 비상장주식 양도 → 10% 세율', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '중소기업스타트업',
        securityId: '123-45-67890',
        domesticForeign: '1',
        stockTypeCode: '33',
        transferType: '1',
        acquireType: '1',
        quantity: 10000,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 500000000,
        acquirePrice: 100000000,
        necessaryExpense: 5000000,
        rateCode: '1-61',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-61');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(10);
    expect(assetResult.gainIncome).toBe(395000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-002: 비상장주식 대기업 (20% 세율)', () => {
  it('대기업 비상장주식 양도 → 20% 세율', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '대기업자회사',
        domesticForeign: '1',
        stockTypeCode: '31',
        transferType: '1',
        acquireType: '1',
        quantity: 5000,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 300000000,
        acquirePrice: 100000000,
        necessaryExpense: 2000000,
        rateCode: '1-62',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-62');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(20);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-003: 상장주식 대주주 (20%/25% 세율)', () => {
  it('대주주 상장주식 3억 이하 → 20% 세율', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '삼성전자',
        securityId: '005930',
        domesticForeign: '1',
        stockTypeCode: '34',
        transferType: '1',
        acquireType: '1',
        quantity: 1000,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 200000000,
        acquirePrice: 100000000,
        necessaryExpense: 1000000,
        rateCode: '1-63',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-63');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(20);
    expect(result.errors).toHaveLength(0);
  });

  it('대주주 상장주식 3억 초과 → 25% 세율', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '삼성전자',
        securityId: '005930',
        domesticForeign: '1',
        stockTypeCode: '34',
        transferType: '1',
        acquireType: '1',
        quantity: 10000,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 500000000,
        acquirePrice: 150000000,
        necessaryExpense: 2000000,
        rateCode: '1-73',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-73');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(25);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-004: 상장주식 소액주주 (비과세)', () => {
  it('소액주주 상장주식 장내 매도 → 비과세', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '삼성전자',
        securityId: '005930',
        domesticForeign: '1',
        stockTypeCode: '35',
        transferType: '1',
        acquireType: '1',
        quantity: 100,
        transferDate: '2024-08-15',
        acquireDate: '2022-01-15',
        transferPrice: 10000000,
        acquirePrice: 8000000,
        necessaryExpense: 50000,
        rateCode: '1-64',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-64');
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-005: 부동산과다법인주식 (기본세율+10%p)', () => {
  it('부동산과다법인 주식 양도 → 누진세율 + 10%p 가산', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '부동산투자법인',
        domesticForeign: '1',
        stockTypeCode: '31',
        transferType: '1',
        acquireType: '1',
        quantity: 10000,
        transferDate: '2024-08-15',
        acquireDate: '2018-01-15',
        transferPrice: 800000000,
        acquirePrice: 300000000,
        necessaryExpense: 5000000,
        rateCode: '1-71',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-71');
    expect(assetResult.additionalRate).toBe(10);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-006: 특정주식 (소득세법 제94조)', () => {
  it('부동산 비율 50% 이상 법인주식 → 특정주식 과세', () => {
    // 소득세법 제94조 제1항 제3호 나목
    // 부동산 등의 자산비율이 50% 이상인 법인의 주식
    const testCase = createStockTestCase([
      {
        issuerName: '부동산중심법인',
        domesticForeign: '1',
        stockTypeCode: '31', // 비상장주식
        transferType: '1',
        acquireType: '1',
        quantity: 10000,
        transferDate: '2024-08-15',
        acquireDate: '2018-01-15',
        transferPrice: 600000000,
        acquirePrice: 200000000,
        necessaryExpense: 3000000,
        rateCode: '1-70', // 특정주식
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    // 특정주식: 누진세율 적용
    expect(assetResult.rateCode).toBe('1-70');
    expect(assetResult.rateType).toBe('progressive');
    expect(result.errors).toHaveLength(0);
  });

  it('상장주식 지분 2% 이상 → 특정주식 과세 (과점주주)', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '상장법인',
        securityId: '012345',
        domesticForeign: '1',
        stockTypeCode: '34', // 상장주식
        transferType: '1',
        acquireType: '1',
        quantity: 50000,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 400000000,
        acquirePrice: 150000000,
        necessaryExpense: 2000000,
        rateCode: '1-70',
      },
    ]);

    const result = calculateTaxCase(testCase);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-007: 국외주식 (22% 세율)', () => {
  it('해외주식 양도 → 22% 세율', () => {
    const testCase = createStockTestCase([
      {
        issuerName: 'Apple Inc.',
        securityId: 'AAPL',
        domesticForeign: '2',
        stockTypeCode: '43',
        transferType: '1',
        acquireType: '1',
        quantity: 100,
        transferDate: '2024-08-15',
        acquireDate: '2020-01-15',
        transferPrice: 50000000,
        acquirePrice: 30000000,
        necessaryExpense: 500000,
        rateCode: '1-65',
      },
    ]);

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.rateCode).toBe('1-65');
    expect(assetResult.rateType).toBe('flat');
    expect(assetResult.rateValue).toBe(22);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-009: 주식 이월과세 (1년 내 양도)', () => {
  it('증여받은 주식 1년 내 양도 → 증여자 취득가액 적용 (2025년 시행)', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '가족기업',
        domesticForeign: '1',
        stockTypeCode: '33',
        transferType: '1',
        acquireType: '8',
        quantity: 5000,
        transferDate: '2025-08-15',
        acquireDate: '2025-03-15',
        transferPrice: 300000000,
        acquirePrice: 200000000,
        necessaryExpense: 1000000,
        rateCode: '1-61',
        carryoverTax: {
          enabled: true,
          giftDate: '2025-03-15',
          donorAcquireDate: '2018-01-01',
          donorAcquireCost: 50000000,
          giftTaxPaid: 20000000,
          giftTaxBase: 200000000,
          totalGiftTaxBase: 200000000,
          donorRelation: 'lineal',
          exclusionReason: 'NONE',
        },
      },
    ], {
      taxYear: 2025,
    });

    const result = calculateTaxCase(testCase);
    const assetResult = result.assetResults[0];

    expect(assetResult.effectiveAcquirePrice).toBe(50000000);
    expect(result.errors).toHaveLength(0);
  });
});

describe('S-008: 벤처기업주식 감면 (조세특례제한법 제14조)', () => {
  it('벤처기업 출자주식 3년 이상 보유 → 양도세 100% 감면', () => {
    // 조세특례제한법 제14조
    // 벤처기업에 직접 출자하여 취득한 주식을 3년 이상 보유 후 양도시 감면
    const reliefId = uuidv4();
    const assetId = uuidv4();

    const testCase = createStockTestCase(
      [
        {
          issuerName: '벤처스타트업',
          domesticForeign: '1',
          stockTypeCode: '33', // 중소기업 비상장
          transferType: '1',
          acquireType: '1',
          quantity: 5000,
          transferDate: '2024-08-15',
          acquireDate: '2020-01-15', // 4년 보유
          transferPrice: 300000000,
          acquirePrice: 50000000,
          necessaryExpense: 1000000,
          rateCode: '1-61',
        },
      ],
      {
        reliefs: [
          {
            id: reliefId,
            assetId: assetId,
            reliefCode: 'VENTURE_STOCK_3Y',
            reliefName: '벤처기업 출자주식 감면',
            reliefType: 'TAX',
            reliefRate: 100,
            reliefAmount: 20000000,
            baseAmount: 20000000,
            legalBasis: '조세특례제한법 제14조',
            prevYearReliefUsed: 0,
            ruralSpecialTaxExempt: false,
            isSelfFarmLand: false,
          },
        ],
      }
    );

    testCase.bp2Assets[0].id = assetId;

    const result = calculateTaxCase(testCase);

    // 벤처기업 주식 3년 이상 보유 감면 적용
    expect(result.mainResult.line11_taxRelief).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('벤처기업주식 3년 미만 보유 → 감면 미적용', () => {
    const testCase = createStockTestCase([
      {
        issuerName: '벤처스타트업',
        domesticForeign: '1',
        stockTypeCode: '33',
        transferType: '1',
        acquireType: '1',
        quantity: 3000,
        transferDate: '2024-08-15',
        acquireDate: '2022-06-15', // 2년 2개월 보유 (3년 미만)
        transferPrice: 150000000,
        acquirePrice: 30000000,
        necessaryExpense: 500000,
        rateCode: '1-61',
      },
    ]);

    const result = calculateTaxCase(testCase);

    // 3년 미만 보유: 감면 없음
    expect(result.mainResult.line11_taxRelief).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
