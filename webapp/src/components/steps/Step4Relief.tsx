import React from 'react';
import { useTaxCaseStore } from '../../store';
import type { Relief } from '../../schemas';
import { FormField, Select, NumberInput, Button, Checkbox } from '../common';
import { getRulePack } from '../../rules';

const reliefTypeOptions = [
  { value: 'TAX', label: '세액감면' },
  { value: 'INCOME', label: '소득차감' },
];

// reliefs.json에서 감면 코드 로드
const rulePack = getRulePack(2024);
const reliefRules = rulePack.reliefs;
const reliefCodeOptions = [
  { value: 'NONE', label: '해당없음' },
  ...Object.entries(reliefRules.reliefCodes).map(([code, data]: [string, any]) => ({
    value: code,
    label: `${data.name} (${data.legalBasis})`,
    data,
  })),
  { value: 'OTHER', label: '기타 감면' },
];

// 감면 정보 조회
function getReliefInfo(code: string): any | null {
  return (reliefRules.reliefCodes as Record<string, any>)[code] ?? null;
}

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
    limitGroup: undefined,
    prevYearReliefUsed: 0,
    ruralSpecialTaxExempt: false,
    isSelfFarmLand: false,
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
  const reliefInfo = getReliefInfo(relief.reliefCode);

  const handleCodeChange = (code: string) => {
    const info = getReliefInfo(code);
    const opt = reliefCodeOptions.find(o => o.value === code);

    if (info) {
      // 법정 감면율과 법적근거 자동 설정
      const newAmount = Math.round(relief.baseAmount * (info.reliefRate / 100));
      onUpdate({
        reliefCode: code,
        reliefName: info.name,
        reliefRate: info.reliefRate,
        reliefAmount: newAmount,
        legalBasis: info.legalBasis,
        limitGroup: info.limitGroup,
        ruralSpecialTaxExempt: info.ruralSpecialTaxExempt ?? false,
      });
    } else {
      onUpdate({
        reliefCode: code,
        reliefName: opt?.label ?? '',
        legalBasis: '',
        limitGroup: undefined,
        ruralSpecialTaxExempt: false,
      });
    }
  };

  const handleRateChange = (rate: number) => {
    const amount = Math.round(relief.baseAmount * (rate / 100));
    onUpdate({ reliefRate: rate, reliefAmount: amount });
  };

  const handleBaseAmountChange = (base: number) => {
    const amount = Math.round(base * (relief.reliefRate / 100));
    onUpdate({ baseAmount: base, reliefAmount: amount });
  };

  // 한도 대상 여부
  const isLimitSubject = reliefInfo?.annualLimit !== null && reliefInfo?.annualLimit !== undefined;

  // 농특세 관련 표시 여부
  const showRuralTaxOptions = relief.reliefType === 'TAX' && relief.reliefCode !== 'NONE';

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
              onChange={handleCodeChange}
              options={reliefCodeOptions}
            />
          </FormField>
        </div>

        {/* 감면 요건 안내 */}
        {reliefInfo && (
          <div className="notice notice-info" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <strong>{reliefInfo.description}</strong>
            {reliefInfo.requirements && (
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                {reliefInfo.requirements.map((req: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.85rem' }}>{req}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="form-row">
          <FormField label="감면 방식" tooltip="세액감면: 산출세액에서 차감 / 소득차감: 양도소득금액에서 차감">
            <Select
              value={relief.reliefType}
              onChange={(v) => onUpdate({ reliefType: v as 'TAX' | 'INCOME' })}
              options={reliefTypeOptions}
            />
          </FormField>

          <FormField label="감면율 (%)" tooltip={reliefInfo ? `법정감면율: ${reliefInfo.reliefRate}%` : undefined}>
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
          <FormField label="감면대상금액" tooltip="감면을 적용할 기준 금액 (산출세액)">
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

        {/* 감면 한도 관련 (조특법 제133조 대상) */}
        {isLimitSubject && (
          <div className="form-section" style={{ marginTop: '1rem' }}>
            <h5 style={{ marginBottom: '0.5rem' }}>감면 종합한도 (조특법 제133조)</h5>
            <div className="notice notice-warning" style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem' }}>
                연간 한도: {(reliefInfo.annualLimit / 100000000).toFixed(0)}억원 /
                5년 한도: {(reliefInfo.fiveYearLimit / 100000000).toFixed(0)}억원
              </p>
            </div>
            <FormField
              label="직전 4년 감면 사용액"
              tooltip="같은 감면 종류로 직전 4개 과세기간에 감면받은 세액 합계"
            >
              <NumberInput
                value={relief.prevYearReliefUsed ?? 0}
                onChange={(v) => onUpdate({ prevYearReliefUsed: v })}
              />
            </FormField>
          </div>
        )}

        {/* 농어촌특별세 관련 */}
        {showRuralTaxOptions && (
          <div className="form-section" style={{ marginTop: '1rem' }}>
            <h5 style={{ marginBottom: '0.5rem' }}>농어촌특별세 (농특세법 제5조)</h5>

            {reliefInfo?.ruralSpecialTaxExempt ? (
              <div className="notice notice-success" style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem' }}>
                  ✓ 농특세 비과세 대상 ({reliefInfo.ruralSpecialTaxExemptReason || '농어업 관련 감면'})
                </p>
              </div>
            ) : (
              <div className="notice notice-info" style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem' }}>
                  농특세 과세 대상: 감면세액의 20%
                </p>
              </div>
            )}

            {/* 공익사업 수용의 경우 자경농지 여부 체크 */}
            {relief.reliefCode.startsWith('PUBLIC_') && (
              <div style={{ marginTop: '0.5rem' }}>
                <Checkbox
                  checked={relief.isSelfFarmLand ?? false}
                  onChange={(checked) => onUpdate({
                    isSelfFarmLand: checked,
                    ruralSpecialTaxExempt: checked, // 자경농지면 농특세 비과세
                  })}
                  label="자경농지 여부 (8년 요건 불문, 농특세 비과세)"
                />
              </div>
            )}

            {/* 수동으로 농특세 비과세 설정 */}
            {!reliefInfo?.ruralSpecialTaxExempt && !relief.reliefCode.startsWith('PUBLIC_') && (
              <div style={{ marginTop: '0.5rem' }}>
                <Checkbox
                  checked={relief.ruralSpecialTaxExempt ?? false}
                  onChange={(checked) => onUpdate({ ruralSpecialTaxExempt: checked })}
                  label="농특세 비과세 대상 (해당하는 경우 체크)"
                />
              </div>
            )}
          </div>
        )}
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

        {/* 감면 종합한도 안내 */}
        <div className="notice notice-info" style={{ marginTop: '1rem' }}>
          <strong>감면 종합한도 (조특법 제133조)</strong>
          <p style={{ fontSize: '0.9rem' }}>
            자경농지, 농지대토 등 농어업 관련 감면은 연간 1억원, 5년간 2억원 한도가 적용됩니다.
            한도 초과 시 초과분은 감면이 배제됩니다.
          </p>
        </div>

        {/* 농어촌특별세 안내 */}
        <div className="notice notice-info" style={{ marginTop: '1rem' }}>
          <strong>농어촌특별세 (농특세법 제5조)</strong>
          <p style={{ fontSize: '0.9rem' }}>
            세액감면을 받는 경우 감면세액의 20%를 농어촌특별세로 납부해야 합니다.
            단, 자경농지·농지대토 등 농어업 관련 감면은 농특세가 비과세됩니다.
          </p>
        </div>

        <div className="asset-list" style={{ marginTop: '1.5rem' }}>
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
