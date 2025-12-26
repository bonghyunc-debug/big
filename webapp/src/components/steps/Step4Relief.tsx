import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTaxCaseStore } from '../../store';
import type { Relief } from '../../schemas';
import { FormField, Select, NumberInput, Button } from '../common';

const reliefTypeOptions = [
  { value: 'TAX', label: '세액감면' },
  { value: 'INCOME', label: '소득차감' },
];

// 대표적인 감면 코드 (실제로는 더 많음)
const reliefCodeOptions = [
  { value: 'NONE', label: '해당없음' },
  { value: 'EXPRO', label: '공익사업수용 감면 (조특법 77조)' },
  { value: 'AGRI', label: '농지대토 감면 (조특법 70조)' },
  { value: 'RURAL', label: '자경농지 감면 (조특법 69조)' },
  { value: 'FOREST', label: '산림지 감면' },
  { value: 'SME', label: '중소기업 특례' },
  { value: 'VENTURE', label: '벤처기업 주식 감면' },
  { value: 'OTHER', label: '기타 감면' },
];

function createEmptyRelief(assetId: string): Omit<Relief, 'id'> {
  return {
    assetId,
    reliefCode: 'NONE',
    reliefName: '',
    reliefType: 'TAX',
    reliefRate: 0,
    reliefAmount: 0,
    baseAmount: 0,
    legalBasis: '',
  };
}

interface ReliefFormProps {
  relief: Relief;
  onUpdate: (updates: Partial<Relief>) => void;
  onRemove: () => void;
  index: number;
  assetOptions: { value: string; label: string }[];
}

function ReliefForm({ relief, onUpdate, onRemove, index, assetOptions }: ReliefFormProps) {
  const handleRateChange = (rate: number) => {
    const amount = Math.round(relief.baseAmount * (rate / 100));
    onUpdate({ reliefRate: rate, reliefAmount: amount });
  };

  const handleBaseAmountChange = (base: number) => {
    const amount = Math.round(base * (relief.reliefRate / 100));
    onUpdate({ baseAmount: base, reliefAmount: amount });
  };

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <h4>감면 {index + 1}</h4>
        <Button variant="danger" size="sm" onClick={onRemove}>
          삭제
        </Button>
      </div>

      <div className="asset-card-body">
        <div className="form-row">
          <FormField label="대상 자산" required>
            <Select
              value={relief.assetId}
              onChange={(v) => onUpdate({ assetId: v })}
              options={assetOptions}
            />
          </FormField>

          <FormField label="감면 종류" required>
            <Select
              value={relief.reliefCode}
              onChange={(v) => {
                const opt = reliefCodeOptions.find(o => o.value === v);
                onUpdate({ reliefCode: v, reliefName: opt?.label ?? '' });
              }}
              options={reliefCodeOptions}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="감면 방식" tooltip="세액감면: 산출세액에서 차감 / 소득차감: 양도소득금액에서 차감">
            <Select
              value={relief.reliefType}
              onChange={(v) => onUpdate({ reliefType: v as 'TAX' | 'INCOME' })}
              options={reliefTypeOptions}
            />
          </FormField>

          <FormField label="감면율 (%)">
            <NumberInput
              value={relief.reliefRate}
              onChange={handleRateChange}
              unit="%"
              min={0}
              max={100}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="감면대상금액" tooltip="감면을 적용할 기준 금액">
            <NumberInput
              value={relief.baseAmount}
              onChange={handleBaseAmountChange}
            />
          </FormField>

          <FormField label="감면액">
            <NumberInput
              value={relief.reliefAmount}
              onChange={(v) => onUpdate({ reliefAmount: v })}
            />
          </FormField>
        </div>

        <FormField label="법적근거">
          <input
            type="text"
            className="text-input"
            value={relief.legalBasis ?? ''}
            onChange={(e) => onUpdate({ legalBasis: e.target.value })}
            placeholder="조세특례제한법 제77조"
          />
        </FormField>
      </div>
    </div>
  );
}

export function Step4Relief() {
  const {
    currentCase,
    addRelief,
    updateRelief,
    removeRelief,
    nextStep,
    prevStep,
  } = useTaxCaseStore();

  if (!currentCase) return null;

  // 자산 옵션 생성
  const assetOptions = [
    ...currentCase.bp1Assets.map((a, i) => ({
      value: a.id,
      label: `부동산 ${i + 1}: ${a.assetTypeCode} (${a.transferPrice.toLocaleString()}원)`,
    })),
    ...currentCase.bp2Assets.map((a, i) => ({
      value: a.id,
      label: `주식 ${i + 1}: ${a.issuerName}`,
    })),
  ];

  const handleAddRelief = () => {
    const firstAssetId = assetOptions[0]?.value ?? '';
    if (!firstAssetId) {
      alert('먼저 자산을 입력하세요.');
      return;
    }
    addRelief(createEmptyRelief(firstAssetId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>감면/공제</h2>
        <p className="step-description">
          양도소득세 감면 대상이 있는 경우 입력하세요.
        </p>
      </div>

      <div className="step-content">
        <div className="notice notice-warning">
          <strong>감면 적용 안내</strong>
          <p>
            감면 요건 충족 여부는 사용자가 직접 판단해야 합니다.
            이 앱은 입력된 감면 정보에 따라 계산만 수행합니다.
            정확한 감면 적용을 위해 세무 전문가 상담을 권장합니다.
          </p>
        </div>

        <div className="asset-list">
          {currentCase.reliefs.map((relief, idx) => (
            <ReliefForm
              key={relief.id}
              relief={relief}
              index={idx}
              assetOptions={assetOptions}
              onUpdate={(updates) => updateRelief(relief.id, updates)}
              onRemove={() => removeRelief(relief.id)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleAddRelief}
          disabled={assetOptions.length === 0}
        >
          + 감면 추가
        </Button>

        {currentCase.reliefs.length === 0 && (
          <div className="notice notice-info" style={{ marginTop: '1rem' }}>
            <p>
              감면 대상이 없으면 이 단계를 건너뛰어도 됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button type="submit" variant="primary">
          다음: 가산세/조정
        </Button>
      </div>
    </form>
  );
}
