import React from 'react';
import { useTaxCaseStore } from '../../store';
import type { PenaltyInfo } from '../../schemas';
import { FormField, Select, NumberInput, DateInput, Checkbox, Button } from '../common';

const underReportTypeOptions = [
  { value: 'NONE', label: '해당없음' },
  { value: 'NO_REPORT', label: '일반 무신고 (20%)' },
  { value: 'UNDER_REPORT', label: '일반 과소신고 (10%)' },
  { value: 'UNFAITHFUL_NO', label: '부당 무신고 (40%)' },
  { value: 'UNFAITHFUL_UNDER', label: '부당 과소신고 (40%)' },
];

export function Step5Penalty() {
  const {
    currentCase,
    setPenaltyInfo,
    setAdjustments,
    setFlags,
    nextStep,
    prevStep,
  } = useTaxCaseStore();

  if (!currentCase) return null;

  const penaltyInfo: PenaltyInfo = currentCase.penaltyInfo ?? {
    underReportType: 'NONE',
    underReportBase: 0,
    latePaymentDays: 0,
    latePaymentBase: 0,
    reductionApplied: false,
  };

  const adjustments = currentCase.adjustments ?? {
    prevReportedGainIncome: 0,
    foreignTaxCredit: 0,
    withholdingCredit: 0,
    pensionCredit: 0,
    prevTaxPaid: 0,
  };

  const flags = currentCase.flags ?? {
    eFiling: true,
    proxyFiling: false,
  };

  const isLateOrAmend = currentCase.reportType === 'LATE' || currentCase.reportType === 'AMEND';

  const handlePenaltyChange = (updates: Partial<PenaltyInfo>) => {
    setPenaltyInfo({ ...penaltyInfo, ...updates });
  };

  const handleAdjustmentChange = (field: keyof typeof adjustments, value: number) => {
    setAdjustments({ ...adjustments, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>가산세 및 조정</h2>
        <p className="step-description">
          기한후/수정신고 가산세와 기타 조정 항목을 입력하세요.
        </p>
      </div>

      <div className="step-content">
        {/* 가산세 (기한후/수정신고인 경우만) */}
        {isLateOrAmend && (
          <section className="form-section">
            <h3>가산세 (⑯)</h3>

            <div className="form-row">
              <FormField
                label="무(과소)신고 유형"
                tooltip="일반: 20%/10%, 부당: 40%"
                evidence={{ text: '국세기본법 제47조의2~3' }}
              >
                <Select
                  value={penaltyInfo.underReportType}
                  onChange={(v) => handlePenaltyChange({ underReportType: v as PenaltyInfo['underReportType'] })}
                  options={underReportTypeOptions}
                />
              </FormField>

              <FormField label="가산세 기준 세액">
                <NumberInput
                  value={penaltyInfo.underReportBase}
                  onChange={(v) => handlePenaltyChange({ underReportBase: v })}
                />
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="납부지연 일수" tooltip="납부기한 다음날부터 납부일까지">
                <NumberInput
                  value={penaltyInfo.latePaymentDays}
                  onChange={(v) => handlePenaltyChange({ latePaymentDays: v })}
                  unit="일"
                  min={0}
                  max={365}
                />
              </FormField>

              <FormField label="납부지연 기준 세액">
                <NumberInput
                  value={penaltyInfo.latePaymentBase}
                  onChange={(v) => handlePenaltyChange({ latePaymentBase: v })}
                />
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="법정 신고기한">
                <DateInput
                  value={penaltyInfo.dueDate ?? ''}
                  onChange={(v) => handlePenaltyChange({ dueDate: v })}
                />
              </FormField>

              <FormField label="실제 신고일">
                <DateInput
                  value={penaltyInfo.reportDate ?? ''}
                  onChange={(v) => handlePenaltyChange({ reportDate: v })}
                />
              </FormField>
            </div>

            <Checkbox
              checked={penaltyInfo.reductionApplied}
              onChange={(v) => handlePenaltyChange({ reductionApplied: v })}
              label="조기신고 감면 적용 (국세기본법 제48조)"
              tooltip="신고기한 경과 후 일정 기간 내 신고 시 가산세 감면"
            />

            {penaltyInfo.reductionApplied && (
              <div className="notice notice-info">
                <strong>가산세 감면율 안내</strong>
                <ul>
                  <li>기한후신고: 1개월 내 50%, 3개월 내 30%, 6개월 내 20%, 1년 내 10%</li>
                  <li>수정신고: 1개월 내 90%, 3개월 내 75%, 6개월 내 50%, 1년 내 30%</li>
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 기타 조정 항목 */}
        <section className="form-section">
          <h3>기타 조정 항목</h3>

          <div className="form-row">
            <FormField
              label="⑤ 기신고 양도소득금액"
              tooltip="이미 신고한 양도소득금액 (수정신고 시)"
            >
              <NumberInput
                value={adjustments.prevReportedGainIncome}
                onChange={(v) => handleAdjustmentChange('prevReportedGainIncome', v)}
              />
            </FormField>

            <FormField
              label="⑰ 기신고 세액"
              tooltip="이미 납부한 세액"
            >
              <NumberInput
                value={adjustments.prevTaxPaid}
                onChange={(v) => handleAdjustmentChange('prevTaxPaid', v)}
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="⑫ 외국납부세액공제">
              <NumberInput
                value={adjustments.foreignTaxCredit}
                onChange={(v) => handleAdjustmentChange('foreignTaxCredit', v)}
              />
            </FormField>

            <FormField label="⑬ 원천징수세액공제">
              <NumberInput
                value={adjustments.withholdingCredit}
                onChange={(v) => handleAdjustmentChange('withholdingCredit', v)}
              />
            </FormField>
          </div>

          <FormField label="⑭ 연금계좌세액공제">
            <NumberInput
              value={adjustments.pensionCredit}
              onChange={(v) => handleAdjustmentChange('pensionCredit', v)}
            />
          </FormField>
        </section>

        {/* 전자신고 공제 */}
        <section className="form-section">
          <h3>전자신고세액공제 (⑮)</h3>

          <Checkbox
            checked={flags.eFiling}
            onChange={(v) => setFlags({ ...flags, eFiling: v })}
            label="전자신고 (홈택스 등)"
            tooltip="전자신고 시 2만원 공제"
          />

          {flags.eFiling && (
            <Checkbox
              checked={flags.proxyFiling}
              onChange={(v) => setFlags({ ...flags, proxyFiling: v })}
              label="대리신고"
              tooltip="대리신고 시 전자신고세액공제 미적용"
            />
          )}

          {flags.eFiling && !flags.proxyFiling && (
            <div className="notice notice-info">
              <p>본인 전자신고 시 전자신고세액공제 20,000원이 적용됩니다.</p>
            </div>
          )}
        </section>
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button type="submit" variant="primary">
          다음: 계산 결과
        </Button>
      </div>
    </form>
  );
}
