import React from 'react';
import { useTaxCaseStore } from '../../store';
import { ReportTypeLabels, type ReportType } from '../../schemas';
import { FormField, Select, Button } from '../common';

const reportTypeOptions = Object.entries(ReportTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const currentYear = new Date().getFullYear();
const yearOptions = [
  { value: String(currentYear), label: `${currentYear}년` },
  { value: String(currentYear - 1), label: `${currentYear - 1}년` },
  { value: String(currentYear - 2), label: `${currentYear - 2}년` },
];

export function Step0ReportType() {
  const { currentCase, setReportType, setTaxYear, nextStep } = useTaxCaseStore();

  if (!currentCase) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>신고구분</h2>
        <p className="step-description">
          양도소득세 신고 유형과 귀속연도를 선택하세요.
        </p>
      </div>

      <div className="step-content">
        <FormField
          label="신고구분"
          required
          tooltip="예정신고: 양도일이 속하는 달의 말일부터 2개월 이내 / 확정신고: 다음해 5월"
          evidence={{
            text: '소득세법 제105조, 제110조',
            url: 'https://www.law.go.kr/법령/소득세법',
          }}
        >
          <Select
            value={currentCase.reportType}
            onChange={(v) => setReportType(v as ReportType)}
            options={reportTypeOptions}
          />
        </FormField>

        <FormField
          label="귀속연도"
          required
          tooltip="양도일이 속하는 연도"
        >
          <Select
            value={String(currentCase.taxYear)}
            onChange={(v) => setTaxYear(parseInt(v, 10))}
            options={yearOptions}
          />
        </FormField>

        {currentCase.reportType === 'LATE' && (
          <div className="notice notice-warning">
            <strong>기한후신고 안내</strong>
            <p>
              법정 신고기한이 경과한 후 신고하는 경우 무신고 가산세가 부과되나,
              조기 신고 시 감면 혜택이 있습니다. (국세기본법 제48조)
            </p>
          </div>
        )}

        {currentCase.reportType === 'AMEND' && (
          <div className="notice notice-info">
            <strong>수정신고 안내</strong>
            <p>
              이미 신고한 내용에 오류가 있는 경우 수정신고를 통해 정정할 수 있습니다.
              과소신고 가산세가 부과될 수 있으나 조기 수정 시 감면됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <Button type="submit" variant="primary">
          다음: 신고인 정보
        </Button>
      </div>
    </form>
  );
}
