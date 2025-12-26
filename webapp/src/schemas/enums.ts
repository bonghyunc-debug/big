// 양도소득세 신고서 ENUM 정의
import { z } from 'zod';

// 신고구분
export const ReportTypeEnum = z.enum(['PRELIM', 'FINAL', 'AMEND', 'LATE']);
export type ReportType = z.infer<typeof ReportTypeEnum>;

export const ReportTypeLabels: Record<ReportType, string> = {
  PRELIM: '예정신고',
  FINAL: '확정신고',
  AMEND: '수정신고',
  LATE: '기한후신고',
};

// 자산종류코드
export const AssetTypeCodeEnum = z.enum([
  '1', '2', '3', '4', '5', '6', '7', '8',
  '14', '15', '16', '17', '23', '24', '25', '26'
]);
export type AssetTypeCode = z.infer<typeof AssetTypeCodeEnum>;

export const AssetTypeLabels: Record<AssetTypeCode, string> = {
  '1': '토지',
  '2': '주택',
  '3': '일반건물',
  '4': '기타건물',
  '5': '지상권',
  '6': '전세권 등',
  '7': '등기된 부동산임차권',
  '8': '특정주식',
  '14': '영업권',
  '15': '시설물이용권',
  '16': '이축권',
  '17': '신탁수익권',
  '23': '부동산과다보유법인주식',
  '24': '부동산을 취득할 수 있는 권리',
  '25': '조합원입주권',
  '26': '분양권',
};

// 세율구분코드
export const RateCategoryCodeEnum = z.string().regex(/^[12]-\d{2}$/);
export type RateCategoryCode = string;

// 취득가액종류
export const AcquirePriceTypeEnum = z.enum([
  'ACTUAL', 'COMPARABLE', 'APPRAISAL', 'CONVERTED', 'STANDARD', 'FOREIGN_GOV'
]);
export type AcquirePriceType = z.infer<typeof AcquirePriceTypeEnum>;

export const AcquirePriceTypeLabels: Record<AcquirePriceType, string> = {
  ACTUAL: '실지거래가액',
  COMPARABLE: '매매사례가액',
  APPRAISAL: '감정가액',
  CONVERTED: '환산취득가액',
  STANDARD: '기준시가',
  FOREIGN_GOV: '국외자산 해당정부평가액',
};

// 장기보유특별공제 코드
export const LtDeductionCodeEnum = z.enum(['01', '02', '03', '04', '05', '06']);
export type LtDeductionCode = z.infer<typeof LtDeductionCodeEnum>;

export const LtDeductionCodeLabels: Record<LtDeductionCode, string> = {
  '01': '1세대1주택',
  '02': '그 외',
  '03': '배제',
  '04': '장기일반민간임대주택(조특법97조의3)',
  '05': '장기임대주택(조특법97조의4)',
  '06': '지방미분양주택(조특법98조의2)',
};

// 주식 국내/국외 구분
export const StockDomesticForeignEnum = z.enum(['1', '2']);
export type StockDomesticForeign = z.infer<typeof StockDomesticForeignEnum>;

export const StockDomesticForeignLabels: Record<StockDomesticForeign, string> = {
  '1': '국내',
  '2': '국외',
};

// 주식 종류코드
export const StockTypeCodeEnum = z.enum(['31', '32', '33', '34', '35', '43', '71']);
export type StockTypeCode = z.infer<typeof StockTypeCodeEnum>;

export const StockTypeCodeLabels: Record<StockTypeCode, string> = {
  '31': '비상장주식등(주권 등 비상장법인)',
  '32': '비상장주식등(그 밖의 법인)',
  '33': '비상장주식등(중소기업)',
  '34': '상장주식(대주주 등)',
  '35': '상장주식(소액주주)',
  '43': '국외주식(세율 20% 등)',
  '71': '국외현지법인 주식(세율 20% 등)',
};

// 양도/취득유형코드
export const TransferAcquireTypeEnum = z.enum([
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
]);
export type TransferAcquireType = z.infer<typeof TransferAcquireTypeEnum>;

export const TransferAcquireTypeLabels: Record<TransferAcquireType, string> = {
  '1': '매매',
  '2': '수용',
  '3': '협의매수',
  '4': '교환',
  '5': '공매',
  '6': '경매',
  '7': '상속',
  '8': '증여',
  '9': '신축',
  '10': '출자/기타',
};

// 파생상품 세율구분코드
export const DerivativeRateCodeEnum = z.enum(['80', '81']);
export type DerivativeRateCode = z.infer<typeof DerivativeRateCodeEnum>;

export const DerivativeRateCodeLabels: Record<DerivativeRateCode, string> = {
  '80': '파생상품(\'18.3.31. 이전) 5%',
  '81': '파생상품(\'18.4.1. 이후) 10%',
};

// 증빙종류코드
export const EvidenceTypeCodeEnum = z.enum(['01', '02', '03', '04', '99']);
export type EvidenceTypeCode = z.infer<typeof EvidenceTypeCodeEnum>;

export const EvidenceTypeCodeLabels: Record<EvidenceTypeCode, string> = {
  '01': '세금계산서',
  '02': '계산서',
  '03': '신용카드',
  '04': '현금영수증',
  '99': '기타/미제출',
};

// 과세이연
export const TaxDeferralApplyEnum = z.enum(['Y', 'N']);
export type TaxDeferralApply = z.infer<typeof TaxDeferralApplyEnum>;

// 자산 대분류 (버킷용)
export const AssetCategoryEnum = z.enum([
  'REAL_ESTATE',    // 부동산
  'STOCK',          // 주식
  'DERIVATIVE',     // 파생상품
  'FOREIGN',        // 국외자산
  'OTHER'           // 기타자산
]);
export type AssetCategory = z.infer<typeof AssetCategoryEnum>;

// 자산종류코드 -> 대분류 매핑
export function getAssetCategory(assetTypeCode: AssetTypeCode): AssetCategory {
  switch (assetTypeCode) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '24':
    case '25':
    case '26':
      return 'REAL_ESTATE';
    case '8':
    case '23':
      return 'STOCK';
    case '14':
    case '15':
    case '16':
      return 'OTHER';
    case '17':
      return 'OTHER';
    default:
      return 'OTHER';
  }
}
