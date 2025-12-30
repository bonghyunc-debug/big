// 양도소득세 신고서 폼 스키마 정의
import { z } from 'zod';
import {
  ReportTypeEnum,
  AssetTypeCodeEnum,
  AcquirePriceTypeEnum,
  LtDeductionCodeEnum,
  StockDomesticForeignEnum,
  StockTypeCodeEnum,
  TransferAcquireTypeEnum,
  DerivativeRateCodeEnum,
  EvidenceTypeCodeEnum,
  TaxDeferralApplyEnum,
} from './enums';

// 날짜 문자열 스키마 (YYYY-MM-DD)
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// 원화 금액 (정수, 원단위)
const KRWAmount = z.number().int();

// 신고인 정보
export const TaxpayerSchema = z.object({
  name: z.string().min(1, '성명을 입력하세요'),
  rrn: z.string().regex(/^\d{6}-?\d{7}$/, '주민등록번호 형식이 올바르지 않습니다'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().min(1, '주소를 입력하세요'),
});
export type Taxpayer = z.infer<typeof TaxpayerSchema>;

// 부표3 필요경비 항목
export const BP3RowSchema = z.object({
  code: z.string(),
  label: z.string(),
  amount: KRWAmount.default(0),
  evidenceType: EvidenceTypeCodeEnum.optional(),
  note: z.string().optional(),
});
export type BP3Row = z.infer<typeof BP3RowSchema>;

// 부표3 (취득가액/필요경비 명세)
export const BP3Schema = z.object({
  // 취득가액 항목
  acquireCosts: z.object({
    r111_purchasePrice: KRWAmount.default(0),  // 매입가액
    r112_acquisitionTax: KRWAmount.default(0), // 취득세
    r113_registrationTax: KRWAmount.default(0), // 등록세
    r114_lawyerFee: KRWAmount.default(0),      // 법무사비용
    r115_brokerFee: KRWAmount.default(0),      // 취득중개수수료
    r116_other: KRWAmount.default(0),          // 기타
  }),
  // 기타 필요경비 항목
  expenses: z.object({
    r210_capitalExpense: KRWAmount.default(0),  // 자본적지출액
    r220_transferExpense: KRWAmount.default(0), // 양도비(중개수수료 등)
    r250_filingFee: KRWAmount.default(0),       // 양도소득세 신고서 작성비용
    r260_lawyerFee: KRWAmount.default(0),       // 변호사비용
    r270_notaryFee: KRWAmount.default(0),       // 공증수수료
    r280_stampDuty: KRWAmount.default(0),       // 인지대
    r290_other: KRWAmount.default(0),           // 기타
  }),
  rows: z.array(BP3RowSchema).optional(),
});
export type BP3 = z.infer<typeof BP3Schema>;

// 부표1 자산 (부동산/권리)
export const BP1AssetSchema = z.object({
  id: z.string().uuid(),
  // 기본정보
  rateCode: z.string(),                    // ① 세율구분코드
  assetTypeCode: AssetTypeCodeEnum,        // ③ 자산종류코드
  transferDate: DateString,                // ④ 양도일
  acquireDate: DateString,                 // ⑤ 취득일
  transferCause: TransferAcquireTypeEnum.optional(), // 양도원인
  acquireCause: TransferAcquireTypeEnum.optional(),  // 취득원인

  // 상속 정보 (취득원인이 상속인 경우)
  inheritanceInfo: z.object({
    enabled: z.boolean().default(false),
    inheritanceDate: DateString.optional(),           // 상속개시일 (피상속인 사망일)
    decedentAcquireDate: DateString.optional(),       // 피상속인 취득일
    decedentAcquireCost: KRWAmount.default(0),        // 피상속인 취득가액
    decedentAcquireCause: TransferAcquireTypeEnum.optional(), // 피상속인 취득원인
    inheritanceTaxValue: KRWAmount.default(0),        // 상속세 평가액
    sameHousehold: z.boolean().default(false),        // 동일세대 여부 (1세대1주택 비과세용)
    decedentHoldingYears: z.number().int().min(0).default(0),   // 피상속인 보유기간(년)
    decedentResidenceYears: z.number().int().min(0).default(0), // 피상속인 거주기간(년)
    businessSuccession: z.boolean().default(false),   // 가업상속공제 적용 여부
  }).optional(),

  // 원천취득정보 (연쇄증여/상속 추적용)
  originalAcquisition: z.object({
    enabled: z.boolean().default(false),
    originalAcquireDate: DateString.optional(),       // 최초 취득일
    originalAcquireCost: KRWAmount.default(0),        // 최초 취득가액
    originalAcquireCause: TransferAcquireTypeEnum.optional(), // 최초 취득원인
    chainHistory: z.array(z.object({
      date: DateString,
      cause: TransferAcquireTypeEnum,
      value: KRWAmount,
    })).optional(),
  }).optional(),

  // 조정대상지역 정보 (1세대1주택 거주요건용)
  adjustedAreaInfo: z.object({
    acquiredInAdjustedArea: z.boolean().default(false),  // 취득 당시 조정대상지역 여부
    currentlyAdjustedArea: z.boolean().default(false),   // 현재 조정대상지역 여부
    adjustedAreaAcquireDate: DateString.optional(),      // 조정대상지역 지정 후 취득일
  }).optional(),

  // 소재지/상세
  location: z.string().optional(),         // 소재지
  area: z.number().optional(),             // 면적(㎡)

  // 금액
  transferPrice: KRWAmount,                // ⑪ 양도가액
  acquirePrice: KRWAmount,                 // ⑫ 취득가액
  acquirePriceType: AcquirePriceTypeEnum,  // 취득가액종류

  // 기준시가 (환산취득가액용)
  stdValueTransferBuilding: KRWAmount.optional(), // ㉒ 양도시기준시가-건물
  stdValueTransferLand: KRWAmount.optional(),     // ㉓ 양도시기준시가-토지
  stdValueAcquireBuilding: KRWAmount.optional(),  // ㉔ 취득시기준시가-건물
  stdValueAcquireLand: KRWAmount.optional(),      // ㉕ 취득시기준시가-토지

  // 장기보유특별공제
  ltDeductionCode: LtDeductionCodeEnum,    // ⑯ 장특공 코드
  holdingYears: z.number().int().min(0).optional(),    // 보유기간(년)
  residenceYears: z.number().int().min(0).optional(),  // 거주기간(년)

  // 부표3 연계
  bp3: BP3Schema.optional(),

  // 사용자 판정 플래그
  userFlags: z.object({
    unregistered: z.boolean().default(false),         // 미등기
    nonBusinessLand: z.boolean().default(false),      // 비사업용토지
    multiHomeSurtax: z.boolean().default(false),      // 다주택중과
    multiHomeCount: z.number().int().min(0).default(0), // 보유주택수
    adjustedArea: z.boolean().default(false),         // 조정대상지역
    oneHouseExemption: z.boolean().default(false),    // 1세대1주택 비과세
    highValueHousing: z.boolean().default(false),     // 고가주택(12억초과)
  }).default({
    unregistered: false,
    nonBusinessLand: false,
    multiHomeSurtax: false,
    multiHomeCount: 0,
    adjustedArea: false,
    oneHouseExemption: false,
    highValueHousing: false,
  }),

  // 1세대1주택 비과세 상세 정보 (소득세법 시행령 제154조)
  oneHouseExemptionDetail: z.object({
    enabled: z.boolean().default(false),
    // 보유/거주기간
    actualHoldingYears: z.number().min(0).default(0),   // 실제 보유기간(년)
    actualResidenceYears: z.number().min(0).default(0), // 실제 거주기간(년)
    // 상속 통산 (동일세대)
    inheritedHoldingYears: z.number().min(0).default(0),  // 피상속인 보유기간 통산(년)
    inheritedResidenceYears: z.number().min(0).default(0), // 피상속인 거주기간 통산(년)
    // 보유/거주요건 면제 사유
    holdingExemptReason: z.enum([
      'NONE',
      'OVERSEAS_EMIGRATION',      // 해외이주
      'OVERSEAS_WORK_STUDY',      // 해외 취학/근무
      'RENTAL_HOUSING_RESIDENCE', // 건설임대주택 5년 거주
    ]).default('NONE'),
    residenceExemptReason: z.enum([
      'NONE',
      'WORK_STUDY_ILLNESS',         // 취학/근무/질병 사유
      'PRE_ADJUSTED_AREA_CONTRACT', // 조정지역 고시 전 계약
    ]).default('NONE'),
    // 일시적 2주택 등 예외 사유
    temporaryExemptReason: z.enum([
      'NONE',
      'TEMPORARY_2HOUSE',    // 일시적 2주택
      'INHERITED_HOUSE',     // 상속주택
      'MARRIAGE_MERGE',      // 혼인합가
      'ELDERLY_CARE',        // 동거봉양
      'RURAL_RELOCATION',    // 귀농
    ]).default('NONE'),
  }).optional(),

  // 부담부증여 정보 (소득세법 시행령 제159조)
  giftWithDebt: z.object({
    enabled: z.boolean().default(false),
    assessedValue: KRWAmount.default(0),     // 증여재산평가액 (상증법 평가액)
    debtAmount: KRWAmount.default(0),        // 인수채무액

    // 증여재산 평가방법 (시행령 제159조 제1항, 2023년 개정)
    // 평가방법에 따라 취득가액 산정 기준이 달라짐
    valuationMethod: z.enum([
      'MARKET_PRICE',           // 시가 (매매/감정/유사매매사례가액) → 실지취득가액 적용
      'SUPPLEMENTARY_STANDARD', // 보충적 평가방법 (기준시가) → 취득 당시 기준시가 적용
      'RENT_CONVERSION',        // 임대료 환산가액 → 2020.2.11 이후 기준시가 적용
      'COLLATERAL_DEBT',        // 담보채권액 → 2023.2.28 이후 기준시가 적용
    ]).default('MARKET_PRICE'),

    // 증여자 취득가액 (평가방법에 따라 선택 적용)
    donorActualAcquireCost: KRWAmount.default(0),    // 증여자 실지취득가액
    donorStandardPriceAtAcquire: KRWAmount.default(0), // 증여자 취득 당시 기준시가

    // 하위호환: 기존 donorAcquireCost 필드 유지 (deprecated)
    donorAcquireCost: KRWAmount.default(0),  // @deprecated: donorActualAcquireCost 사용

    // 증여일 (기간 판정용)
    giftDate: DateString.optional(),
  }).optional(),

  // 이월과세 정보 (소득세법 제97조의2)
  carryoverTax: z.object({
    enabled: z.boolean().default(false),
    giftDate: DateString.optional(),         // 증여일
    donorAcquireDate: DateString.optional(), // 증여자 취득일 (보유기간 기산용)
    donorAcquireCost: KRWAmount.default(0),  // 증여자취득가액
    giftTaxPaid: KRWAmount.default(0),       // 납부(할)증여세액
    giftTaxBase: KRWAmount.default(0),       // 증여세 과세표준 (안분계산용)
    totalGiftTaxBase: KRWAmount.default(0),  // 전체 증여재산 과세표준 (안분계산용)
    donorRelation: z.enum(['spouse', 'lineal']).optional(),
    // 적용배제 사유
    exclusionReason: z.enum([
      'NONE',                    // 적용배제 없음 (이월과세 적용)
      'ONE_HOUSE_EXEMPTION',     // 1세대 1주택 비과세
      'LOWER_TAX_BENEFIT',       // 미적용이 유리
      'SPOUSE_DEATH',            // 배우자 사망
      'PUBLIC_ACQUISITION',      // 공익사업 수용
      'RELATIONSHIP_TERMINATED', // 직계존비속 관계 소멸
    ]).default('NONE'),
  }).optional(),
});
export type BP1Asset = z.infer<typeof BP1AssetSchema>;

// 부표2 자산 (주식)
export const BP2AssetSchema = z.object({
  id: z.string().uuid(),
  // 기본정보
  issuerName: z.string(),                  // ① 종목명
  securityId: z.string().optional(),       // ② 종목코드/사업자등록번호
  domesticForeign: StockDomesticForeignEnum, // ③ 국내/국외
  stockTypeCode: StockTypeCodeEnum,        // ④ 주식등 종류코드
  transferType: TransferAcquireTypeEnum,   // ⑤ 양도유형
  acquireType: TransferAcquireTypeEnum,    // ⑥ 취득유형
  quantity: z.number().int().min(0),       // ⑦ 수량

  // 일자
  transferDate: DateString,                // ⑧ 양도일자
  acquireDate: DateString.optional(),      // ⑨ 취득일자

  // 금액
  transferPrice: KRWAmount,                // ⑩ 양도가액
  acquirePrice: KRWAmount,                 // ⑬ 취득가액
  necessaryExpense: KRWAmount.default(0),  // ⑭ 필요경비

  // 과세이연
  taxDeferralApply: TaxDeferralApplyEnum.optional(),

  // 세율구분코드 (자동 결정 또는 수동)
  rateCode: z.string().optional(),

  // 이월과세 정보 (소득세법 제97조의2, 2025년 시행)
  // 주식은 증여일로부터 1년 이내 양도 시 적용
  carryoverTax: z.object({
    enabled: z.boolean().default(false),
    giftDate: DateString.optional(),         // 증여일
    donorAcquireDate: DateString.optional(), // 증여자 취득일
    donorAcquireCost: KRWAmount.default(0),  // 증여자취득가액
    giftTaxPaid: KRWAmount.default(0),       // 납부(할)증여세액
    giftTaxBase: KRWAmount.default(0),       // 증여세 과세표준 (안분계산용)
    totalGiftTaxBase: KRWAmount.default(0),  // 전체 증여재산 과세표준 (안분계산용)
    donorRelation: z.enum(['spouse', 'lineal']).optional(),
    exclusionReason: z.enum([
      'NONE',
      'LOWER_TAX_BENEFIT',
    ]).default('NONE'),
  }).optional(),
});
export type BP2Asset = z.infer<typeof BP2AssetSchema>;

// 부표2의2 파생상품 종목
export const BP2_2RowSchema = z.object({
  id: z.string().uuid(),
  rateCode: DerivativeRateCodeEnum,        // ② 세율구분코드
  productName: z.string(),                 // 종목명

  // 금액 (서식 기준)
  r08_transferPrice: KRWAmount.default(0),      // ⑧ 양도가액
  r09_necessaryExpense: KRWAmount.default(0),   // ⑨ 필요경비
  r11_prevGain: KRWAmount.default(0),           // ⑪ 전연도이월손익
  r12_currentLoss: KRWAmount.default(0),        // ⑫ 당해연도손실
  r13_carriedLoss: KRWAmount.default(0),        // ⑬ 이월결손
  r14_otherDeduction: KRWAmount.default(0),     // ⑭ 기타공제
});
export type BP2_2Row = z.infer<typeof BP2_2RowSchema>;

// 부표2의2 (파생상품)
export const BP2_2Schema = z.object({
  taxYear: z.number().int(),
  rows: z.array(BP2_2RowSchema),
});
export type BP2_2 = z.infer<typeof BP2_2Schema>;

// 감면 정보
export const ReliefSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),              // 대상 자산 ID
  reliefCode: z.string(),                  // 감면코드 (SELF_FARM_8Y, PUBLIC_CASH 등)
  reliefName: z.string(),                  // 감면명
  reliefType: z.enum(['TAX', 'INCOME']),   // 세액감면/소득차감
  reliefRate: z.number().min(0).max(100),  // 감면율(%)
  reliefAmount: KRWAmount.default(0),      // 감면액 (자동계산)
  baseAmount: KRWAmount.default(0),        // 감면대상금액
  legalBasis: z.string().optional(),       // 법적근거

  // 감면한도 관련 (조특법 제133조)
  limitGroup: z.string().optional(),       // 감면한도 그룹 (FARM, PUBLIC, etc)
  prevYearReliefUsed: KRWAmount.default(0), // 직전 4년 감면 사용액

  // 농어촌특별세 관련
  ruralSpecialTaxExempt: z.boolean().default(false), // 농특세 비과세 여부
  isSelfFarmLand: z.boolean().default(false),        // 자경농지 여부 (공익사업 조건부 비과세용)
});
export type Relief = z.infer<typeof ReliefSchema>;

// 가산세 정보
export const PenaltyInfoSchema = z.object({
  // 무신고/과소신고
  underReportType: z.enum(['NONE', 'NO_REPORT', 'UNDER_REPORT', 'UNFAITHFUL_NO', 'UNFAITHFUL_UNDER']).default('NONE'),
  underReportBase: KRWAmount.default(0),   // 무(과소)신고 세액 기준

  // 납부지연
  latePaymentDays: z.number().int().min(0).default(0),
  latePaymentBase: KRWAmount.default(0),   // 납부지연 세액 기준

  // 감면 (기한후/수정신고)
  reportDate: DateString.optional(),       // 실제 신고일
  dueDate: DateString.optional(),          // 법정 신고기한
  reductionApplied: z.boolean().default(false),
});
export type PenaltyInfo = z.infer<typeof PenaltyInfoSchema>;

// 전체 케이스 (신고서)
export const TaxCaseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  // Step 0: 신고구분
  reportType: ReportTypeEnum,
  taxYear: z.number().int().min(2023),

  // Step 1: 신고인
  taxpayer: TaxpayerSchema,

  // Step 2: 자산
  bp1Assets: z.array(BP1AssetSchema),      // 부동산/권리
  bp2Assets: z.array(BP2AssetSchema),      // 주식
  bp2_2: BP2_2Schema.optional(),           // 파생상품

  // Step 3: 감면
  reliefs: z.array(ReliefSchema),

  // Step 4: 가산세 (기한후/수정신고)
  penaltyInfo: PenaltyInfoSchema.optional(),

  // Step 5: 조정
  adjustments: z.object({
    prevReportedGainIncome: KRWAmount.default(0), // ⑤ 기신고 양도소득금액
    foreignTaxCredit: KRWAmount.default(0),       // ⑫ 외국납부세액공제
    withholdingCredit: KRWAmount.default(0),      // ⑬ 원천징수세액공제
    pensionCredit: KRWAmount.default(0),          // ⑭ 연금계좌세액공제
    prevTaxPaid: KRWAmount.default(0),            // ⑰ 기신고세액
  }).default({
    prevReportedGainIncome: 0,
    foreignTaxCredit: 0,
    withholdingCredit: 0,
    pensionCredit: 0,
    prevTaxPaid: 0,
  }),

  // 사용자 플래그
  flags: z.object({
    eFiling: z.boolean().default(true),           // 전자신고 여부
    proxyFiling: z.boolean().default(false),      // 대리신고 여부
  }).default({
    eFiling: true,
    proxyFiling: false,
  }),
});
export type TaxCase = z.infer<typeof TaxCaseSchema>;

// 계산 결과 (Derived)
export const DerivedAssetResultSchema = z.object({
  assetId: z.string().uuid(),
  assetType: z.enum(['BP1', 'BP2', 'BP2_2']),

  // 부표3 집계
  bp3AcquireTotal: KRWAmount.default(0),
  bp3ExpenseTotal: KRWAmount.default(0),

  // 계산값
  effectiveTransferPrice: KRWAmount.optional(), // 유효 양도가액(부담부증여 시 채무액)
  effectiveAcquirePrice: KRWAmount,        // 유효 취득가액(환산 반영)
  effectiveExpense: KRWAmount,             // 유효 필요경비
  transferGainTotal: KRWAmount,            // 전체양도차익
  taxableTransferGain: KRWAmount,          // 과세대상양도차익(고가주택 안분)
  ltDeductionRate: z.number(),             // 장특공율
  ltDeductionAmount: KRWAmount,            // 장특공액
  taxableLtDeduction: KRWAmount,           // 과세대상 장특공(고가주택 안분)
  gainIncome: KRWAmount,                   // 양도소득금액

  // 세율 정보
  rateCode: z.string(),
  rateType: z.enum(['progressive', 'flat']),
  rateValue: z.number().optional(),        // 단일세율인 경우
  additionalRate: z.number().optional(),   // 가산세율

  // 자산별 세액 (나 계산용)
  taxBaseByAsset: KRWAmount,
  taxByAsset: KRWAmount,

  // 기본공제 배분액
  basicDeductionAllocated: KRWAmount.default(0),
});
export type DerivedAssetResult = z.infer<typeof DerivedAssetResultSchema>;

export const DerivedMainResultSchema = z.object({
  // 집계
  line04_gainIncomeTotal: KRWAmount,       // ④ 양도소득금액 합계
  line05_prevReportedGainIncome: KRWAmount, // ⑤ 기신고 양도소득금액
  line06_incomeDeductionBase: KRWAmount,   // ⑥ 소득감면대상 소득금액
  line07_basicDeduction: KRWAmount,        // ⑦ 양도소득기본공제
  line08_taxBase: KRWAmount,               // ⑧ 과세표준
  line09_rateLabel: z.string(),            // ⑨ 세율표기

  // 산출세액
  taxA: KRWAmount,                         // A(가)
  taxB: KRWAmount,                         // B(나)
  line10_taxBeforeCredits: KRWAmount,      // ⑩ 산출세액 = max(A,B)

  // 공제
  line11_taxRelief: KRWAmount,             // ⑪ 감면세액
  line12_foreignTaxCredit: KRWAmount,      // ⑫ 외국납부세액공제
  line13_withholdingCredit: KRWAmount,     // ⑬ 원천징수세액공제
  line14_pensionCredit: KRWAmount,         // ⑭ 연금계좌세액공제
  line15_eFilingCredit: KRWAmount,         // ⑮ 전자신고세액공제

  // 가산세
  penaltyUnderReport: KRWAmount,           // ⑯-A 무(과소)신고
  penaltyLatePayment: KRWAmount,           // ⑯-B 납부지연
  penaltyOther: KRWAmount,                 // ⑯-C 기타
  penaltyTotal: KRWAmount,                 // ⑯ 가산세 계

  // 최종
  line17_prevTaxPaid: KRWAmount,           // ⑰ 기신고세액
  line18_taxDue: KRWAmount,                // ⑱ 납부할 세액

  // 농어촌특별세 (농어촌특별세법 제5조)
  ruralSpecialTax: z.object({
    taxableReliefAmount: KRWAmount,        // 농특세 과세대상 감면액
    exemptReliefAmount: KRWAmount,         // 농특세 비과세 감면액
    taxRate: z.number(),                   // 세율 (20%)
    taxAmount: KRWAmount,                  // 농어촌특별세액
    details: z.array(z.object({
      reliefCode: z.string(),
      reliefName: z.string(),
      reliefAmount: KRWAmount,
      isExempt: z.boolean(),
      exemptReason: z.string().optional(),
      ruralTaxAmount: KRWAmount,
    })),
  }).default({
    taxableReliefAmount: 0,
    exemptReliefAmount: 0,
    taxRate: 20,
    taxAmount: 0,
    details: [],
  }),

  // 감면한도 적용 결과 (조특법 제133조)
  reliefLimitResult: z.object({
    annualLimit: KRWAmount,                // 연간 한도 (1억)
    fiveYearLimit: KRWAmount,              // 5년 한도 (2억)
    requestedAmount: KRWAmount,            // 요청 감면액
    limitedAmount: KRWAmount,              // 한도 적용 후 감면액
    exceededAmount: KRWAmount,             // 한도 초과액 (감면 배제)
    prevFourYearsUsed: KRWAmount,          // 직전 4년 사용액
  }).default({
    annualLimit: 100000000,
    fiveYearLimit: 200000000,
    requestedAmount: 0,
    limitedAmount: 0,
    exceededAmount: 0,
    prevFourYearsUsed: 0,
  }),

  // 총 납부세액 (양도소득세 + 농어촌특별세)
  totalTaxDue: KRWAmount,                  // 양도소득세 + 농특세

  // 세율구분 집계표
  rateCategorySummary: z.array(z.object({
    rateCode: z.string(),
    gainIncomeSum: KRWAmount,
    assetCount: z.number().int(),
  })),

  // 버킷별 기본공제
  basicDeductionByBucket: z.record(z.string(), KRWAmount),
});
export type DerivedMainResult = z.infer<typeof DerivedMainResultSchema>;

// 전체 계산 결과
export const CalculationResultSchema = z.object({
  caseId: z.string().uuid(),
  calculatedAt: z.string().datetime(),

  assetResults: z.array(DerivedAssetResultSchema),
  mainResult: DerivedMainResultSchema,

  // 계산 로그 (Privacy-safe)
  calculationLog: z.array(z.object({
    step: z.string(),
    description: z.string(),
    values: z.record(z.string(), z.union([z.number(), z.string()])),
  })),

  // 경고/오류
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type CalculationResult = z.infer<typeof CalculationResultSchema>;
