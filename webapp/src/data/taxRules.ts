// 조정대상지역 및 신고기한 관련 데이터
// 법적 근거: 소득세법 제104조, 부동산 가격공시에 관한 법률

export interface AdjustmentArea {
  code: string;
  name: string;
  city: string;
  district: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

// 조정대상지역 목록 (2024.12 기준)
// 2024년 현재 서울 4개구만 조정대상지역
export const ADJUSTMENT_AREAS: AdjustmentArea[] = [
  // 서울 (2024.12 현재)
  { code: '11650', name: '서초구', city: '서울특별시', district: '서초구', effectiveFrom: '2017-08-03', effectiveTo: null },
  { code: '11680', name: '강남구', city: '서울특별시', district: '강남구', effectiveFrom: '2017-08-03', effectiveTo: null },
  { code: '11710', name: '송파구', city: '서울특별시', district: '송파구', effectiveFrom: '2017-08-03', effectiveTo: null },
  { code: '11170', name: '용산구', city: '서울특별시', district: '용산구', effectiveFrom: '2021-02-01', effectiveTo: null },
];

// 다주택 중과 한시배제 기간 (2024.12 연장)
export const MULTI_HOME_SURTAX_SUSPENSION = {
  startDate: '2022-05-10',
  endDate: '2026-05-09',
  description: '조정대상지역 다주택자 중과세율 한시 배제 (1년 연장)',
  legalBasis: '소득세법 제104조제7항',
};

/**
 * 주어진 날짜와 주소가 조정대상지역에 해당하는지 확인
 */
export function isAdjustmentArea(
  address: string,
  dateStr: string
): boolean {
  const date = new Date(dateStr);

  for (const area of ADJUSTMENT_AREAS) {
    if (!address.includes(area.district)) continue;
    if (!address.includes(area.city)) continue;

    const effectiveFrom = new Date(area.effectiveFrom);
    const effectiveTo = area.effectiveTo ? new Date(area.effectiveTo) : null;

    if (date >= effectiveFrom && (!effectiveTo || date <= effectiveTo)) {
      return true;
    }
  }

  return false;
}

/**
 * 다주택 중과 한시배제 기간인지 확인
 */
export function isMultiHomeSurtaxSuspended(transferDateStr: string): boolean {
  const date = new Date(transferDateStr);
  const start = new Date(MULTI_HOME_SURTAX_SUSPENSION.startDate);
  const end = new Date(MULTI_HOME_SURTAX_SUSPENSION.endDate);

  return date >= start && date <= end;
}

/**
 * 양도소득세 예정신고 기한 계산
 * - 부동산: 양도일이 속하는 달의 말일부터 2개월 이내
 * - 주식: 양도일이 속하는 반기 말일부터 2개월 이내
 */
export function calculateFilingDeadline(
  transferDateStr: string,
  assetType: 'realEstate' | 'stock' | 'derivative'
): { deadline: string; isPastDue: boolean; daysRemaining: number } {
  const transferDate = new Date(transferDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let deadline: Date;

  if (assetType === 'stock' || assetType === 'derivative') {
    // 반기 기준
    const month = transferDate.getMonth();
    const year = transferDate.getFullYear();

    if (month < 6) {
      // 상반기: 8월 말
      deadline = new Date(year, 7, 31);
    } else {
      // 하반기: 다음해 2월 말
      deadline = new Date(year + 1, 1, 28);
      // 윤년 체크
      if (new Date(year + 1, 1, 29).getMonth() === 1) {
        deadline = new Date(year + 1, 1, 29);
      }
    }
  } else {
    // 부동산: 양도월 말일 + 2개월
    const year = transferDate.getFullYear();
    const month = transferDate.getMonth();

    // 2개월 후 말일
    deadline = new Date(year, month + 3, 0);
  }

  const diffTime = deadline.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    deadline: deadline.toISOString().split('T')[0],
    isPastDue: daysRemaining < 0,
    daysRemaining,
  };
}

/**
 * 확정신고 기한 계산 (다음해 5월 31일)
 */
export function calculateFinalFilingDeadline(taxYear: number): {
  deadline: string;
  isPastDue: boolean;
  daysRemaining: number;
} {
  const deadline = new Date(taxYear + 1, 4, 31); // 5월 31일
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = deadline.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    deadline: deadline.toISOString().split('T')[0],
    isPastDue: daysRemaining < 0,
    daysRemaining,
  };
}

/**
 * 보유기간 계산 (년 단위, 소수점 버림)
 */
export function calculateHoldingYears(acquireDateStr: string, transferDateStr: string): number {
  const acquire = new Date(acquireDateStr);
  const transfer = new Date(transferDateStr);

  let years = transfer.getFullYear() - acquire.getFullYear();
  const monthDiff = transfer.getMonth() - acquire.getMonth();
  const dayDiff = transfer.getDate() - acquire.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--;
  }

  return Math.max(0, years);
}

/**
 * 보유기간 계산 (월 단위)
 */
export function calculateHoldingMonths(acquireDateStr: string, transferDateStr: string): number {
  const acquire = new Date(acquireDateStr);
  const transfer = new Date(transferDateStr);

  const years = transfer.getFullYear() - acquire.getFullYear();
  const months = transfer.getMonth() - acquire.getMonth();

  return Math.max(0, years * 12 + months);
}

/**
 * 고가주택 여부 자동 판정 (12억 초과)
 */
export function isHighValueHousing(transferPrice: number): boolean {
  return transferPrice > 1200000000; // 12억원
}

/**
 * 세율구분코드 자동추천
 */
export function suggestRateCode(params: {
  assetTypeCode: string;
  holdingYears: number;
  isUnregistered: boolean;
  isNonBusinessLand: boolean;
  isMultiHomeSurtax: boolean;
  multiHomeCount: number;
  isAdjustedArea: boolean;
  transferDate: string;
}): { code: string; description: string; warning?: string } {
  const {
    assetTypeCode,
    holdingYears,
    isUnregistered,
    isNonBusinessLand,
    isMultiHomeSurtax,
    multiHomeCount,
    isAdjustedArea,
    transferDate,
  } = params;

  // 미등기
  if (isUnregistered) {
    return { code: '1-35', description: '미등기 양도 (70%)', warning: '미등기 양도는 70% 단일세율 적용, 기본공제 배제' };
  }

  // 주택
  if (['3', '4'].includes(assetTypeCode)) {
    // 다주택 중과
    if (isMultiHomeSurtax && isAdjustedArea && !isMultiHomeSurtaxSuspended(transferDate)) {
      if (multiHomeCount >= 3) {
        if (holdingYears < 1) return { code: '1-55', description: '조정3주택 1년미만' };
        if (holdingYears < 2) return { code: '1-56', description: '조정3주택 1-2년' };
        return { code: '1-47', description: '조정대상지역 3주택 이상' };
      } else {
        if (holdingYears < 1) return { code: '1-53', description: '조정2주택 1년미만' };
        if (holdingYears < 2) return { code: '1-54', description: '조정2주택 1-2년' };
        return { code: '1-46', description: '조정대상지역 2주택' };
      }
    }

    // 일반 주택
    if (holdingYears < 1) return { code: '1-50', description: '주택 1년 미만 (50%)' };
    if (holdingYears < 2) return { code: '1-51', description: '주택 1-2년 (40%)' };
    return { code: '1-52', description: '주택 2년 이상 (기본세율)' };
  }

  // 토지
  if (['1', '2'].includes(assetTypeCode)) {
    if (isNonBusinessLand) {
      return { code: '1-11', description: '비사업용토지 (기본+10%p)' };
    }
    if (holdingYears < 1) return { code: '1-15', description: '토지 1년 미만 (50%)' };
    if (holdingYears < 2) return { code: '1-21', description: '토지 1-2년 (40%)' };
    return { code: '1-10', description: '토지/건물 일반 (기본세율)' };
  }

  // 분양권
  if (assetTypeCode === '5') {
    if (holdingYears < 1) return { code: '1-38', description: '분양권 1년 미만 (50%)' };
    if (holdingYears < 2) return { code: '1-39', description: '분양권 1-2년 (40%)' };
    return { code: '1-40', description: '분양권 2년 이상' };
  }

  // 기타
  return { code: '1-10', description: '일반 (기본세율)' };
}

/**
 * 장기보유특별공제 코드 자동추천
 */
export function suggestLtDeductionCode(params: {
  assetTypeCode: string;
  isOneHouseExemption: boolean;
  isUnregistered: boolean;
  isNonBusinessLand: boolean;
  holdingYears: number;
  residenceYears: number;
}): { code: string; description: string; maxRate: number } {
  const { assetTypeCode, isOneHouseExemption, isUnregistered, isNonBusinessLand, holdingYears } = params;

  // 배제 조건
  if (isUnregistered) {
    return { code: '03', description: '배제 (미등기)', maxRate: 0 };
  }
  if (isNonBusinessLand) {
    return { code: '03', description: '배제 (비사업용토지)', maxRate: 0 };
  }
  if (holdingYears < 3) {
    return { code: '03', description: '배제 (3년 미만 보유)', maxRate: 0 };
  }

  // 주식/파생상품은 장특공 없음
  if (['8', '9'].includes(assetTypeCode)) {
    return { code: '03', description: '해당없음 (주식/파생)', maxRate: 0 };
  }

  // 1세대1주택
  if (isOneHouseExemption && ['3', '4'].includes(assetTypeCode)) {
    return { code: '01', description: '표2 (1세대1주택)', maxRate: 80 };
  }

  // 일반
  return { code: '02', description: '표1 (일반)', maxRate: 30 };
}

// 1세대1주택 비과세 요건 체크리스트
export interface OneHouseExemptionChecklist {
  id: string;
  question: string;
  required: boolean;
  helpText: string;
}

export const ONE_HOUSE_EXEMPTION_CHECKLIST: OneHouseExemptionChecklist[] = [
  {
    id: 'singleHouse',
    question: '양도일 현재 1세대 1주택 보유',
    required: true,
    helpText: '세대 전원이 양도일 현재 국내에 1주택만 소유해야 합니다.',
  },
  {
    id: 'holding2Years',
    question: '2년 이상 보유',
    required: true,
    helpText: '취득일부터 양도일까지 2년 이상 보유해야 합니다.',
  },
  {
    id: 'residence2Years',
    question: '2년 이상 거주 (조정대상지역 취득 시)',
    required: false,
    helpText: '2017.8.3 이후 조정대상지역에서 취득한 주택은 2년 이상 거주해야 비과세.',
  },
  {
    id: 'resident',
    question: '양도일 현재 거주자',
    required: true,
    helpText: '양도일 현재 소득세법상 거주자이어야 합니다.',
  },
];
