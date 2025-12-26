import React from 'react';
import { useTaxCaseStore } from '../../store';
import { TaxpayerSchema } from '../../schemas';
import { FormField, Button } from '../common';

export function Step1Taxpayer() {
  const { currentCase, setTaxpayer, nextStep, prevStep } = useTaxCaseStore();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  if (!currentCase) return null;

  const { taxpayer } = currentCase;

  const handleChange = (field: keyof typeof taxpayer, value: string) => {
    setTaxpayer({ ...taxpayer, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = TaxpayerSchema.safeParse(taxpayer);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>신고인 정보</h2>
        <p className="step-description">
          양도소득세 신고서에 기재될 신고인(납세자) 정보를 입력하세요.
        </p>
      </div>

      <div className="step-content">
        <FormField
          label="성명"
          required
          error={errors.name}
        >
          <input
            type="text"
            className="text-input"
            value={taxpayer.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="홍길동"
          />
        </FormField>

        <FormField
          label="주민등록번호"
          required
          tooltip="13자리 숫자 (예: 800101-1234567)"
          error={errors.rrn}
        >
          <input
            type="text"
            className="text-input"
            value={taxpayer.rrn}
            onChange={(e) => handleChange('rrn', e.target.value)}
            placeholder="000000-0000000"
            maxLength={14}
          />
        </FormField>

        <FormField
          label="주소"
          required
          error={errors.address}
        >
          <input
            type="text"
            className="text-input"
            value={taxpayer.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="서울특별시 강남구 ..."
          />
        </FormField>

        <FormField
          label="전화번호"
          tooltip="연락 가능한 전화번호"
        >
          <input
            type="tel"
            className="text-input"
            value={taxpayer.phone ?? ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="010-1234-5678"
          />
        </FormField>

        <FormField
          label="전자우편"
          error={errors.email}
        >
          <input
            type="email"
            className="text-input"
            value={taxpayer.email ?? ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="example@email.com"
          />
        </FormField>
      </div>

      <div className="notice notice-info">
        <strong>개인정보 보호 안내</strong>
        <p>
          입력하신 정보는 로컬 브라우저에만 저장되며, 외부로 전송되지 않습니다.
          PDF 출력 시 주민등록번호는 마스킹 처리 옵션을 제공합니다.
        </p>
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button type="submit" variant="primary">
          다음: 자산 입력
        </Button>
      </div>
    </form>
  );
}
