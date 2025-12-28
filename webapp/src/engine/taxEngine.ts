// 양도소득세 계산 엔진
import { v4 as uuidv4 } from 'uuid';
import type {
  TaxCase,
  BP1Asset,
  BP2Asset,
  BP2_2Row,
  DerivedAssetResult,
  DerivedMainResult,
  CalculationResult,
} from '../schemas';
import { getRulePack } from '../rules';
import {
  roundToWon,
  calculateHoldingYears,
  calculateHoldingMonths,
  getShortTermType,
  calculateHighValueRatio,
  calculateConvertedAcquirePrice,
  calculateGiftWithDebtPortion,
  calculateProgressiveTax,
  calculateFlatTax,
  getDeductionBucket,
  getReductionPeriod,
  getLateReportReductionRate,
  getAmendReportReductionRate,
  type TaxBracket,
  type DeductionBucket,
} from './utils';

interface CalculationLog {
  step: string;
  description: string;
  values: Record<string, number | string>;
}

/**
 * 세율구분코드에서 세율 정보 추출
 */
function getRateInfo(
  rateCode: string,
  rulePack: ReturnType<typeof getRulePack>,
  transferDate: string
): {
  type: 'progressive' | 'flat';
  flatRate?: number;
  additionalRate: number;
  label: string;
} {
  const mapping = rulePack.rates.rateCategoryMapping as Record<string, any>;
  const config = mapping[rateCode];

  if (!config) {
    return { type: 'progressive', additionalRate: 0, label: '기본세율' };
  }

  let additionalRate = 0;

  // 비사업용토지 가산
  if (config.addNonBusiness) {
    additionalRate += rulePack.rates.surtaxRates.nonBusinessLand.add;
  }

  // 다주택 중과 (한시배제 기간 확인)
  if (config.addMultiHome2 || config.addMultiHome3) {
    const suspend2 = rulePack.rates.surtaxRates.multiHomeAdjusted2Home;
    const suspend3 = rulePack.rates.surtaxRates.multiHomeAdjusted3Home;

    const transferDateObj = new Date(transferDate);

    if (config.addMultiHome2) {
      const suspendFrom = new Date(suspend2.suspendFrom);
      const suspendTo = new Date(suspend2.suspendTo);
      if (transferDateObj < suspendFrom || transferDateObj > suspendTo) {
        additionalRate += suspend2.add;
      }
    }

    if (config.addMultiHome3) {
      const suspendFrom = new Date(suspend3.suspendFrom);
      const suspendTo = new Date(suspend3.suspendTo);
      if (transferDateObj < suspendFrom || transferDateObj > suspendTo) {
        additionalRate += suspend3.add;
      }
    }
  }

  if (config.type === 'flat') {
    const flatRates = rulePack.rates.flatRates as unknown as Record<string, { rate: number; note: string }>;
    const rateInfo = flatRates[config.key];
    return {
      type: 'flat',
      flatRate: rateInfo?.rate ?? 20,
      additionalRate,
      label: config.desc ?? `${rateInfo?.rate}%`,
    };
  }

  return {
    type: 'progressive',
    additionalRate,
    label: config.desc ?? '누진세율',
  };
}

/**
 * 장기보유특별공제율 계산
 */
function calculateLtDeductionRate(
  ltDeductionCode: string,
  holdingYears: number,
  residenceYears: number,
  rulePack: ReturnType<typeof getRulePack>
): number {
  const lt = rulePack.ltDeduction;

  // 배제
  if (ltDeductionCode === '03') {
    return 0;
  }

  // 1세대1주택 (표2)
  if (ltDeductionCode === '01') {
    const table2 = lt.table2;
    let holdingRate = 0;
    let residenceRate = 0;

    // 보유기간 공제율
    if (holdingYears >= table2.minHoldingYears) {
      const yearKey = Math.min(holdingYears, 10).toString();
      holdingRate = (table2.holdingRates as Record<string, number>)[yearKey] ?? 0;
    }

    // 거주기간 공제율
    if (residenceYears >= table2.minResidenceYears) {
      const yearKey = Math.min(residenceYears, 10).toString();
      residenceRate = (table2.residenceRates as Record<string, number>)[yearKey] ?? 0;
    }

    return Math.min(holdingRate + residenceRate, table2.maxTotalRate);
  }

  // 일반 (표1)
  if (ltDeductionCode === '02') {
    const table1 = lt.table1;
    if (holdingYears < table1.minYears) {
      return 0;
    }
    const yearKey = Math.min(holdingYears, 15).toString();
    return (table1.rates as Record<string, number>)[yearKey] ?? 0;
  }

  // 특례 케이스
  if (ltDeductionCode === '04' || ltDeductionCode === '05') {
    // 장기임대주택 특례 - 간략화
    if (holdingYears >= 10) return 70;
    if (holdingYears >= 8) return 50;
    return 0;
  }

  return 0;
}

/**
 * 부표3 합계 계산
 */
function calculateBP3Totals(bp3?: BP1Asset['bp3']): {
  acquireTotal: number;
  expenseTotal: number;
} {
  if (!bp3) {
    return { acquireTotal: 0, expenseTotal: 0 };
  }

  const acquireTotal =
    (bp3.acquireCosts.r111_purchasePrice ?? 0) +
    (bp3.acquireCosts.r112_acquisitionTax ?? 0) +
    (bp3.acquireCosts.r113_registrationTax ?? 0) +
    (bp3.acquireCosts.r114_lawyerFee ?? 0) +
    (bp3.acquireCosts.r115_brokerFee ?? 0) +
    (bp3.acquireCosts.r116_other ?? 0);

  const expenseTotal =
    (bp3.expenses.r210_capitalExpense ?? 0) +
    (bp3.expenses.r220_transferExpense ?? 0) +
    (bp3.expenses.r250_filingFee ?? 0) +
    (bp3.expenses.r260_lawyerFee ?? 0) +
    (bp3.expenses.r270_notaryFee ?? 0) +
    (bp3.expenses.r280_stampDuty ?? 0) +
    (bp3.expenses.r290_other ?? 0);

  return { acquireTotal, expenseTotal };
}

/**
 * 부표1 자산 계산
 */
function calculateBP1Asset(
  asset: BP1Asset,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): DerivedAssetResult {
  const rateInfo = getRateInfo(asset.rateCode, rulePack, asset.transferDate);

  // 부표3 합계
  const bp3Totals = calculateBP3Totals(asset.bp3);

  // 유효 취득가액 (환산취득가액 반영)
  let effectiveAcquirePrice = asset.acquirePrice;

  if (asset.acquirePriceType === 'CONVERTED' &&
      asset.stdValueAcquireBuilding !== undefined &&
      asset.stdValueAcquireLand !== undefined &&
      asset.stdValueTransferBuilding !== undefined &&
      asset.stdValueTransferLand !== undefined) {
    effectiveAcquirePrice = calculateConvertedAcquirePrice(
      asset.transferPrice,
      asset.stdValueAcquireBuilding,
      asset.stdValueAcquireLand,
      asset.stdValueTransferBuilding,
      asset.stdValueTransferLand
    );
    logs.push({
      step: 'CALC-BP1-400',
      description: '환산취득가액 계산',
      values: {
        transferPrice: asset.transferPrice,
        convertedAcquirePrice: effectiveAcquirePrice,
      },
    });
  }

  // 부담부증여 처리
  if (asset.giftWithDebt?.enabled) {
    const portion = calculateGiftWithDebtPortion(
      asset.giftWithDebt.assessedValue,
      asset.giftWithDebt.debtAmount,
      asset.giftWithDebt.donorAcquireCost
    );
    // 양도로 보는 부분만 계산 (채무 비율만큼)
    effectiveAcquirePrice = portion.acquirePricePortion;
    logs.push({
      step: 'CALC-GIFT-159',
      description: '부담부증여 안분',
      values: {
        ratio: portion.ratio,
        transferPricePortion: portion.transferPricePortion,
        acquirePricePortion: portion.acquirePricePortion,
      },
    });
  }

  // 이월과세 처리
  if (asset.carryoverTax?.enabled) {
    effectiveAcquirePrice = asset.carryoverTax.donorAcquireCost;
    // 증여세 상당액은 필요경비에 가산
    logs.push({
      step: 'CALC-CARRY-972',
      description: '이월과세 취득가액',
      values: {
        donorAcquireCost: asset.carryoverTax.donorAcquireCost,
        giftTaxPaid: asset.carryoverTax.giftTaxPaid,
      },
    });
  }

  // 유효 취득가액에 부표3 합계 반영 (있으면 대체)
  if (bp3Totals.acquireTotal > 0) {
    effectiveAcquirePrice = bp3Totals.acquireTotal;
  }

  const effectiveExpense = bp3Totals.expenseTotal + (asset.carryoverTax?.giftTaxPaid ?? 0);

  // 전체 양도차익
  const transferGainTotal = asset.transferPrice - effectiveAcquirePrice - effectiveExpense;

  logs.push({
    step: 'CALC-BP1-100',
    description: '전체 양도차익 계산',
    values: {
      transferPrice: asset.transferPrice,
      effectiveAcquirePrice,
      effectiveExpense,
      transferGainTotal,
    },
  });

  // 고가주택 안분
  let taxableTransferGain = transferGainTotal;
  let highValueRatio = 0;

  if (asset.userFlags.oneHouseExemption && asset.userFlags.highValueHousing) {
    const threshold = rulePack.highValueHousing.threshold.amount;
    highValueRatio = calculateHighValueRatio(asset.transferPrice, threshold);
    taxableTransferGain = roundToWon(transferGainTotal * highValueRatio);

    logs.push({
      step: 'CALC-BP1-120',
      description: '고가주택 안분 (양도차익)',
      values: {
        threshold,
        highValueRatio,
        taxableTransferGain,
      },
    });
  }

  // 장기보유특별공제
  const holdingYears = asset.holdingYears ?? calculateHoldingYears(asset.acquireDate, asset.transferDate);
  const residenceYears = asset.residenceYears ?? 0;

  let ltDeductionRate = 0;
  let ltDeductionAmount = 0;
  let taxableLtDeduction = 0;

  // 미등기/비사업용토지 등 배제 조건 확인
  if (!asset.userFlags.unregistered && asset.ltDeductionCode !== '03') {
    ltDeductionRate = calculateLtDeductionRate(
      asset.ltDeductionCode,
      holdingYears,
      residenceYears,
      rulePack
    );

    ltDeductionAmount = roundToWon(transferGainTotal * (ltDeductionRate / 100));

    // 고가주택 안분
    if (highValueRatio > 0) {
      taxableLtDeduction = roundToWon(ltDeductionAmount * highValueRatio);
    } else {
      taxableLtDeduction = ltDeductionAmount;
    }

    logs.push({
      step: 'CALC-LT-001',
      description: '장기보유특별공제',
      values: {
        ltDeductionCode: asset.ltDeductionCode,
        holdingYears,
        residenceYears,
        ltDeductionRate,
        ltDeductionAmount,
        taxableLtDeduction,
      },
    });
  }

  // 양도소득금액
  const gainIncome = Math.max(0, taxableTransferGain - taxableLtDeduction);

  logs.push({
    step: 'CALC-BP1-300',
    description: '양도소득금액',
    values: {
      taxableTransferGain,
      taxableLtDeduction,
      gainIncome,
    },
  });

  return {
    assetId: asset.id,
    assetType: 'BP1',
    bp3AcquireTotal: bp3Totals.acquireTotal,
    bp3ExpenseTotal: bp3Totals.expenseTotal,
    effectiveAcquirePrice,
    effectiveExpense,
    transferGainTotal,
    taxableTransferGain,
    ltDeductionRate,
    ltDeductionAmount,
    taxableLtDeduction,
    gainIncome,
    rateCode: asset.rateCode,
    rateType: rateInfo.type,
    rateValue: rateInfo.flatRate,
    additionalRate: rateInfo.additionalRate,
    taxBaseByAsset: gainIncome, // 기본공제 전
    taxByAsset: 0, // 나중에 계산
    basicDeductionAllocated: 0,
  };
}

/**
 * 부표2 자산 계산 (주식)
 */
function calculateBP2Asset(
  asset: BP2Asset,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): DerivedAssetResult {
  // 세율구분코드 결정
  let rateCode = asset.rateCode ?? '1-62';

  // 주식 종류에 따른 기본 세율코드
  if (!asset.rateCode) {
    if (asset.stockTypeCode === '33') {
      rateCode = '1-61'; // 중소기업주식
    } else if (asset.domesticForeign === '2') {
      rateCode = '1-73'; // 국외주식
    } else if (asset.stockTypeCode === '34') {
      rateCode = '1-63'; // 상장주식 대주주
    }
  }

  const rateInfo = getRateInfo(rateCode, rulePack, asset.transferDate);

  // 양도소득금액 = 양도가액 - 취득가액 - 필요경비
  const gainIncome = asset.transferPrice - asset.acquirePrice - (asset.necessaryExpense ?? 0);

  logs.push({
    step: 'CALC-BP2-100',
    description: '주식 양도소득금액',
    values: {
      transferPrice: asset.transferPrice,
      acquirePrice: asset.acquirePrice,
      necessaryExpense: asset.necessaryExpense ?? 0,
      gainIncome,
    },
  });

  return {
    assetId: asset.id,
    assetType: 'BP2',
    bp3AcquireTotal: 0,
    bp3ExpenseTotal: 0,
    effectiveAcquirePrice: asset.acquirePrice,
    effectiveExpense: asset.necessaryExpense ?? 0,
    transferGainTotal: gainIncome,
    taxableTransferGain: gainIncome,
    ltDeductionRate: 0,
    ltDeductionAmount: 0,
    taxableLtDeduction: 0,
    gainIncome: Math.max(0, gainIncome),
    rateCode,
    rateType: rateInfo.type,
    rateValue: rateInfo.flatRate,
    additionalRate: rateInfo.additionalRate,
    taxBaseByAsset: Math.max(0, gainIncome),
    taxByAsset: 0,
    basicDeductionAllocated: 0,
  };
}

/**
 * 부표2의2 행 계산 (파생상품)
 */
function calculateBP2_2Row(
  row: BP2_2Row,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): DerivedAssetResult {
  // 산식: ⑧-⑨-⑪-⑫+⑬-⑭
  const gainIncome =
    row.r08_transferPrice -
    row.r09_necessaryExpense -
    row.r11_prevGain -
    row.r12_currentLoss +
    row.r13_carriedLoss -
    row.r14_otherDeduction;

  const flatRates = rulePack.rates.flatRates as unknown as Record<string, { rate: number }>;
  const rateValue = row.rateCode === '80'
    ? flatRates.derivativeOld?.rate ?? 20
    : flatRates.derivativeNew?.rate ?? 20;

  logs.push({
    step: 'CALC-DERIV-100',
    description: '파생상품 양도소득금액',
    values: {
      formula: '⑧-⑨-⑪-⑫+⑬-⑭',
      gainIncome,
      rateValue,
    },
  });

  return {
    assetId: row.id,
    assetType: 'BP2_2',
    bp3AcquireTotal: 0,
    bp3ExpenseTotal: 0,
    effectiveAcquirePrice: 0,
    effectiveExpense: row.r09_necessaryExpense,
    transferGainTotal: gainIncome,
    taxableTransferGain: gainIncome,
    ltDeductionRate: 0,
    ltDeductionAmount: 0,
    taxableLtDeduction: 0,
    gainIncome: Math.max(0, gainIncome),
    rateCode: `1-${row.rateCode}`,
    rateType: 'flat',
    rateValue,
    additionalRate: 0,
    taxBaseByAsset: Math.max(0, gainIncome),
    taxByAsset: 0,
    basicDeductionAllocated: 0,
  };
}

/**
 * 기본공제 배분
 */
function allocateBasicDeduction(
  assetResults: DerivedAssetResult[],
  taxCase: TaxCase,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): {
  results: DerivedAssetResult[];
  byBucket: Record<string, number>;
  total: number;
} {
  const bucketLimit = 2500000;
  const maxTotal = 12500000;

  // 버킷별 자산 그룹화
  const buckets: Record<DeductionBucket, DerivedAssetResult[]> = {
    DOMESTIC: [],
    STOCK: [],
    DERIVATIVE: [],
    FOREIGN: [],
    OTHER: [],
  };

  // 미등기 자산 제외하고 분류
  for (const result of assetResults) {
    // 해당 자산 찾기
    const bp1Asset = taxCase.bp1Assets.find(a => a.id === result.assetId);
    const bp2Asset = taxCase.bp2Assets.find(a => a.id === result.assetId);

    // 미등기 양도자산은 기본공제 제외
    if (bp1Asset?.userFlags.unregistered) {
      continue;
    }

    let bucket: DeductionBucket;
    if (result.assetType === 'BP1') {
      bucket = getDeductionBucket(bp1Asset?.assetTypeCode ?? '1');
    } else if (result.assetType === 'BP2') {
      bucket = getDeductionBucket('8', bp2Asset?.domesticForeign);
    } else {
      bucket = 'DERIVATIVE';
    }

    buckets[bucket].push(result);
  }

  // 버킷별 공제 배분
  const byBucket: Record<string, number> = {};
  let totalAllocated = 0;
  const updatedResults = [...assetResults];

  for (const [bucketKey, assets] of Object.entries(buckets)) {
    if (assets.length === 0) continue;

    // 양도일 순으로 정렬 (FIFO)
    const sorted = [...assets].sort((a, b) => {
      const aDate = taxCase.bp1Assets.find(x => x.id === a.assetId)?.transferDate ??
                   taxCase.bp2Assets.find(x => x.id === a.assetId)?.transferDate ?? '';
      const bDate = taxCase.bp1Assets.find(x => x.id === b.assetId)?.transferDate ??
                   taxCase.bp2Assets.find(x => x.id === b.assetId)?.transferDate ?? '';
      return aDate.localeCompare(bDate);
    });

    // 버킷 한도 내에서 배분
    let bucketRemaining = bucketLimit;
    let bucketTotal = 0;

    for (const result of sorted) {
      if (bucketRemaining <= 0) break;
      if (totalAllocated >= maxTotal) break;

      const availableForBucket = Math.min(bucketRemaining, maxTotal - totalAllocated);
      const toAllocate = Math.min(result.gainIncome, availableForBucket);

      // 결과 업데이트
      const idx = updatedResults.findIndex(r => r.assetId === result.assetId);
      if (idx >= 0) {
        updatedResults[idx] = {
          ...updatedResults[idx],
          basicDeductionAllocated: toAllocate,
          taxBaseByAsset: Math.max(0, result.gainIncome - toAllocate),
        };
      }

      bucketRemaining -= toAllocate;
      bucketTotal += toAllocate;
      totalAllocated += toAllocate;
    }

    byBucket[bucketKey] = bucketTotal;
  }

  logs.push({
    step: 'CALC-DED-001',
    description: '기본공제 버킷별 배분',
    values: {
      ...byBucket,
      total: totalAllocated,
    },
  });

  return {
    results: updatedResults,
    byBucket,
    total: totalAllocated,
  };
}

/**
 * 산출세액 계산 (A/B 방식)
 */
function calculateTax(
  assetResults: DerivedAssetResult[],
  totalGainIncome: number,
  totalBasicDeduction: number,
  prevReportedGainIncome: number,
  incomeDeductionBase: number,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): {
  taxBase: number;
  taxA: number;
  taxB: number;
  taxBeforeCredits: number;
} {
  // 과세표준 = (④ - ⑤ - ⑥) - ⑦
  const taxBase = Math.max(0,
    totalGainIncome - prevReportedGainIncome - incomeDeductionBase - totalBasicDeduction
  );

  logs.push({
    step: 'CALC-RET-080',
    description: '과세표준 계산',
    values: {
      totalGainIncome,
      prevReportedGainIncome,
      incomeDeductionBase,
      totalBasicDeduction,
      taxBase,
    },
  });

  // A(가): 과세표준 전체에 누진세율 적용
  const brackets = rulePack.rates.progressiveRates.brackets as TaxBracket[];
  const taxA = calculateProgressiveTax(taxBase, brackets);

  logs.push({
    step: 'CALC-RET-100A',
    description: 'A(가) 계산 - 누진세율',
    values: { taxBase, taxA },
  });

  // B(나): 자산별 세액 합계
  let taxB = 0;
  for (const result of assetResults) {
    const assetTaxBase = result.taxBaseByAsset;
    let assetTax = 0;

    if (result.rateType === 'flat' && result.rateValue) {
      // 단일세율 + 가산세율
      const totalRate = result.rateValue + (result.additionalRate ?? 0);
      assetTax = calculateFlatTax(assetTaxBase, totalRate);
    } else {
      // 누진세율 + 가산세율
      assetTax = calculateProgressiveTax(assetTaxBase, brackets);
      if (result.additionalRate && result.additionalRate > 0) {
        assetTax += calculateFlatTax(assetTaxBase, result.additionalRate);
      }
    }

    result.taxByAsset = assetTax;
    taxB += assetTax;
  }

  logs.push({
    step: 'CALC-RET-100B',
    description: 'B(나) 계산 - 자산별 합계',
    values: { taxB },
  });

  // max(A, B)
  const taxBeforeCredits = Math.max(taxA, taxB);

  logs.push({
    step: 'CALC-RET-100',
    description: '산출세액 = max(A, B)',
    values: { taxA, taxB, taxBeforeCredits },
  });

  return { taxBase, taxA, taxB, taxBeforeCredits };
}

/**
 * 감면한도 적용 (조세특례제한법 제133조)
 * - 과세기간별 한도: 1억원
 * - 5개 과세기간 합계 한도: 2억원
 */
function applyReliefLimits(
  reliefs: TaxCase['reliefs'],
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): {
  adjustedReliefs: TaxCase['reliefs'];
  limitResult: {
    annualLimit: number;
    fiveYearLimit: number;
    requestedAmount: number;
    limitedAmount: number;
    exceededAmount: number;
    prevFourYearsUsed: number;
  };
} {
  const reliefRules = rulePack.reliefs;
  const comprehensiveLimit = reliefRules.comprehensiveLimit;
  const annualLimit = comprehensiveLimit.annualLimit;
  const fiveYearLimit = comprehensiveLimit.fiveYearLimit;
  const applicableCodes = comprehensiveLimit.applicableCodes as string[];

  // 한도 적용 대상 감면액 합계
  let limitSubjectAmount = 0;
  // 직전 4년 사용액 (사용자 입력 기반)
  let prevFourYearsUsed = 0;

  for (const relief of reliefs) {
    if (applicableCodes.includes(relief.reliefCode)) {
      limitSubjectAmount += relief.reliefAmount;
      prevFourYearsUsed += relief.prevYearReliefUsed ?? 0;
    }
  }

  // 과세기간별 한도 초과액
  const annualExcess = Math.max(0, limitSubjectAmount - annualLimit);

  // 5년 합계 한도 초과액
  const fiveYearTotal = limitSubjectAmount + prevFourYearsUsed;
  const fiveYearExcess = Math.max(0, fiveYearTotal - fiveYearLimit);

  // 더 큰 초과액 적용 (조특법 제133조)
  const exceededAmount = Math.max(annualExcess, fiveYearExcess);
  const limitedAmount = Math.max(0, limitSubjectAmount - exceededAmount);

  logs.push({
    step: 'CALC-RELIEF-LIMIT',
    description: '감면 종합한도 적용 (조특법 제133조)',
    values: {
      requestedAmount: limitSubjectAmount,
      annualLimit,
      fiveYearLimit,
      prevFourYearsUsed,
      annualExcess,
      fiveYearExcess,
      exceededAmount,
      limitedAmount,
    },
  });

  // 한도 적용하여 감면액 조정
  const adjustedReliefs = reliefs.map((relief) => {
    if (!applicableCodes.includes(relief.reliefCode) || exceededAmount === 0) {
      return relief;
    }
    // 비율로 감면액 축소
    const ratio = limitSubjectAmount > 0 ? limitedAmount / limitSubjectAmount : 1;
    return {
      ...relief,
      reliefAmount: roundToWon(relief.reliefAmount * ratio),
    };
  });

  return {
    adjustedReliefs,
    limitResult: {
      annualLimit,
      fiveYearLimit,
      requestedAmount: limitSubjectAmount,
      limitedAmount,
      exceededAmount,
      prevFourYearsUsed,
    },
  };
}

/**
 * 농어촌특별세 계산 (농어촌특별세법 제5조)
 * - 세율: 감면세액의 20%
 * - 비과세: 자경농지, 농지대토 등 농어업 관련 감면
 */
function calculateRuralSpecialTax(
  reliefs: TaxCase['reliefs'],
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): {
  taxableReliefAmount: number;
  exemptReliefAmount: number;
  taxRate: number;
  taxAmount: number;
  details: Array<{
    reliefCode: string;
    reliefName: string;
    reliefAmount: number;
    isExempt: boolean;
    exemptReason?: string;
    ruralTaxAmount: number;
  }>;
} {
  const ruralTaxRules = rulePack.ruralSpecialTax;
  const reliefRules = rulePack.reliefs;
  const taxRate = ruralTaxRules.taxRate.rate;
  const exemptCodes = ruralTaxRules.exemptions.exemptReliefCodes.map(
    (e: { code: string }) => e.code
  );

  let taxableReliefAmount = 0;
  let exemptReliefAmount = 0;
  const details: Array<{
    reliefCode: string;
    reliefName: string;
    reliefAmount: number;
    isExempt: boolean;
    exemptReason?: string;
    ruralTaxAmount: number;
  }> = [];

  for (const relief of reliefs) {
    if (relief.reliefType !== 'TAX' || relief.reliefAmount <= 0) {
      continue;
    }

    // 비과세 여부 확인
    let isExempt = false;
    let exemptReason: string | undefined;

    // 1. 직접 비과세 코드
    if (exemptCodes.includes(relief.reliefCode)) {
      isExempt = true;
      const exemptInfo = ruralTaxRules.exemptions.exemptReliefCodes.find(
        (e: { code: string; reason: string }) => e.code === relief.reliefCode
      );
      exemptReason = exemptInfo?.reason;
    }

    // 2. 사용자가 비과세 체크한 경우
    if (relief.ruralSpecialTaxExempt) {
      isExempt = true;
      exemptReason = exemptReason || '사용자 지정 비과세';
    }

    // 3. 공익사업 수용 중 자경농지인 경우 조건부 비과세
    if (
      relief.reliefCode.startsWith('PUBLIC_') &&
      relief.isSelfFarmLand
    ) {
      isExempt = true;
      exemptReason = '공익사업용 토지 중 자경농지 (농특세법 시행령 제4조)';
    }

    const ruralTaxAmount = isExempt ? 0 : roundToWon(relief.reliefAmount * (taxRate / 100));

    if (isExempt) {
      exemptReliefAmount += relief.reliefAmount;
    } else {
      taxableReliefAmount += relief.reliefAmount;
    }

    details.push({
      reliefCode: relief.reliefCode,
      reliefName: relief.reliefName,
      reliefAmount: relief.reliefAmount,
      isExempt,
      exemptReason,
      ruralTaxAmount,
    });
  }

  const taxAmount = roundToWon(taxableReliefAmount * (taxRate / 100));

  logs.push({
    step: 'CALC-RURAL-TAX',
    description: '농어촌특별세 계산 (농특세법 제5조)',
    values: {
      taxableReliefAmount,
      exemptReliefAmount,
      taxRate,
      taxAmount,
    },
  });

  return {
    taxableReliefAmount,
    exemptReliefAmount,
    taxRate,
    taxAmount,
    details,
  };
}

/**
 * 가산세 계산
 */
function calculatePenalty(
  taxCase: TaxCase,
  taxDueBeforePenalty: number,
  rulePack: ReturnType<typeof getRulePack>,
  logs: CalculationLog[]
): {
  underReport: number;
  latePayment: number;
  other: number;
  total: number;
} {
  if (!taxCase.penaltyInfo) {
    return { underReport: 0, latePayment: 0, other: 0, total: 0 };
  }

  const penaltyRules = rulePack.penalty;
  const info = taxCase.penaltyInfo;

  let underReport = 0;
  let latePayment = 0;

  // 무(과소)신고 가산세
  if (info.underReportType !== 'NONE' && info.underReportBase > 0) {
    let rate = 0;

    switch (info.underReportType) {
      case 'NO_REPORT':
        rate = penaltyRules.underReport.general.noReport;
        break;
      case 'UNDER_REPORT':
        rate = penaltyRules.underReport.general.underReport;
        break;
      case 'UNFAITHFUL_NO':
        rate = penaltyRules.underReport.unfaithful.noReport;
        break;
      case 'UNFAITHFUL_UNDER':
        rate = penaltyRules.underReport.unfaithful.underReport;
        break;
    }

    underReport = roundToWon(info.underReportBase * rate);

    // 기한후/수정신고 감면
    if (info.reductionApplied && info.reportDate && info.dueDate) {
      const daysSinceDue = Math.max(0,
        (new Date(info.reportDate).getTime() - new Date(info.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const period = getReductionPeriod(daysSinceDue);

      let reductionRate = 0;
      if (taxCase.reportType === 'LATE') {
        reductionRate = getLateReportReductionRate(period);
      } else if (taxCase.reportType === 'AMEND') {
        reductionRate = getAmendReportReductionRate(period);
      }

      underReport = roundToWon(underReport * (1 - reductionRate));

      logs.push({
        step: 'CALC-PEN-010-REDUCTION',
        description: '가산세 감면',
        values: {
          period,
          reductionRate,
          reducedUnderReport: underReport,
        },
      });
    }
  }

  // 납부지연 가산세
  if (info.latePaymentDays > 0 && info.latePaymentBase > 0) {
    const days = Math.min(info.latePaymentDays, penaltyRules.latePayment.maxDays);
    latePayment = roundToWon(info.latePaymentBase * penaltyRules.latePayment.dailyRate * days);
  }

  const total = underReport + latePayment;

  logs.push({
    step: 'CALC-PEN-010',
    description: '가산세 계산',
    values: { underReport, latePayment, total },
  });

  return { underReport, latePayment, other: 0, total };
}

/**
 * 메인 계산 함수
 */
export function calculateTaxCase(taxCase: TaxCase): CalculationResult {
  const logs: CalculationLog[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const rulePack = getRulePack(taxCase.taxYear);

  // 1. 자산별 계산
  const assetResults: DerivedAssetResult[] = [];

  // 부표1 자산
  for (const asset of taxCase.bp1Assets) {
    try {
      const result = calculateBP1Asset(asset, rulePack, logs);
      assetResults.push(result);
    } catch (err) {
      errors.push(`BP1 자산 ${asset.id} 계산 오류: ${err}`);
    }
  }

  // 부표2 자산
  for (const asset of taxCase.bp2Assets) {
    try {
      const result = calculateBP2Asset(asset, rulePack, logs);
      assetResults.push(result);
    } catch (err) {
      errors.push(`BP2 자산 ${asset.id} 계산 오류: ${err}`);
    }
  }

  // 부표2의2 파생상품
  if (taxCase.bp2_2) {
    for (const row of taxCase.bp2_2.rows) {
      try {
        const result = calculateBP2_2Row(row, rulePack, logs);
        assetResults.push(result);
      } catch (err) {
        errors.push(`BP2_2 종목 ${row.id} 계산 오류: ${err}`);
      }
    }
  }

  // 2. 양도소득금액 합계 (④)
  const totalGainIncome = assetResults.reduce((sum, r) => sum + r.gainIncome, 0);

  logs.push({
    step: 'CALC-RET-040',
    description: '④ 양도소득금액 합계',
    values: { totalGainIncome },
  });

  // 3. 감면 계산 (⑥, ⑪) - 한도 적용 포함
  // 먼저 감면 한도 적용 (조특법 제133조)
  const { adjustedReliefs, limitResult } = applyReliefLimits(taxCase.reliefs, rulePack, logs);

  let incomeDeductionBase = 0; // 소득차감방식 감면
  let taxReliefTotal = 0;      // 세액감면

  for (const relief of adjustedReliefs) {
    if (relief.reliefType === 'INCOME') {
      incomeDeductionBase += relief.reliefAmount;
    } else {
      taxReliefTotal += relief.reliefAmount;
    }
  }

  logs.push({
    step: 'CALC-RELIEF-001',
    description: '감면 집계 (한도 적용 후)',
    values: { incomeDeductionBase, taxReliefTotal },
  });

  // 4. 기본공제 배분 (⑦)
  const deductionResult = allocateBasicDeduction(assetResults, taxCase, rulePack, logs);
  const updatedAssetResults = deductionResult.results;
  const totalBasicDeduction = deductionResult.total;

  // 5. 산출세액 계산 (⑧, ⑩)
  const taxResult = calculateTax(
    updatedAssetResults,
    totalGainIncome,
    totalBasicDeduction,
    taxCase.adjustments?.prevReportedGainIncome ?? 0,
    incomeDeductionBase,
    rulePack,
    logs
  );

  // 6. 세액공제
  const foreignTaxCredit = taxCase.adjustments?.foreignTaxCredit ?? 0;
  const withholdingCredit = taxCase.adjustments?.withholdingCredit ?? 0;
  const pensionCredit = taxCase.adjustments?.pensionCredit ?? 0;

  // 전자신고세액공제
  let eFilingCredit = 0;
  if (taxCase.flags?.eFiling && !taxCase.flags?.proxyFiling) {
    const creditAmount = rulePack.eFilingCredit.amount;
    const remaining = taxResult.taxBeforeCredits - taxReliefTotal - foreignTaxCredit - withholdingCredit - pensionCredit;
    eFilingCredit = Math.min(creditAmount, Math.max(0, remaining));
  }

  logs.push({
    step: 'CALC-RET-150',
    description: '전자신고세액공제',
    values: { eFilingCredit },
  });

  // 7. 가산세
  const taxDueBeforePenalty = Math.max(0,
    taxResult.taxBeforeCredits - taxReliefTotal - foreignTaxCredit - withholdingCredit - pensionCredit - eFilingCredit
  );
  const penaltyResult = calculatePenalty(taxCase, taxDueBeforePenalty, rulePack, logs);

  // 8. 최종 납부할 세액 (⑱)
  const prevTaxPaid = taxCase.adjustments?.prevTaxPaid ?? 0;
  const taxDue = Math.max(0,
    taxResult.taxBeforeCredits -
    taxReliefTotal -
    foreignTaxCredit -
    withholdingCredit -
    pensionCredit -
    eFilingCredit +
    penaltyResult.total -
    prevTaxPaid
  );

  logs.push({
    step: 'CALC-RET-180',
    description: '⑱ 납부할 세액',
    values: {
      taxBeforeCredits: taxResult.taxBeforeCredits,
      taxRelief: taxReliefTotal,
      foreignTaxCredit,
      withholdingCredit,
      pensionCredit,
      eFilingCredit,
      penalty: penaltyResult.total,
      prevTaxPaid,
      taxDue,
    },
  });

  // 9. 농어촌특별세 계산 (농어촌특별세법 제5조)
  const ruralSpecialTaxResult = calculateRuralSpecialTax(adjustedReliefs, rulePack, logs);

  // 10. 총 납부세액 (양도소득세 + 농어촌특별세)
  const totalTaxDue = taxDue + ruralSpecialTaxResult.taxAmount;

  logs.push({
    step: 'CALC-RET-TOTAL',
    description: '총 납부세액 (양도소득세 + 농특세)',
    values: {
      capitalGainsTax: taxDue,
      ruralSpecialTax: ruralSpecialTaxResult.taxAmount,
      totalTaxDue,
    },
  });

  // 세율구분 집계표
  const rateCategorySummary: DerivedMainResult['rateCategorySummary'] = [];
  const rateGroups = new Map<string, { sum: number; count: number }>();

  for (const result of updatedAssetResults) {
    const existing = rateGroups.get(result.rateCode) ?? { sum: 0, count: 0 };
    rateGroups.set(result.rateCode, {
      sum: existing.sum + result.gainIncome,
      count: existing.count + 1,
    });
  }

  for (const [rateCode, data] of rateGroups) {
    rateCategorySummary.push({
      rateCode,
      gainIncomeSum: data.sum,
      assetCount: data.count,
    });
  }

  // 세율 표기
  let rateLabel = '기본누진세율';
  if (rateCategorySummary.length === 1 && updatedAssetResults.length === 1) {
    const result = updatedAssetResults[0];
    if (result.rateType === 'flat' && result.rateValue) {
      rateLabel = `${result.rateValue}%`;
      if (result.additionalRate && result.additionalRate > 0) {
        rateLabel += `+${result.additionalRate}%p`;
      }
    }
  }

  const mainResult: DerivedMainResult = {
    line04_gainIncomeTotal: totalGainIncome,
    line05_prevReportedGainIncome: taxCase.adjustments?.prevReportedGainIncome ?? 0,
    line06_incomeDeductionBase: incomeDeductionBase,
    line07_basicDeduction: totalBasicDeduction,
    line08_taxBase: taxResult.taxBase,
    line09_rateLabel: rateLabel,
    taxA: taxResult.taxA,
    taxB: taxResult.taxB,
    line10_taxBeforeCredits: taxResult.taxBeforeCredits,
    line11_taxRelief: taxReliefTotal,
    line12_foreignTaxCredit: foreignTaxCredit,
    line13_withholdingCredit: withholdingCredit,
    line14_pensionCredit: pensionCredit,
    line15_eFilingCredit: eFilingCredit,
    penaltyUnderReport: penaltyResult.underReport,
    penaltyLatePayment: penaltyResult.latePayment,
    penaltyOther: penaltyResult.other,
    penaltyTotal: penaltyResult.total,
    line17_prevTaxPaid: prevTaxPaid,
    line18_taxDue: taxDue,
    // 농어촌특별세 (농어촌특별세법 제5조)
    ruralSpecialTax: {
      taxableReliefAmount: ruralSpecialTaxResult.taxableReliefAmount,
      exemptReliefAmount: ruralSpecialTaxResult.exemptReliefAmount,
      taxRate: ruralSpecialTaxResult.taxRate,
      taxAmount: ruralSpecialTaxResult.taxAmount,
      details: ruralSpecialTaxResult.details,
    },
    // 감면한도 적용 결과 (조특법 제133조)
    reliefLimitResult: limitResult,
    // 총 납부세액 (양도소득세 + 농특세)
    totalTaxDue,
    rateCategorySummary,
    basicDeductionByBucket: deductionResult.byBucket,
  };

  return {
    caseId: taxCase.id,
    calculatedAt: new Date().toISOString(),
    assetResults: updatedAssetResults,
    mainResult,
    calculationLog: logs,
    warnings,
    errors,
  };
}
