// 계산 유틸리티 함수
import { differenceInDays, differenceInMonths, differenceInYears, parseISO } from 'date-fns';

/**
 * 원단위 반올림
 */
export function roundToWon(amount: number): number {
  return Math.round(amount);
}

/**
 * 보유기간 계산 (년 단위, 소수점 버림)
 * 소득세법 시행령 기준: 취득일~양도일
 */
export function calculateHoldingYears(acquireDate: string, transferDate: string): number {
  const acquire = parseISO(acquireDate);
  const transfer = parseISO(transferDate);
  return Math.max(0, differenceInYears(transfer, acquire));
}

/**
 * 보유기간 계산 (월 단위)
 */
export function calculateHoldingMonths(acquireDate: string, transferDate: string): number {
  const acquire = parseISO(acquireDate);
  const transfer = parseISO(transferDate);
  return Math.max(0, differenceInMonths(transfer, acquire));
}

/**
 * 보유기간 계산 (일 단위)
 */
export function calculateHoldingDays(acquireDate: string, transferDate: string): number {
  const acquire = parseISO(acquireDate);
  const transfer = parseISO(transferDate);
  return Math.max(0, differenceInDays(transfer, acquire));
}

/**
 * 단기보유 구분 (1년미만/1-2년/2년이상)
 */
export type ShortTermType = 'UNDER_1Y' | '1Y_TO_2Y' | 'OVER_2Y';

export function getShortTermType(acquireDate: string, transferDate: string): ShortTermType {
  const months = calculateHoldingMonths(acquireDate, transferDate);
  if (months < 12) return 'UNDER_1Y';
  if (months < 24) return '1Y_TO_2Y';
  return 'OVER_2Y';
}

/**
 * 고가주택 안분 비율 계산
 * (양도가액 - 12억) / 양도가액
 */
export function calculateHighValueRatio(transferPrice: number, threshold: number = 1200000000): number {
  if (transferPrice <= threshold) return 0;
  return (transferPrice - threshold) / transferPrice;
}

/**
 * 환산취득가액 계산
 * 양도가액 × (취득시 기준시가 합 / 양도시 기준시가 합)
 */
export function calculateConvertedAcquirePrice(
  transferPrice: number,
  stdValueAcquireBuilding: number,
  stdValueAcquireLand: number,
  stdValueTransferBuilding: number,
  stdValueTransferLand: number
): number {
  const acquireStdTotal = stdValueAcquireBuilding + stdValueAcquireLand;
  const transferStdTotal = stdValueTransferBuilding + stdValueTransferLand;

  if (transferStdTotal === 0) {
    throw new Error('양도시 기준시가 합계가 0입니다.');
  }

  return roundToWon(transferPrice * (acquireStdTotal / transferStdTotal));
}

/**
 * 부담부증여 증여재산 평가방법
 */
export type GiftValuationMethod =
  | 'MARKET_PRICE'           // 시가 (매매/감정/유사매매사례가액)
  | 'SUPPLEMENTARY_STANDARD' // 보충적 평가방법 (기준시가)
  | 'RENT_CONVERSION'        // 임대료 환산가액
  | 'COLLATERAL_DEBT';       // 담보채권액

/**
 * 부담부증여 평가방법별 취득가액 결정 (소득세법 시행령 제159조 제1항)
 *
 * 2023년 개정 반영:
 * - 시가 평가: 실지취득가액
 * - 보충적 평가방법: 취득 당시 기준시가
 * - 임대료 환산가액: 2020.2.11 이후 양도분 → 기준시가
 * - 담보채권액: 2023.2.28 이후 양도분 → 기준시가
 */
export function determineGiftWithDebtAcquireCost(
  valuationMethod: GiftValuationMethod,
  donorActualAcquireCost: number,
  donorStandardPriceAtAcquire: number,
  transferDate: string,
  giftDate?: string
): {
  acquireCost: number;
  basis: 'ACTUAL' | 'STANDARD';
  legalBasis: string;
} {
  const transferDateObj = new Date(transferDate);

  switch (valuationMethod) {
    case 'MARKET_PRICE':
      // 시가 평가: 항상 실지취득가액
      return {
        acquireCost: donorActualAcquireCost,
        basis: 'ACTUAL',
        legalBasis: '시행령 제159조 제1항 - 시가평가 시 실지취득가액',
      };

    case 'SUPPLEMENTARY_STANDARD':
      // 보충적 평가방법: 항상 기준시가
      return {
        acquireCost: donorStandardPriceAtAcquire,
        basis: 'STANDARD',
        legalBasis: '시행령 제159조 제1항 - 보충적평가 시 취득당시 기준시가',
      };

    case 'RENT_CONVERSION':
      // 임대료 환산가액: 2020.2.11 이후 양도분은 기준시가
      const rentConversionCutoff = new Date('2020-02-11');
      if (transferDateObj >= rentConversionCutoff) {
        return {
          acquireCost: donorStandardPriceAtAcquire,
          basis: 'STANDARD',
          legalBasis: '시행령 제159조 제1항 - 임대료환산가액(2020.2.11 이후) 기준시가',
        };
      }
      return {
        acquireCost: donorActualAcquireCost,
        basis: 'ACTUAL',
        legalBasis: '시행령 제159조 제1항 - 임대료환산가액(2020.2.10 이전) 실지취득가액',
      };

    case 'COLLATERAL_DEBT':
      // 담보채권액: 2023.2.28 이후 양도분은 기준시가
      const collateralCutoff = new Date('2023-02-28');
      if (transferDateObj >= collateralCutoff) {
        return {
          acquireCost: donorStandardPriceAtAcquire,
          basis: 'STANDARD',
          legalBasis: '시행령 제159조 제1항 - 담보채권액(2023.2.28 이후) 기준시가',
        };
      }
      return {
        acquireCost: donorActualAcquireCost,
        basis: 'ACTUAL',
        legalBasis: '시행령 제159조 제1항 - 담보채권액(2023.2.27 이전) 실지취득가액',
      };

    default:
      // 기본값: 실지취득가액
      return {
        acquireCost: donorActualAcquireCost,
        basis: 'ACTUAL',
        legalBasis: '시행령 제159조 제1항 - 기본 실지취득가액',
      };
  }
}

/**
 * 부담부증여 양도 해당 부분 계산
 * 시행령 제159조
 */
export function calculateGiftWithDebtPortion(
  assessedValue: number,
  debtAmount: number,
  donorAcquireCost: number
): {
  transferPricePortion: number;
  acquirePricePortion: number;
  ratio: number;
} {
  if (assessedValue === 0) {
    throw new Error('증여재산평가액이 0입니다.');
  }

  const ratio = debtAmount / assessedValue;

  return {
    transferPricePortion: roundToWon(assessedValue * ratio),
    acquirePricePortion: roundToWon(donorAcquireCost * ratio),
    ratio,
  };
}

/**
 * 가산세 감면 기간 구분
 */
export type ReductionPeriod =
  | 'WITHIN_1M'
  | 'WITHIN_3M'
  | 'WITHIN_6M'
  | 'WITHIN_1Y'
  | 'WITHIN_1Y6M'
  | 'WITHIN_2Y'
  | 'OVER_2Y';

export function getReductionPeriod(daysSinceDue: number): ReductionPeriod {
  if (daysSinceDue <= 30) return 'WITHIN_1M';
  if (daysSinceDue <= 90) return 'WITHIN_3M';
  if (daysSinceDue <= 180) return 'WITHIN_6M';
  if (daysSinceDue <= 365) return 'WITHIN_1Y';
  if (daysSinceDue <= 548) return 'WITHIN_1Y6M';
  if (daysSinceDue <= 730) return 'WITHIN_2Y';
  return 'OVER_2Y';
}

/**
 * 기한후신고 가산세 감면율
 */
export function getLateReportReductionRate(period: ReductionPeriod): number {
  const rates: Record<ReductionPeriod, number> = {
    'WITHIN_1M': 0.50,
    'WITHIN_3M': 0.30,
    'WITHIN_6M': 0.20,
    'WITHIN_1Y': 0.10,
    'WITHIN_1Y6M': 0.05,
    'WITHIN_2Y': 0.05,
    'OVER_2Y': 0,
  };
  return rates[period];
}

/**
 * 수정신고 가산세 감면율
 */
export function getAmendReportReductionRate(period: ReductionPeriod): number {
  const rates: Record<ReductionPeriod, number> = {
    'WITHIN_1M': 0.90,
    'WITHIN_3M': 0.75,
    'WITHIN_6M': 0.50,
    'WITHIN_1Y': 0.30,
    'WITHIN_1Y6M': 0.20,
    'WITHIN_2Y': 0.10,
    'OVER_2Y': 0,
  };
  return rates[period];
}

/**
 * 누진세율 계산 (소득세법 제55조)
 */
export interface TaxBracket {
  over: number;
  upTo: number | null;
  rate: number;
  deduction: number;
}

export function calculateProgressiveTax(taxBase: number, brackets: TaxBracket[]): number {
  if (taxBase <= 0) return 0;

  for (const bracket of brackets) {
    if (bracket.upTo === null || taxBase <= bracket.upTo) {
      return roundToWon(taxBase * (bracket.rate / 100) - bracket.deduction);
    }
  }

  // 마지막 구간
  const last = brackets[brackets.length - 1];
  return roundToWon(taxBase * (last.rate / 100) - last.deduction);
}

/**
 * 단일세율 계산
 */
export function calculateFlatTax(taxBase: number, rate: number): number {
  return roundToWon(taxBase * (rate / 100));
}

/**
 * 기본공제 버킷 결정
 */
export type DeductionBucket = 'DOMESTIC' | 'STOCK' | 'DERIVATIVE' | 'FOREIGN' | 'OTHER';

export function getDeductionBucket(assetTypeCode: string, domesticForeign?: string): DeductionBucket {
  // 부동산/권리
  if (['1', '2', '3', '4', '5', '6', '7', '24', '25', '26'].includes(assetTypeCode)) {
    return domesticForeign === '2' ? 'FOREIGN' : 'DOMESTIC';
  }

  // 주식
  if (['8', '23'].includes(assetTypeCode)) {
    return domesticForeign === '2' ? 'FOREIGN' : 'STOCK';
  }

  // 파생상품은 별도 처리
  if (assetTypeCode.startsWith('8')) {
    return 'DERIVATIVE';
  }

  // 기타
  return 'OTHER';
}

/**
 * 과세연도 추출
 */
export function getTaxYear(transferDate: string): number {
  return parseISO(transferDate).getFullYear();
}

/**
 * 금액 포맷 (천단위 콤마)
 */
export function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR');
}

/**
 * 주민등록번호 마스킹
 */
export function maskRRN(rrn: string): string {
  const cleaned = rrn.replace(/-/g, '');
  if (cleaned.length !== 13) return rrn;
  return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 7)}******`;
}
