/**
 * 자산 입력 검증 모듈
 * 법적 근거에 따른 비즈니스 로직 검증
 */

import type { BP1Asset, BP2Asset, TaxCase } from '../../schemas';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  legalBasis?: string;
}

/**
 * 날짜 검증
 * - 취득일 < 양도일
 * - 상속개시일 ≤ 양도일
 * - 증여일 ≤ 양도일
 */
export function validateDates(asset: BP1Asset): ValidationError[] {
  const errors: ValidationError[] = [];

  // 취득일/양도일 필수
  if (!asset.acquireDate) {
    errors.push({
      field: 'acquireDate',
      message: '취득일을 입력하세요.',
      severity: 'error',
    });
  }

  if (!asset.transferDate) {
    errors.push({
      field: 'transferDate',
      message: '양도일을 입력하세요.',
      severity: 'error',
    });
  }

  // 취득일 < 양도일
  if (asset.acquireDate && asset.transferDate && asset.acquireDate > asset.transferDate) {
    errors.push({
      field: 'acquireDate',
      message: '취득일이 양도일보다 늦을 수 없습니다.',
      severity: 'error',
      legalBasis: '소득세법 시행령 제162조',
    });
  }

  // 상속 관련 날짜 검증
  if (asset.inheritanceInfo?.enabled) {
    if (!asset.inheritanceInfo.inheritanceDate) {
      errors.push({
        field: 'inheritanceInfo.inheritanceDate',
        message: '상속개시일을 입력하세요.',
        severity: 'error',
      });
    }

    if (asset.inheritanceInfo.inheritanceDate && asset.transferDate &&
        asset.inheritanceInfo.inheritanceDate > asset.transferDate) {
      errors.push({
        field: 'inheritanceInfo.inheritanceDate',
        message: '상속개시일이 양도일보다 늦을 수 없습니다.',
        severity: 'error',
      });
    }

    if (asset.inheritanceInfo.decedentAcquireDate && asset.inheritanceInfo.inheritanceDate &&
        asset.inheritanceInfo.decedentAcquireDate > asset.inheritanceInfo.inheritanceDate) {
      errors.push({
        field: 'inheritanceInfo.decedentAcquireDate',
        message: '피상속인 취득일이 상속개시일보다 늦을 수 없습니다.',
        severity: 'error',
      });
    }
  }

  // 이월과세 날짜 검증
  if (asset.carryoverTax?.enabled) {
    if (!asset.carryoverTax.giftDate) {
      errors.push({
        field: 'carryoverTax.giftDate',
        message: '증여일을 입력하세요.',
        severity: 'error',
      });
    }

    if (asset.carryoverTax.giftDate && asset.transferDate &&
        asset.carryoverTax.giftDate > asset.transferDate) {
      errors.push({
        field: 'carryoverTax.giftDate',
        message: '증여일이 양도일보다 늦을 수 없습니다.',
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * 금액 검증
 * - 양도가액 > 0
 * - 취득가액 합리성 경고
 * - 필요경비 합계 ≤ 양도가액
 */
export function validateAmounts(asset: BP1Asset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (asset.transferPrice <= 0) {
    errors.push({
      field: 'transferPrice',
      message: '양도가액을 입력하세요.',
      severity: 'error',
    });
  }

  if (asset.acquirePrice <= 0) {
    errors.push({
      field: 'acquirePrice',
      message: '취득가액을 입력하세요.',
      severity: 'error',
    });
  }

  // 양도차손 경고
  if (asset.acquirePrice > asset.transferPrice && asset.transferPrice > 0) {
    errors.push({
      field: 'acquirePrice',
      message: '취득가액이 양도가액보다 큽니다. 양도차손이 발생합니다.',
      severity: 'warning',
    });
  }

  // 필요경비 합계 검증
  if (asset.bp3) {
    const acquireCostsTotal =
      asset.bp3.acquireCosts.r111_purchasePrice +
      asset.bp3.acquireCosts.r112_acquisitionTax +
      asset.bp3.acquireCosts.r113_registrationTax +
      asset.bp3.acquireCosts.r114_lawyerFee +
      asset.bp3.acquireCosts.r115_brokerFee +
      asset.bp3.acquireCosts.r116_other;

    const expensesTotal =
      asset.bp3.expenses.r210_capitalExpense +
      asset.bp3.expenses.r220_transferExpense +
      asset.bp3.expenses.r250_filingFee +
      asset.bp3.expenses.r260_lawyerFee +
      asset.bp3.expenses.r270_notaryFee +
      asset.bp3.expenses.r280_stampDuty +
      asset.bp3.expenses.r290_other;

    const totalExpense = acquireCostsTotal + expensesTotal;

    if (totalExpense > asset.transferPrice) {
      errors.push({
        field: 'bp3',
        message: '필요경비 합계가 양도가액을 초과합니다. 입력을 확인하세요.',
        severity: 'warning',
      });
    }
  }

  // 상속세 평가액 검증
  if (asset.inheritanceInfo?.enabled && asset.inheritanceInfo.inheritanceTaxValue <= 0) {
    errors.push({
      field: 'inheritanceInfo.inheritanceTaxValue',
      message: '상속세 평가액을 입력하세요. (취득가액으로 적용됨)',
      severity: 'error',
      legalBasis: '소득세법 시행령 제163조 제9항',
    });
  }

  // 이월과세 증여자 취득가액 검증
  if (asset.carryoverTax?.enabled && asset.carryoverTax.donorAcquireCost <= 0) {
    errors.push({
      field: 'carryoverTax.donorAcquireCost',
      message: '증여자 취득가액을 입력하세요.',
      severity: 'error',
      legalBasis: '소득세법 제97조의2',
    });
  }

  return errors;
}

/**
 * 1세대1주택 비과세 요건 검증
 * 법적 근거: 소득세법 시행령 제154조
 */
export function validateOneHouseExemption(asset: BP1Asset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!asset.userFlags.oneHouseExemption) {
    return errors;
  }

  // 주택 자산인지 확인
  const housingAssetTypes = ['4', '5']; // 주택, 다세대
  if (!housingAssetTypes.includes(asset.assetTypeCode)) {
    errors.push({
      field: 'userFlags.oneHouseExemption',
      message: '1세대1주택 비과세는 주택에만 적용됩니다.',
      severity: 'warning',
    });
  }

  // 보유기간 2년 이상 확인
  if (asset.acquireDate && asset.transferDate) {
    const acquireDate = new Date(asset.acquireDate);
    const transferDate = new Date(asset.transferDate);
    const holdingMs = transferDate.getTime() - acquireDate.getTime();
    const holdingYears = holdingMs / (1000 * 60 * 60 * 24 * 365.25);

    if (holdingYears < 2) {
      const detail = asset.oneHouseExemptionDetail;
      const hasExemptReason = detail?.holdingExemptReason && detail.holdingExemptReason !== 'NONE';

      if (!hasExemptReason) {
        errors.push({
          field: 'holdingYears',
          message: `보유기간 ${holdingYears.toFixed(1)}년으로 2년 미달입니다. 면제사유가 없으면 비과세 불가합니다.`,
          severity: 'warning',
          legalBasis: '시행령 제154조 제1항',
        });
      }
    }
  }

  // 조정대상지역 거주요건 확인
  if (asset.adjustedAreaInfo?.acquiredInAdjustedArea) {
    const detail = asset.oneHouseExemptionDetail;
    const totalResidence = (detail?.actualResidenceYears ?? 0) + (detail?.inheritedResidenceYears ?? 0);
    const hasResidenceExempt = detail?.residenceExemptReason && detail.residenceExemptReason !== 'NONE';

    if (totalResidence < 2 && !hasResidenceExempt) {
      errors.push({
        field: 'oneHouseExemptionDetail.actualResidenceYears',
        message: '조정대상지역 취득 주택은 거주기간 2년 이상 필요합니다.',
        severity: 'warning',
        legalBasis: '시행령 제154조 제1항',
      });
    }
  }

  return errors;
}

/**
 * 이월과세 요건 검증
 * 법적 근거: 소득세법 제97조의2
 */
export function validateCarryoverTax(asset: BP1Asset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!asset.carryoverTax?.enabled) {
    return errors;
  }

  // 증여자 관계 확인
  if (!asset.carryoverTax.donorRelation) {
    errors.push({
      field: 'carryoverTax.donorRelation',
      message: '증여자 관계를 선택하세요.',
      severity: 'error',
    });
  }

  // 이월과세 기간 검증
  if (asset.carryoverTax.giftDate && asset.transferDate) {
    const giftDate = new Date(asset.carryoverTax.giftDate);
    const transferDate = new Date(asset.transferDate);
    const elapsedMs = transferDate.getTime() - giftDate.getTime();
    const elapsedYears = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);

    const amendmentDate = new Date('2023-01-01');
    const periodYears = giftDate >= amendmentDate ? 10 : 5;

    if (elapsedYears > periodYears) {
      errors.push({
        field: 'carryoverTax',
        message: `증여일로부터 ${elapsedYears.toFixed(1)}년 경과로 이월과세 기간(${periodYears}년)을 초과했습니다. 이월과세가 적용되지 않습니다.`,
        severity: 'warning',
        legalBasis: '소득세법 제97조의2',
      });
    }
  }

  // 적용배제 사유 선택 시 경고
  if (asset.carryoverTax.exclusionReason && asset.carryoverTax.exclusionReason !== 'NONE') {
    errors.push({
      field: 'carryoverTax.exclusionReason',
      message: '적용배제 사유로 인해 이월과세가 적용되지 않습니다.',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * 다주택 중과 검증
 */
export function validateMultiHomeSurtax(asset: BP1Asset): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!asset.userFlags.multiHomeSurtax) {
    return errors;
  }

  if (asset.userFlags.multiHomeCount < 2) {
    errors.push({
      field: 'userFlags.multiHomeCount',
      message: '다주택 중과 적용 시 보유 주택 수를 2채 이상 입력하세요.',
      severity: 'error',
    });
  }

  // 조정대상지역 확인
  if (!asset.adjustedAreaInfo?.currentlyAdjustedArea && !asset.userFlags.adjustedArea) {
    errors.push({
      field: 'adjustedAreaInfo',
      message: '다주택 중과는 조정대상지역 소재 주택에만 적용됩니다.',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * BP1 자산 전체 검증
 */
export function validateBP1Asset(asset: BP1Asset, index: number): ValidationError[] {
  const prefix = `자산 ${index + 1}: `;
  const allErrors: ValidationError[] = [];

  const dateErrors = validateDates(asset);
  const amountErrors = validateAmounts(asset);
  const oneHouseErrors = validateOneHouseExemption(asset);
  const carryoverErrors = validateCarryoverTax(asset);
  const multiHomeErrors = validateMultiHomeSurtax(asset);

  [...dateErrors, ...amountErrors, ...oneHouseErrors, ...carryoverErrors, ...multiHomeErrors].forEach((error) => {
    allErrors.push({
      ...error,
      message: prefix + error.message,
    });
  });

  return allErrors;
}

/**
 * BP2 주식 자산 검증
 */
export function validateBP2Asset(asset: BP2Asset, index: number): ValidationError[] {
  const prefix = `주식 ${index + 1}: `;
  const errors: ValidationError[] = [];

  if (!asset.issuerName) {
    errors.push({
      field: 'issuerName',
      message: prefix + '종목명을 입력하세요.',
      severity: 'error',
    });
  }

  if (!asset.transferDate) {
    errors.push({
      field: 'transferDate',
      message: prefix + '양도일을 입력하세요.',
      severity: 'error',
    });
  }

  if (asset.transferPrice <= 0) {
    errors.push({
      field: 'transferPrice',
      message: prefix + '양도가액을 입력하세요.',
      severity: 'error',
    });
  }

  if (asset.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: prefix + '수량을 입력하세요.',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * 전체 케이스 검증
 */
export function validateTaxCase(taxCase: TaxCase): ValidationError[] {
  const allErrors: ValidationError[] = [];

  // 신고인 검증
  if (!taxCase.taxpayer.name) {
    allErrors.push({
      field: 'taxpayer.name',
      message: '신고인 성명을 입력하세요.',
      severity: 'error',
    });
  }

  if (!taxCase.taxpayer.rrn) {
    allErrors.push({
      field: 'taxpayer.rrn',
      message: '주민등록번호를 입력하세요.',
      severity: 'error',
    });
  }

  // 자산이 하나도 없으면 경고
  if (taxCase.bp1Assets.length === 0 && taxCase.bp2Assets.length === 0) {
    allErrors.push({
      field: 'assets',
      message: '최소 1개 이상의 자산을 입력하세요.',
      severity: 'error',
    });
  }

  // BP1 자산 검증
  taxCase.bp1Assets.forEach((asset, idx) => {
    allErrors.push(...validateBP1Asset(asset, idx));
  });

  // BP2 자산 검증
  taxCase.bp2Assets.forEach((asset, idx) => {
    allErrors.push(...validateBP2Asset(asset, idx));
  });

  return allErrors;
}

/**
 * 오류만 필터링
 */
export function getErrors(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.severity === 'error');
}

/**
 * 경고만 필터링
 */
export function getWarnings(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.severity === 'warning');
}
