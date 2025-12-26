import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTaxCaseStore } from '../../store';
import {
  AssetTypeLabels,
  AcquirePriceTypeLabels,
  LtDeductionCodeLabels,
  TransferAcquireTypeLabels,
  type AssetTypeCode,
  type AcquirePriceType,
  type LtDeductionCode,
  type TransferAcquireType,
  type BP1Asset,
} from '../../schemas';
import { FormField, Select, NumberInput, DateInput, Checkbox, Button } from '../common';

const assetTypeOptions = Object.entries(AssetTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const acquirePriceTypeOptions = Object.entries(AcquirePriceTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const ltDeductionOptions = Object.entries(LtDeductionCodeLabels).map(([value, label]) => ({
  value,
  label,
}));

const transferAcquireOptions = Object.entries(TransferAcquireTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

// 세율구분코드 옵션 (간략화)
const rateCodeOptions = [
  { value: '1-10', label: '1-10 토지/건물(일반)' },
  { value: '1-11', label: '1-11 비사업용토지' },
  { value: '1-15', label: '1-15 1년미만 보유' },
  { value: '1-21', label: '1-21 1-2년 보유' },
  { value: '1-35', label: '1-35 미등기 부동산' },
  { value: '1-38', label: '1-38 분양권 1년미만' },
  { value: '1-39', label: '1-39 분양권 1-2년' },
  { value: '1-40', label: '1-40 분양권 2년이상' },
  { value: '1-46', label: '1-46 조정대상 2주택' },
  { value: '1-47', label: '1-47 조정대상 3주택이상' },
  { value: '1-50', label: '1-50 주택 1년미만' },
  { value: '1-51', label: '1-51 주택 1-2년' },
  { value: '1-52', label: '1-52 주택 2년이상' },
];

function createEmptyBP1Asset(): Omit<BP1Asset, 'id'> {
  return {
    rateCode: '1-10',
    assetTypeCode: '1' as AssetTypeCode,
    transferDate: '',
    acquireDate: '',
    transferPrice: 0,
    acquirePrice: 0,
    acquirePriceType: 'ACTUAL' as AcquirePriceType,
    ltDeductionCode: '02' as LtDeductionCode,
    userFlags: {
      unregistered: false,
      nonBusinessLand: false,
      multiHomeSurtax: false,
      multiHomeCount: 0,
      adjustedArea: false,
      oneHouseExemption: false,
      highValueHousing: false,
    },
    bp3: {
      acquireCosts: {
        r111_purchasePrice: 0,
        r112_acquisitionTax: 0,
        r113_registrationTax: 0,
        r114_lawyerFee: 0,
        r115_brokerFee: 0,
        r116_other: 0,
      },
      expenses: {
        r210_capitalExpense: 0,
        r220_transferExpense: 0,
        r250_filingFee: 0,
        r260_lawyerFee: 0,
        r270_notaryFee: 0,
        r280_stampDuty: 0,
        r290_other: 0,
      },
    },
  };
}

interface AssetFormProps {
  asset: BP1Asset;
  onUpdate: (updates: Partial<BP1Asset>) => void;
  onRemove: () => void;
  index: number;
}

function AssetForm({ asset, onUpdate, onRemove, index }: AssetFormProps) {
  const [showBP3, setShowBP3] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <h4>자산 {index + 1}</h4>
        <Button variant="danger" size="sm" onClick={onRemove}>
          삭제
        </Button>
      </div>

      <div className="asset-card-body">
        <div className="form-row">
          <FormField
            label="세율구분코드"
            required
            tooltip="자산 유형과 보유기간에 따른 세율구분"
            evidence={{ text: '별지 제84호서식 작성방법 p3-4' }}
          >
            <Select
              value={asset.rateCode}
              onChange={(v) => onUpdate({ rateCode: v })}
              options={rateCodeOptions}
            />
          </FormField>

          <FormField
            label="자산종류"
            required
          >
            <Select
              value={asset.assetTypeCode}
              onChange={(v) => onUpdate({ assetTypeCode: v as AssetTypeCode })}
              options={assetTypeOptions}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="양도일" required>
            <DateInput
              value={asset.transferDate}
              onChange={(v) => onUpdate({ transferDate: v })}
              max={new Date().toISOString().split('T')[0]}
            />
          </FormField>

          <FormField label="취득일" required>
            <DateInput
              value={asset.acquireDate}
              onChange={(v) => onUpdate({ acquireDate: v })}
              max={asset.transferDate || undefined}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="양도가액" required tooltip="실제 양도한 가액">
            <NumberInput
              value={asset.transferPrice}
              onChange={(v) => onUpdate({ transferPrice: v })}
            />
          </FormField>

          <FormField label="취득가액" required>
            <NumberInput
              value={asset.acquirePrice}
              onChange={(v) => onUpdate({ acquirePrice: v })}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField
            label="취득가액 종류"
            tooltip="실지거래가액/환산취득가액/기준시가 등"
            evidence={{ text: '소득세법 제97조' }}
          >
            <Select
              value={asset.acquirePriceType}
              onChange={(v) => onUpdate({ acquirePriceType: v as AcquirePriceType })}
              options={acquirePriceTypeOptions}
            />
          </FormField>

          <FormField
            label="장기보유특별공제"
            tooltip="1세대1주택/일반/배제 등"
            evidence={{ text: '소득세법 제95조' }}
          >
            <Select
              value={asset.ltDeductionCode}
              onChange={(v) => onUpdate({ ltDeductionCode: v as LtDeductionCode })}
              options={ltDeductionOptions}
            />
          </FormField>
        </div>

        {/* 사용자 판정 플래그 */}
        <div className="user-flags-section">
          <h5>판정 입력 (사용자 확인 필요)</h5>
          <p className="hint">아래 항목은 세법상 요건 충족 여부를 사용자가 직접 판단하여 체크하세요.</p>

          <div className="checkbox-group">
            <Checkbox
              checked={asset.userFlags.unregistered}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, unregistered: v },
                })
              }
              label="미등기 양도"
              tooltip="취득 후 등기 없이 양도한 경우 (70% 단일세율, 기본공제 배제)"
            />

            <Checkbox
              checked={asset.userFlags.nonBusinessLand}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, nonBusinessLand: v },
                })
              }
              label="비사업용 토지"
              tooltip="사업과 관련 없이 보유한 토지 (누진세율 + 10%p 가산)"
            />

            <Checkbox
              checked={asset.userFlags.multiHomeSurtax}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, multiHomeSurtax: v },
                })
              }
              label="다주택 중과 대상"
              tooltip="조정대상지역 다주택자 중과세율 적용 대상"
            />

            <Checkbox
              checked={asset.userFlags.oneHouseExemption}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, oneHouseExemption: v },
                })
              }
              label="1세대1주택 비과세 대상"
              tooltip="보유기간 2년(거주기간 요건 포함) 이상 1세대1주택"
            />

            {asset.userFlags.oneHouseExemption && (
              <Checkbox
                checked={asset.userFlags.highValueHousing}
                onChange={(v) =>
                  onUpdate({
                    userFlags: { ...asset.userFlags, highValueHousing: v },
                  })
                }
                label="고가주택 (양도가액 12억 초과)"
                tooltip="양도가액이 12억원을 초과하는 경우 초과분에 대해서만 과세"
              />
            )}
          </div>
        </div>

        {/* 부표3 필요경비 */}
        <div className="collapsible-section">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setShowBP3(!showBP3)}
          >
            <span>필요경비 명세 (부표3)</span>
            <span className="arrow">{showBP3 ? '▼' : '▶'}</span>
          </button>

          {showBP3 && asset.bp3 && (
            <div className="collapsible-content">
              <h5>취득가액 항목</h5>
              <div className="form-row">
                <FormField label="매입가액">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r111_purchasePrice}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r111_purchasePrice: v },
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="취득세">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r112_acquisitionTax}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r112_acquisitionTax: v },
                        },
                      })
                    }
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="법무사비용">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r114_lawyerFee}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r114_lawyerFee: v },
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="취득중개수수료">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r115_brokerFee}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r115_brokerFee: v },
                        },
                      })
                    }
                  />
                </FormField>
              </div>

              <h5>기타 필요경비</h5>
              <div className="form-row">
                <FormField label="자본적지출액" tooltip="증축, 개량 등 자본화된 지출">
                  <NumberInput
                    value={asset.bp3.expenses.r210_capitalExpense}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r210_capitalExpense: v },
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="양도비 (중개수수료 등)">
                  <NumberInput
                    value={asset.bp3.expenses.r220_transferExpense}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r220_transferExpense: v },
                        },
                      })
                    }
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        {/* 고급 옵션 (환산취득가액, 부담부증여, 이월과세) */}
        <div className="collapsible-section">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span>고급 옵션 (환산취득가액/부담부증여/이월과세)</span>
            <span className="arrow">{showAdvanced ? '▼' : '▶'}</span>
          </button>

          {showAdvanced && (
            <div className="collapsible-content">
              {asset.acquirePriceType === 'CONVERTED' && (
                <>
                  <h5>환산취득가액 계산용 기준시가</h5>
                  <p className="hint">환산취득가액 = 양도가액 × (취득시 기준시가 / 양도시 기준시가)</p>
                  <div className="form-row">
                    <FormField label="양도시 기준시가-건물">
                      <NumberInput
                        value={asset.stdValueTransferBuilding ?? 0}
                        onChange={(v) => onUpdate({ stdValueTransferBuilding: v })}
                      />
                    </FormField>
                    <FormField label="양도시 기준시가-토지">
                      <NumberInput
                        value={asset.stdValueTransferLand ?? 0}
                        onChange={(v) => onUpdate({ stdValueTransferLand: v })}
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField label="취득시 기준시가-건물">
                      <NumberInput
                        value={asset.stdValueAcquireBuilding ?? 0}
                        onChange={(v) => onUpdate({ stdValueAcquireBuilding: v })}
                      />
                    </FormField>
                    <FormField label="취득시 기준시가-토지">
                      <NumberInput
                        value={asset.stdValueAcquireLand ?? 0}
                        onChange={(v) => onUpdate({ stdValueAcquireLand: v })}
                      />
                    </FormField>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Step2Assets() {
  const {
    currentCase,
    addBP1Asset,
    updateBP1Asset,
    removeBP1Asset,
    nextStep,
    prevStep,
  } = useTaxCaseStore();

  if (!currentCase) return null;

  const handleAddAsset = () => {
    addBP1Asset(createEmptyBP1Asset());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentCase.bp1Assets.length === 0 && currentCase.bp2Assets.length === 0) {
      alert('최소 1개 이상의 자산을 입력하세요.');
      return;
    }
    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>자산 입력 (부동산/권리)</h2>
        <p className="step-description">
          양도한 부동산 및 권리 자산 정보를 입력하세요. (부표1 연계)
        </p>
      </div>

      <div className="step-content">
        <div className="asset-list">
          {currentCase.bp1Assets.map((asset, idx) => (
            <AssetForm
              key={asset.id}
              asset={asset}
              index={idx}
              onUpdate={(updates) => updateBP1Asset(asset.id, updates)}
              onRemove={() => removeBP1Asset(asset.id)}
            />
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={handleAddAsset}>
          + 자산 추가
        </Button>

        {currentCase.bp1Assets.length === 0 && (
          <div className="notice notice-info">
            <p>
              양도한 자산이 없으면 '자산 추가' 버튼을 눌러 자산 정보를 입력하세요.
              주식/파생상품은 다음 단계에서 입력합니다.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button type="submit" variant="primary">
          다음: 주식/파생상품
        </Button>
      </div>
    </form>
  );
}
