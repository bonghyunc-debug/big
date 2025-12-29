import React from 'react';
import { FormField, NumberInput, DateInput, Checkbox, Select } from '../common';
import { TransferAcquireTypeLabels, type TransferAcquireType, type BP1Asset } from '../../schemas';
import { calculateHoldingYears } from '../../data/taxRules';

const acquireCauseOptions = Object.entries(TransferAcquireTypeLabels)
  .filter(([key]) => !['61', '62', '63', '64', '65'].includes(key)) // 주식 관련 제외
  .map(([value, label]) => ({ value, label }));

interface InheritanceDetailFormProps {
  asset: BP1Asset;
  onUpdate: (updates: Partial<BP1Asset>) => void;
}

/**
 * 상속자산 상세 정보 폼
 * 법적 근거:
 * - 소득세법 제97조: 취득가액 계산
 * - 소득세법 시행령 제162조: 취득시기 (상속개시일)
 * - 소득세법 시행령 제163조: 상속자산 취득가액 (상속세 평가액)
 * - 소득세법 제95조 제4항: 장기보유특별공제 보유기간 (상속개시일부터)
 * - 시행령 제154조: 1세대1주택 비과세 (동일세대 보유/거주기간 통산)
 */
export function InheritanceDetailForm({ asset, onUpdate }: InheritanceDetailFormProps) {
  const inheritanceInfo = asset.inheritanceInfo ?? {
    enabled: false,
    inheritanceDate: undefined,
    decedentAcquireDate: undefined,
    decedentAcquireCost: 0,
    inheritanceTaxValue: 0,
    sameHousehold: false,
    decedentHoldingYears: 0,
    decedentResidenceYears: 0,
    businessSuccession: false,
  };

  const handleUpdate = (updates: Partial<typeof inheritanceInfo>) => {
    onUpdate({
      inheritanceInfo: { ...inheritanceInfo, ...updates },
    });
  };

  // 피상속인 보유기간 자동 계산
  const decedentHoldingYearsCalc = React.useMemo(() => {
    if (inheritanceInfo.decedentAcquireDate && inheritanceInfo.inheritanceDate) {
      return calculateHoldingYears(inheritanceInfo.decedentAcquireDate, inheritanceInfo.inheritanceDate);
    }
    return 0;
  }, [inheritanceInfo.decedentAcquireDate, inheritanceInfo.inheritanceDate]);

  // 상속인 보유기간 자동 계산 (상속개시일 ~ 양도일)
  const inheritorHoldingYears = React.useMemo(() => {
    if (inheritanceInfo.inheritanceDate && asset.transferDate) {
      return calculateHoldingYears(inheritanceInfo.inheritanceDate, asset.transferDate);
    }
    return 0;
  }, [inheritanceInfo.inheritanceDate, asset.transferDate]);

  // 세율적용 보유기간 (피상속인 취득일 ~ 양도일)
  const rateHoldingYears = React.useMemo(() => {
    if (inheritanceInfo.decedentAcquireDate && asset.transferDate) {
      return calculateHoldingYears(inheritanceInfo.decedentAcquireDate, asset.transferDate);
    }
    return 0;
  }, [inheritanceInfo.decedentAcquireDate, asset.transferDate]);

  if (!inheritanceInfo.enabled) {
    return (
      <div className="form-section">
        <h5>상속자산 정보 (소득세법 시행령 제162조, 제163조)</h5>
        <Checkbox
          checked={inheritanceInfo.enabled}
          onChange={(v) => handleUpdate({ enabled: v })}
          label="상속으로 취득한 자산입니다"
          tooltip="피상속인(사망자)으로부터 상속받은 자산"
        />
      </div>
    );
  }

  return (
    <div className="form-section inheritance-form">
      <h5>상속자산 정보 (소득세법 시행령 제162조, 제163조)</h5>
      <Checkbox
        checked={inheritanceInfo.enabled}
        onChange={(v) => handleUpdate({ enabled: v })}
        label="상속으로 취득한 자산입니다"
        tooltip="피상속인(사망자)으로부터 상속받은 자산"
      />

      <div className="notice notice-info" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem' }}>
          <strong>상속자산 세무처리:</strong><br />
          • <strong>취득시기:</strong> 상속개시일 (피상속인 사망일) - 시행령 제162조 제1항 제5호<br />
          • <strong>취득가액:</strong> 상속세 평가액 - 시행령 제163조 제9항<br />
          • <strong>장특공 보유기간:</strong> 상속개시일부터 기산 - 소득세법 제95조 제4항<br />
          • <strong>세율적용 보유기간:</strong> 피상속인 취득일부터 기산 - 시행령 제162조 (단기양도 판정)<br />
          • <strong>1세대1주택:</strong> 동일세대인 경우 피상속인 보유/거주기간 통산 - 시행령 제154조 제6항
        </p>
      </div>

      <div className="form-row">
        <FormField
          label="상속개시일 (피상속인 사망일)"
          required
          tooltip="상속세 신고서의 상속개시일"
          evidence={{ text: '소득세법 시행령 제162조 제1항 제5호' }}
        >
          <DateInput
            value={inheritanceInfo.inheritanceDate ?? ''}
            onChange={(v) => handleUpdate({ inheritanceDate: v })}
            max={asset.transferDate || undefined}
          />
        </FormField>

        <FormField
          label="피상속인 취득일"
          tooltip="피상속인(사망자)이 해당 자산을 취득한 날짜"
          evidence={{ text: '시행령 제162조 (세율적용 보유기간)' }}
        >
          <DateInput
            value={inheritanceInfo.decedentAcquireDate ?? ''}
            onChange={(v) => handleUpdate({ decedentAcquireDate: v })}
            max={inheritanceInfo.inheritanceDate || undefined}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField
          label="피상속인 취득원인"
          tooltip="피상속인이 해당 자산을 어떻게 취득했는지"
        >
          <Select
            value={inheritanceInfo.decedentAcquireCause ?? '11'}
            onChange={(v) => handleUpdate({ decedentAcquireCause: v as TransferAcquireType })}
            options={acquireCauseOptions}
          />
        </FormField>

        <FormField
          label="피상속인 취득가액"
          tooltip="피상속인이 취득할 당시 지급한 금액 (참고용)"
        >
          <NumberInput
            value={inheritanceInfo.decedentAcquireCost}
            onChange={(v) => handleUpdate({ decedentAcquireCost: v })}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField
          label="상속세 평가액 (취득가액)"
          required
          tooltip="상속세 신고 시 평가한 가액 (이 금액이 취득가액으로 적용됨)"
          evidence={{ text: '소득세법 시행령 제163조 제9항' }}
        >
          <NumberInput
            value={inheritanceInfo.inheritanceTaxValue}
            onChange={(v) => handleUpdate({ inheritanceTaxValue: v })}
          />
        </FormField>
      </div>

      {/* 보유기간 계산 결과 */}
      {inheritanceInfo.inheritanceDate && (
        <div className="calculated-info-box" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h6 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>보유기간 자동 계산</h6>
          <div style={{ fontSize: '0.85rem' }}>
            <p><strong>장특공 보유기간 (상속개시일~양도일):</strong> {inheritorHoldingYears}년</p>
            {inheritanceInfo.decedentAcquireDate && (
              <>
                <p><strong>세율적용 보유기간 (피상속인 취득일~양도일):</strong> {rateHoldingYears}년
                  {rateHoldingYears >= 2 ? ' → 장기양도' : ' → 단기양도 주의'}
                </p>
                <p><strong>피상속인 보유기간:</strong> {decedentHoldingYearsCalc}년</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="form-section-divider" style={{ marginTop: '1.5rem' }}>
        <h6>1세대1주택 비과세 관련 (시행령 제154조 제6항)</h6>
      </div>

      <Checkbox
        checked={inheritanceInfo.sameHousehold}
        onChange={(v) => handleUpdate({ sameHousehold: v })}
        label="피상속인과 상속개시 당시 동일세대원이었습니다"
        tooltip="동일세대인 경우 피상속인의 보유/거주기간 통산 가능"
      />

      {inheritanceInfo.sameHousehold && (
        <div className="notice notice-success" style={{ marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem' }}>
            동일세대 상속: 피상속인의 보유/거주기간을 상속인의 보유/거주기간에 통산합니다.<br />
            아래에 피상속인의 보유/거주기간을 입력하세요.
          </p>
        </div>
      )}

      {inheritanceInfo.sameHousehold && (
        <div className="form-row" style={{ marginTop: '0.5rem' }}>
          <FormField
            label="피상속인 보유기간 (년)"
            tooltip="피상속인이 해당 주택을 보유한 기간"
          >
            <NumberInput
              value={inheritanceInfo.decedentHoldingYears}
              onChange={(v) => handleUpdate({ decedentHoldingYears: v })}
            />
          </FormField>

          <FormField
            label="피상속인 거주기간 (년)"
            tooltip="피상속인이 해당 주택에 거주한 기간"
          >
            <NumberInput
              value={inheritanceInfo.decedentResidenceYears}
              onChange={(v) => handleUpdate({ decedentResidenceYears: v })}
            />
          </FormField>
        </div>
      )}

      {!inheritanceInfo.sameHousehold && (
        <div className="notice notice-warning" style={{ marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem' }}>
            별도세대 상속: 피상속인의 보유/거주기간이 통산되지 않습니다.<br />
            상속인의 보유/거주기간만으로 비과세 요건을 판정합니다.
          </p>
        </div>
      )}

      <div className="form-section-divider" style={{ marginTop: '1.5rem' }}>
        <h6>가업상속 (조세특례제한법 제30조의6)</h6>
      </div>

      <Checkbox
        checked={inheritanceInfo.businessSuccession}
        onChange={(v) => handleUpdate({ businessSuccession: v })}
        label="가업상속공제를 적용받은 자산입니다"
        tooltip="가업상속공제 적용 시 장특공 보유기간은 피상속인 취득일부터 기산"
      />

      {inheritanceInfo.businessSuccession && (
        <div className="notice notice-info" style={{ marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem' }}>
            가업상속 특례: 장기보유특별공제 보유기간을 피상속인 취득일부터 기산합니다.
            (소득세법 제95조 제4항 단서)
          </p>
        </div>
      )}
    </div>
  );
}
