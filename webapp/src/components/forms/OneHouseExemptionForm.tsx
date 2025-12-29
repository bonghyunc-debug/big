import React from 'react';
import { FormField, NumberInput, Select, Checkbox } from '../common';
import type { BP1Asset } from '../../schemas';
import { isHighValueHousing } from '../../data/taxRules';

interface OneHouseExemptionFormProps {
  asset: BP1Asset;
  onUpdate: (updates: Partial<BP1Asset>) => void;
}

const holdingExemptReasonOptions = [
  { value: 'NONE', label: '해당없음' },
  { value: 'OVERSEAS_EMIGRATION', label: '해외이주 (출국일부터 2년 내 양도)' },
  { value: 'OVERSEAS_WORK_STUDY', label: '해외 1년 이상 취학/근무' },
  { value: 'RENTAL_HOUSING_RESIDENCE', label: '건설임대주택 5년 거주' },
];

const residenceExemptReasonOptions = [
  { value: 'NONE', label: '해당없음' },
  { value: 'WORK_STUDY_ILLNESS', label: '취학/근무/질병 사유로 1년 이상 거주' },
  { value: 'PRE_ADJUSTED_AREA_CONTRACT', label: '조정지역 고시 전 계약 (무주택자)' },
];

const temporaryExemptReasonOptions = [
  { value: 'NONE', label: '해당없음 (일반 1세대1주택)' },
  { value: 'TEMPORARY_2HOUSE', label: '일시적 2주택 (종전주택 3년 내 양도)' },
  { value: 'INHERITED_HOUSE', label: '상속주택 (5년 내 양도 또는 일반주택 먼저 양도)' },
  { value: 'MARRIAGE_MERGE', label: '혼인합가 (5년 내 양도)' },
  { value: 'ELDERLY_CARE', label: '동거봉양 합가 (10년 내 양도)' },
  { value: 'RURAL_RELOCATION', label: '귀농 (5년 내 양도)' },
];

/**
 * 1세대1주택 비과세 상세 검증 폼
 * 법적 근거: 소득세법 제89조 제1항 제3호, 시행령 제154조
 *
 * 비과세 요건:
 * 1. 1세대 1주택
 * 2. 보유기간 2년 이상 (2017.8.3 이후 취득 조정지역 주택은 거주기간 2년 필요)
 * 3. 양도가액 12억원 이하 (초과 시 초과분만 과세)
 */
export function OneHouseExemptionForm({ asset, onUpdate }: OneHouseExemptionFormProps) {
  const detail = asset.oneHouseExemptionDetail ?? {
    enabled: false,
    actualHoldingYears: 0,
    actualResidenceYears: 0,
    inheritedHoldingYears: 0,
    inheritedResidenceYears: 0,
    holdingExemptReason: 'NONE' as const,
    residenceExemptReason: 'NONE' as const,
    temporaryExemptReason: 'NONE' as const,
  };

  const handleUpdate = (updates: Partial<typeof detail>) => {
    onUpdate({
      oneHouseExemptionDetail: { ...detail, ...updates },
    });
  };

  // 비과세 요건 충족 여부 계산
  const totalHoldingYears = detail.actualHoldingYears + detail.inheritedHoldingYears;
  const totalResidenceYears = detail.actualResidenceYears + detail.inheritedResidenceYears;

  const isAdjustedAreaAcquired = asset.adjustedAreaInfo?.acquiredInAdjustedArea ?? false;
  const needsResidence = isAdjustedAreaAcquired; // 조정지역 취득 시 거주요건 필요

  // 보유요건 면제 여부
  const holdingExempt = detail.holdingExemptReason !== 'NONE';
  // 거주요건 면제 여부
  const residenceExempt = detail.residenceExemptReason !== 'NONE';

  // 요건 충족 판정
  const holdingOk = holdingExempt || totalHoldingYears >= 2;
  const residenceOk = !needsResidence || residenceExempt || totalResidenceYears >= 2;
  const allRequirementsMet = holdingOk && residenceOk;

  const isHighValue = isHighValueHousing(asset.transferPrice);

  if (!asset.userFlags.oneHouseExemption) {
    return null;
  }

  return (
    <div className="form-section one-house-exemption-form">
      <h5>1세대1주택 비과세 상세 (소득세법 시행령 제154조)</h5>

      <div className="notice notice-info" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem' }}>
          <strong>비과세 요건 (시행령 제154조):</strong><br />
          • 보유기간 2년 이상<br />
          • 조정대상지역 취득 주택: 보유기간 2년 + 거주기간 2년<br />
          • 양도가액 12억원 초과 시: 초과분만 과세 (고가주택 안분)<br />
          • 일시적 2주택 등 특례 적용 가능
        </p>
      </div>

      <Checkbox
        checked={detail.enabled}
        onChange={(v) => handleUpdate({ enabled: v })}
        label="상세 비과세 요건 검증 활성화"
        tooltip="1세대1주택 비과세 요건을 상세하게 검증합니다"
      />

      {detail.enabled && (
        <>
          <div className="form-section-divider" style={{ marginTop: '1rem' }}>
            <h6>실제 보유/거주 기간</h6>
          </div>

          <div className="form-row">
            <FormField
              label="실제 보유기간 (년)"
              required
              tooltip="본인이 해당 주택을 보유한 기간"
            >
              <NumberInput
                value={detail.actualHoldingYears}
                onChange={(v) => handleUpdate({ actualHoldingYears: v })}
                min={0}
              />
            </FormField>

            <FormField
              label="실제 거주기간 (년)"
              tooltip="본인이 해당 주택에 거주한 기간"
            >
              <NumberInput
                value={detail.actualResidenceYears}
                onChange={(v) => handleUpdate({ actualResidenceYears: v })}
                min={0}
              />
            </FormField>
          </div>

          {/* 상속 통산 */}
          {asset.inheritanceInfo?.enabled && asset.inheritanceInfo?.sameHousehold && (
            <>
              <div className="form-section-divider" style={{ marginTop: '1rem' }}>
                <h6>피상속인 기간 통산 (동일세대 상속)</h6>
              </div>

              <div className="form-row">
                <FormField
                  label="피상속인 보유기간 통산 (년)"
                  tooltip="동일세대 피상속인의 보유기간"
                >
                  <NumberInput
                    value={detail.inheritedHoldingYears}
                    onChange={(v) => handleUpdate({ inheritedHoldingYears: v })}
                    min={0}
                  />
                </FormField>

                <FormField
                  label="피상속인 거주기간 통산 (년)"
                  tooltip="동일세대 피상속인의 거주기간"
                >
                  <NumberInput
                    value={detail.inheritedResidenceYears}
                    onChange={(v) => handleUpdate({ inheritedResidenceYears: v })}
                    min={0}
                  />
                </FormField>
              </div>
            </>
          )}

          {/* 합계 표시 */}
          <div className="calculated-info-box" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>
              <strong>합계 보유기간:</strong> {totalHoldingYears}년
              {totalHoldingYears >= 2 ? ' ✓' : ' (2년 미달)'}
              <br />
              <strong>합계 거주기간:</strong> {totalResidenceYears}년
              {needsResidence ? (totalResidenceYears >= 2 ? ' ✓' : ' (2년 미달)') : ' (거주요건 불요)'}
            </p>
          </div>

          <div className="form-section-divider" style={{ marginTop: '1.5rem' }}>
            <h6>요건 면제 사유</h6>
          </div>

          <div className="form-row">
            <FormField
              label="보유요건 면제 사유"
              tooltip="2년 보유요건을 갖추지 못해도 비과세되는 사유"
              evidence={{ text: '시행령 제154조 제1항 제1호~제3호' }}
            >
              <Select
                value={detail.holdingExemptReason}
                onChange={(v) => handleUpdate({ holdingExemptReason: v as typeof detail.holdingExemptReason })}
                options={holdingExemptReasonOptions}
              />
            </FormField>

            <FormField
              label="거주요건 면제 사유"
              tooltip="조정지역 2년 거주요건을 갖추지 못해도 비과세되는 사유"
              evidence={{ text: '시행령 제154조 제1항 제5호' }}
            >
              <Select
                value={detail.residenceExemptReason}
                onChange={(v) => handleUpdate({ residenceExemptReason: v as typeof detail.residenceExemptReason })}
                options={residenceExemptReasonOptions}
              />
            </FormField>
          </div>

          <div className="form-section-divider" style={{ marginTop: '1.5rem' }}>
            <h6>일시적 2주택 등 특례</h6>
          </div>

          <FormField
            label="다주택 특례 사유"
            tooltip="일시적으로 2주택 이상을 보유하게 된 경우의 비과세 특례"
            evidence={{ text: '시행령 제155조, 제155조의2' }}
          >
            <Select
              value={detail.temporaryExemptReason}
              onChange={(v) => handleUpdate({ temporaryExemptReason: v as typeof detail.temporaryExemptReason })}
              options={temporaryExemptReasonOptions}
            />
          </FormField>

          {detail.temporaryExemptReason !== 'NONE' && (
            <div className="notice notice-info" style={{ marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem' }}>
                {detail.temporaryExemptReason === 'TEMPORARY_2HOUSE' && (
                  <>
                    <strong>일시적 2주택:</strong> 신규주택 취득 후 3년 이내에 종전주택 양도 시 비과세<br />
                    (조정지역: 취득 후 1~2년 이내, 정확한 기간은 취득시기에 따라 다름)
                  </>
                )}
                {detail.temporaryExemptReason === 'INHERITED_HOUSE' && (
                  <>
                    <strong>상속주택:</strong><br />
                    • 일반주택을 먼저 양도하는 경우: 상속주택은 주택 수 제외<br />
                    • 상속주택을 양도하는 경우: 상속개시일로부터 5년 이내 양도 시 비과세
                  </>
                )}
                {detail.temporaryExemptReason === 'MARRIAGE_MERGE' && (
                  <>
                    <strong>혼인합가:</strong> 혼인일로부터 5년 이내에 먼저 양도하는 주택 비과세
                  </>
                )}
                {detail.temporaryExemptReason === 'ELDERLY_CARE' && (
                  <>
                    <strong>동거봉양 합가:</strong> 합가일로부터 10년 이내에 먼저 양도하는 주택 비과세<br />
                    (60세 이상 직계존속 동거봉양 목적)
                  </>
                )}
                {detail.temporaryExemptReason === 'RURAL_RELOCATION' && (
                  <>
                    <strong>귀농:</strong> 귀농일로부터 5년 이내에 종전주택 양도 시 비과세
                  </>
                )}
              </p>
            </div>
          )}

          {/* 최종 판정 결과 */}
          <div
            className={`notice ${allRequirementsMet ? 'notice-success' : 'notice-error'}`}
            style={{ marginTop: '1.5rem' }}
          >
            <h6 style={{ margin: '0 0 0.5rem 0' }}>비과세 요건 판정 결과</h6>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>
              {allRequirementsMet ? (
                <>
                  <strong>✓ 1세대1주택 비과세 요건 충족</strong>
                  {isHighValue && (
                    <>
                      <br />
                      <span style={{ color: '#d97706' }}>
                        ※ 양도가액 12억원 초과 (고가주택): 12억원 초과분에 대해서만 과세
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <strong>✗ 비과세 요건 미충족</strong>
                  <br />
                  {!holdingOk && <span>• 보유기간 2년 미달<br /></span>}
                  {needsResidence && !residenceOk && <span>• 거주기간 2년 미달 (조정지역 취득)<br /></span>}
                  <span style={{ color: '#666', fontSize: '0.85rem' }}>
                    요건 면제 사유가 있으면 위에서 선택하세요.
                  </span>
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
