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
import {
  calculateHoldingYears,
  calculateFilingDeadline,
  isHighValueHousing,
  isAdjustmentArea,
  suggestRateCode,
  suggestLtDeductionCode,
  isMultiHomeSurtaxSuspended,
  ONE_HOUSE_EXEMPTION_CHECKLIST,
} from '../../data/taxRules';

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

// 세율구분코드 전체 옵션
const rateCodeOptions = [
  { value: '1-10', label: '1-10 토지/건물(일반)' },
  { value: '1-11', label: '1-11 비사업용토지' },
  { value: '1-15', label: '1-15 1년미만 부동산 (50%)' },
  { value: '1-20', label: '1-20 토지/건물 2-3년' },
  { value: '1-21', label: '1-21 1-2년 부동산 (40%)' },
  { value: '1-23', label: '1-23 조합원입주권 1년미만' },
  { value: '1-30', label: '1-30 조합원입주권(장기)' },
  { value: '1-35', label: '1-35 미등기 부동산 (70%)' },
  { value: '1-36', label: '1-36 미등기 권리 (70%)' },
  { value: '1-38', label: '1-38 분양권 1년미만 (50%)' },
  { value: '1-39', label: '1-39 분양권 1-2년 (40%)' },
  { value: '1-40', label: '1-40 분양권 2년이상' },
  { value: '1-46', label: '1-46 조정대상 2주택' },
  { value: '1-47', label: '1-47 조정대상 3주택이상' },
  { value: '1-50', label: '1-50 주택 1년미만 (50%)' },
  { value: '1-51', label: '1-51 주택 1-2년 (40%)' },
  { value: '1-52', label: '1-52 주택 2년이상' },
  { value: '1-53', label: '1-53 조정2주택 1년미만' },
  { value: '1-54', label: '1-54 조정2주택 1-2년' },
  { value: '1-55', label: '1-55 조정3주택 1년미만' },
  { value: '1-56', label: '1-56 조정3주택 1-2년' },
  { value: '1-57', label: '1-57 주택외 일반' },
  { value: '1-58', label: '1-58 기타자산' },
  { value: '1-70', label: '1-70 특정주식' },
  { value: '1-71', label: '1-71 부동산과다법인주식' },
  { value: '1-82', label: '1-82 신탁수익권' },
  { value: '1-87', label: '1-87 기타권리' },
  { value: '1-92', label: '1-92 영업권등' },
  { value: '1-95', label: '1-95 국외부동산' },
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
    location: '',
    area: 0,
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
  const [showExemptionChecklist, setShowExemptionChecklist] = React.useState(false);

  // 자동 계산값
  const holdingYears = asset.acquireDate && asset.transferDate
    ? calculateHoldingYears(asset.acquireDate, asset.transferDate)
    : 0;

  const filingDeadline = asset.transferDate
    ? calculateFilingDeadline(asset.transferDate, 'realEstate')
    : null;

  const isHighValue = isHighValueHousing(asset.transferPrice);
  const isInAdjustedArea = asset.location ? isAdjustmentArea(asset.location, asset.transferDate || new Date().toISOString()) : false;
  const isSurtaxSuspended = asset.transferDate ? isMultiHomeSurtaxSuspended(asset.transferDate) : false;

  // 세율코드 추천
  const suggestedRate = React.useMemo(() => {
    if (!asset.acquireDate || !asset.transferDate) return null;
    return suggestRateCode({
      assetTypeCode: asset.assetTypeCode,
      holdingYears,
      isUnregistered: asset.userFlags.unregistered,
      isNonBusinessLand: asset.userFlags.nonBusinessLand,
      isMultiHomeSurtax: asset.userFlags.multiHomeSurtax,
      multiHomeCount: asset.userFlags.multiHomeCount,
      isAdjustedArea: isInAdjustedArea || asset.userFlags.adjustedArea,
      transferDate: asset.transferDate,
    });
  }, [asset, holdingYears, isInAdjustedArea]);

  // 장특공 추천
  const suggestedLtDeduction = React.useMemo(() => {
    return suggestLtDeductionCode({
      assetTypeCode: asset.assetTypeCode,
      isOneHouseExemption: asset.userFlags.oneHouseExemption,
      isUnregistered: asset.userFlags.unregistered,
      isNonBusinessLand: asset.userFlags.nonBusinessLand,
      holdingYears,
      residenceYears: asset.residenceYears ?? 0,
    });
  }, [asset, holdingYears]);

  // 고가주택 자동 체크
  React.useEffect(() => {
    if (asset.userFlags.oneHouseExemption && isHighValue !== asset.userFlags.highValueHousing) {
      onUpdate({
        userFlags: { ...asset.userFlags, highValueHousing: isHighValue },
      });
    }
  }, [asset.transferPrice, asset.userFlags.oneHouseExemption]);

  // 조정대상지역 자동 체크
  React.useEffect(() => {
    if (asset.location && isInAdjustedArea !== asset.userFlags.adjustedArea) {
      onUpdate({
        userFlags: { ...asset.userFlags, adjustedArea: isInAdjustedArea },
      });
    }
  }, [asset.location, asset.transferDate]);

  const applyRateSuggestion = () => {
    if (suggestedRate) {
      onUpdate({ rateCode: suggestedRate.code });
    }
  };

  const applyLtDeductionSuggestion = () => {
    onUpdate({ ltDeductionCode: suggestedLtDeduction.code as LtDeductionCode });
  };

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <h4>자산 {index + 1}</h4>
        <div className="asset-card-actions">
          {filingDeadline && (
            <span className={`deadline-badge ${filingDeadline.isPastDue ? 'overdue' : filingDeadline.daysRemaining <= 30 ? 'warning' : 'ok'}`}>
              신고기한: {filingDeadline.deadline}
              {filingDeadline.isPastDue
                ? ' (기한경과)'
                : ` (${filingDeadline.daysRemaining}일 남음)`}
            </span>
          )}
          <Button variant="danger" size="sm" onClick={onRemove}>
            삭제
          </Button>
        </div>
      </div>

      <div className="asset-card-body">
        {/* 기본정보 */}
        <div className="form-section">
          <h5>기본 정보</h5>

          <div className="form-row">
            <FormField label="자산종류" required>
              <Select
                value={asset.assetTypeCode}
                onChange={(v) => onUpdate({ assetTypeCode: v as AssetTypeCode })}
                options={assetTypeOptions}
              />
            </FormField>

            <FormField label="소재지" tooltip="부동산 주소 (조정대상지역 자동 판정)">
              <input
                type="text"
                className="input"
                value={asset.location || ''}
                onChange={(e) => onUpdate({ location: e.target.value })}
                placeholder="예: 서울특별시 강남구 역삼동 123-45"
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="면적 (㎡)">
              <NumberInput
                value={asset.area ?? 0}
                onChange={(v) => onUpdate({ area: v })}
              />
            </FormField>
          </div>
        </div>

        {/* 거래일자 */}
        <div className="form-section">
          <h5>거래일자</h5>

          <div className="form-row">
            <FormField label="취득일" required>
              <DateInput
                value={asset.acquireDate}
                onChange={(v) => onUpdate({ acquireDate: v })}
                max={asset.transferDate || undefined}
              />
            </FormField>

            <FormField label="양도일" required>
              <DateInput
                value={asset.transferDate}
                onChange={(v) => onUpdate({ transferDate: v })}
                max={new Date().toISOString().split('T')[0]}
              />
            </FormField>
          </div>

          {asset.acquireDate && asset.transferDate && (
            <div className="calculated-info">
              <span className="info-label">보유기간:</span>
              <span className="info-value">{holdingYears}년</span>
              {holdingYears < 2 && (
                <span className="info-warning"> (2년 미만 - 단기양도 세율 적용 가능)</span>
              )}
            </div>
          )}
        </div>

        {/* 금액 */}
        <div className="form-section">
          <h5>금액</h5>

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

          {asset.transferPrice > 0 && asset.acquirePrice > 0 && (
            <div className="calculated-info">
              <span className="info-label">예상 양도차익:</span>
              <span className="info-value">{(asset.transferPrice - asset.acquirePrice).toLocaleString()}원</span>
              {isHighValue && (
                <span className="info-warning"> (12억 초과 고가주택)</span>
              )}
            </div>
          )}

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
          </div>
        </div>

        {/* 세율구분 */}
        <div className="form-section">
          <h5>세율 및 공제</h5>

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

            {suggestedRate && suggestedRate.code !== asset.rateCode && (
              <div className="suggestion-box">
                <span className="suggestion-text">
                  추천: {suggestedRate.code} ({suggestedRate.description})
                </span>
                <Button size="sm" variant="ghost" onClick={applyRateSuggestion}>
                  적용
                </Button>
              </div>
            )}
          </div>

          {suggestedRate?.warning && (
            <div className="notice notice-warning">
              <strong>주의:</strong> {suggestedRate.warning}
            </div>
          )}

          <div className="form-row">
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

            {suggestedLtDeduction.code !== asset.ltDeductionCode && (
              <div className="suggestion-box">
                <span className="suggestion-text">
                  추천: {suggestedLtDeduction.description} (최대 {suggestedLtDeduction.maxRate}%)
                </span>
                <Button size="sm" variant="ghost" onClick={applyLtDeductionSuggestion}>
                  적용
                </Button>
              </div>
            )}
          </div>

          {asset.ltDeductionCode === '01' && (
            <div className="form-row">
              <FormField label="보유기간 (년)" tooltip="장특공 계산용">
                <NumberInput
                  value={asset.holdingYears ?? holdingYears}
                  onChange={(v) => onUpdate({ holdingYears: v })}
                />
              </FormField>
              <FormField label="거주기간 (년)" tooltip="1세대1주택 표2 적용 시">
                <NumberInput
                  value={asset.residenceYears ?? 0}
                  onChange={(v) => onUpdate({ residenceYears: v })}
                />
              </FormField>
            </div>
          )}
        </div>

        {/* 사용자 판정 플래그 */}
        <div className="form-section">
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
              checked={asset.userFlags.adjustedArea}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, adjustedArea: v },
                })
              }
              label="조정대상지역 소재"
              tooltip={`현재 조정대상지역: 서울 서초/강남/송파/용산구 ${isInAdjustedArea ? '(자동감지됨)' : ''}`}
            />

            <Checkbox
              checked={asset.userFlags.multiHomeSurtax}
              onChange={(v) =>
                onUpdate({
                  userFlags: { ...asset.userFlags, multiHomeSurtax: v },
                })
              }
              label="다주택 중과 대상"
              tooltip={`조정대상지역 다주택자 중과세율 적용 대상${isSurtaxSuspended ? ' (현재 한시배제 기간: ~2025.5.9)' : ''}`}
            />

            {asset.userFlags.multiHomeSurtax && (
              <div className="sub-field">
                <FormField label="보유 주택 수">
                  <NumberInput
                    value={asset.userFlags.multiHomeCount}
                    onChange={(v) =>
                      onUpdate({
                        userFlags: { ...asset.userFlags, multiHomeCount: v },
                      })
                    }
                  />
                </FormField>
                {isSurtaxSuspended && (
                  <div className="notice notice-info">
                    한시배제 기간(2022.5.10~2025.5.9) 중 양도 시 기본세율 적용
                  </div>
                )}
              </div>
            )}

            <Checkbox
              checked={asset.userFlags.oneHouseExemption}
              onChange={(v) => {
                onUpdate({
                  userFlags: { ...asset.userFlags, oneHouseExemption: v },
                });
                if (v) setShowExemptionChecklist(true);
              }}
              label="1세대1주택 비과세 대상"
              tooltip="보유기간 2년(거주기간 요건 포함) 이상 1세대1주택"
            />

            {asset.userFlags.oneHouseExemption && (
              <>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowExemptionChecklist(!showExemptionChecklist)}
                >
                  {showExemptionChecklist ? '▼' : '▶'} 비과세 요건 체크리스트
                </button>

                {showExemptionChecklist && (
                  <div className="checklist-box">
                    {ONE_HOUSE_EXEMPTION_CHECKLIST.map((item) => (
                      <div key={item.id} className="checklist-item">
                        <span className="checklist-question">
                          {item.required && <span className="required">*</span>}
                          {item.question}
                        </span>
                        <span className="checklist-help">{item.helpText}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Checkbox
                  checked={asset.userFlags.highValueHousing}
                  onChange={(v) =>
                    onUpdate({
                      userFlags: { ...asset.userFlags, highValueHousing: v },
                    })
                  }
                  label={`고가주택 (양도가액 12억 초과) ${isHighValue ? '(자동감지됨)' : ''}`}
                  tooltip="양도가액이 12억원을 초과하는 경우 초과분에 대해서만 과세"
                />
              </>
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
                <FormField label="등록세">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r113_registrationTax}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r113_registrationTax: v },
                        },
                      })
                    }
                  />
                </FormField>
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
              </div>
              <div className="form-row">
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
                <FormField label="기타">
                  <NumberInput
                    value={asset.bp3.acquireCosts.r116_other}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          acquireCosts: { ...asset.bp3!.acquireCosts, r116_other: v },
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
              <div className="form-row">
                <FormField label="신고서작성비용">
                  <NumberInput
                    value={asset.bp3.expenses.r250_filingFee}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r250_filingFee: v },
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="변호사비용">
                  <NumberInput
                    value={asset.bp3.expenses.r260_lawyerFee}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r260_lawyerFee: v },
                        },
                      })
                    }
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="공증수수료">
                  <NumberInput
                    value={asset.bp3.expenses.r270_notaryFee}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r270_notaryFee: v },
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="인지대">
                  <NumberInput
                    value={asset.bp3.expenses.r280_stampDuty}
                    onChange={(v) =>
                      onUpdate({
                        bp3: {
                          ...asset.bp3!,
                          expenses: { ...asset.bp3!.expenses, r280_stampDuty: v },
                        },
                      })
                    }
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        {/* 고급 옵션 */}
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

              <h5>부담부증여 (시행령 제159조)</h5>
              <Checkbox
                checked={asset.giftWithDebt?.enabled ?? false}
                onChange={(v) =>
                  onUpdate({
                    giftWithDebt: {
                      ...(asset.giftWithDebt ?? { assessedValue: 0, debtAmount: 0, donorAcquireCost: 0 }),
                      enabled: v,
                    },
                  })
                }
                label="부담부증여로 취득"
                tooltip="채무를 인수하는 조건으로 증여받은 경우"
              />
              {asset.giftWithDebt?.enabled && (
                <div className="form-row">
                  <FormField label="증여재산평가액">
                    <NumberInput
                      value={asset.giftWithDebt.assessedValue}
                      onChange={(v) =>
                        onUpdate({
                          giftWithDebt: { ...asset.giftWithDebt!, assessedValue: v },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="인수채무액">
                    <NumberInput
                      value={asset.giftWithDebt.debtAmount}
                      onChange={(v) =>
                        onUpdate({
                          giftWithDebt: { ...asset.giftWithDebt!, debtAmount: v },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="증여자취득가액">
                    <NumberInput
                      value={asset.giftWithDebt.donorAcquireCost}
                      onChange={(v) =>
                        onUpdate({
                          giftWithDebt: { ...asset.giftWithDebt!, donorAcquireCost: v },
                        })
                      }
                    />
                  </FormField>
                </div>
              )}

              <h5>이월과세 (소득세법 제97조의2)</h5>
              <div className="notice notice-info" style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem' }}>
                  배우자/직계존비속으로부터 증여받은 후 일정 기간 내 양도 시 증여자 취득가액 기준으로 양도차익 계산
                  <br />
                  • 부동산: 10년 이내 (2023년 이후 증여분) / 5년 이내 (2022년 이전)
                  <br />
                  • 증여세 상당액은 양도차익을 한도로 필요경비 산입
                </p>
              </div>
              <Checkbox
                checked={asset.carryoverTax?.enabled ?? false}
                onChange={(v) =>
                  onUpdate({
                    carryoverTax: {
                      ...(asset.carryoverTax ?? {
                        donorAcquireCost: 0,
                        giftTaxPaid: 0,
                        giftTaxBase: 0,
                        totalGiftTaxBase: 0,
                        exclusionReason: 'NONE',
                      }),
                      enabled: v,
                    },
                  })
                }
                label="이월과세 적용"
                tooltip="배우자/직계존비속으로부터 증여받은 후 10년(또는 5년) 내 양도 시"
              />
              {asset.carryoverTax?.enabled && (
                <>
                  <div className="form-row">
                    <FormField label="증여일" required>
                      <DateInput
                        value={asset.carryoverTax.giftDate ?? ''}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, giftDate: v },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="증여자 취득일" tooltip="보유기간 기산일 (장기보유특별공제 적용용)">
                      <DateInput
                        value={asset.carryoverTax.donorAcquireDate ?? ''}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, donorAcquireDate: v },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="증여자 관계">
                      <Select
                        value={asset.carryoverTax.donorRelation ?? 'spouse'}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, donorRelation: v as 'spouse' | 'lineal' },
                          })
                        }
                        options={[
                          { value: 'spouse', label: '배우자' },
                          { value: 'lineal', label: '직계존비속' },
                        ]}
                      />
                    </FormField>
                  </div>

                  {/* 이월과세 기간 검증 */}
                  {asset.carryoverTax.giftDate && asset.transferDate && (() => {
                    const giftDate = new Date(asset.carryoverTax.giftDate!);
                    const transferDate = new Date(asset.transferDate);
                    const elapsedMs = transferDate.getTime() - giftDate.getTime();
                    const elapsedYears = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);
                    const amendmentDate = new Date('2023-01-01');
                    const periodYears = giftDate >= amendmentDate ? 10 : 5;
                    const isValid = elapsedYears <= periodYears;

                    return (
                      <div className={`notice ${isValid ? 'notice-success' : 'notice-warning'}`} style={{ marginTop: '0.5rem' }}>
                        <p style={{ fontSize: '0.85rem' }}>
                          증여일로부터 {elapsedYears.toFixed(1)}년 경과 (기간: {periodYears}년)
                          {isValid
                            ? ' → 이월과세 적용 대상'
                            : ' → 기간 초과로 이월과세 미적용'}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <FormField label="증여자 취득가액" required tooltip="증여자가 해당 자산을 취득한 금액">
                      <NumberInput
                        value={asset.carryoverTax.donorAcquireCost}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, donorAcquireCost: v },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="납부(할) 증여세액" tooltip="증여세 산출세액 (양도차익 한도로 필요경비 산입)">
                      <NumberInput
                        value={asset.carryoverTax.giftTaxPaid}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, giftTaxPaid: v },
                          })
                        }
                      />
                    </FormField>
                  </div>

                  {/* 증여세 안분 계산용 (여러 자산 증여 시) */}
                  <div className="form-row">
                    <FormField label="당해 자산 증여세 과세표준" tooltip="이 자산에 대한 증여세 과세표준 (안분계산용)">
                      <NumberInput
                        value={asset.carryoverTax.giftTaxBase ?? 0}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, giftTaxBase: v },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="전체 증여재산 과세표준" tooltip="함께 증여받은 전체 재산의 과세표준 합계">
                      <NumberInput
                        value={asset.carryoverTax.totalGiftTaxBase ?? 0}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: { ...asset.carryoverTax!, totalGiftTaxBase: v },
                          })
                        }
                      />
                    </FormField>
                  </div>

                  {/* 적용배제 사유 */}
                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <FormField label="적용배제 사유" tooltip="해당 사유가 있으면 이월과세가 배제됨">
                      <Select
                        value={asset.carryoverTax.exclusionReason ?? 'NONE'}
                        onChange={(v) =>
                          onUpdate({
                            carryoverTax: {
                              ...asset.carryoverTax!,
                              exclusionReason: v as 'NONE' | 'ONE_HOUSE_EXEMPTION' | 'LOWER_TAX_BENEFIT' | 'SPOUSE_DEATH' | 'PUBLIC_ACQUISITION' | 'RELATIONSHIP_TERMINATED',
                            },
                          })
                        }
                        options={[
                          { value: 'NONE', label: '해당없음 (이월과세 적용)' },
                          { value: 'ONE_HOUSE_EXEMPTION', label: '1세대1주택 비과세' },
                          { value: 'LOWER_TAX_BENEFIT', label: '미적용이 유리' },
                          { value: 'SPOUSE_DEATH', label: '배우자 사망' },
                          { value: 'PUBLIC_ACQUISITION', label: '공익사업 수용' },
                          { value: 'RELATIONSHIP_TERMINATED', label: '직계존비속 관계 소멸' },
                        ]}
                      />
                    </FormField>
                  </div>

                  {asset.carryoverTax.exclusionReason && asset.carryoverTax.exclusionReason !== 'NONE' && (
                    <div className="notice notice-warning" style={{ marginTop: '0.5rem' }}>
                      <p style={{ fontSize: '0.85rem' }}>
                        적용배제 사유로 인해 이월과세가 적용되지 않습니다. 수증자(증여받은 자)의 취득가액 기준으로 양도차익을 계산합니다.
                      </p>
                    </div>
                  )}
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

  const validateAssets = (): string[] => {
    const errors: string[] = [];

    for (let i = 0; i < currentCase.bp1Assets.length; i++) {
      const asset = currentCase.bp1Assets[i];
      const num = i + 1;

      if (!asset.transferDate) {
        errors.push(`자산 ${num}: 양도일을 입력하세요.`);
      }
      if (!asset.acquireDate) {
        errors.push(`자산 ${num}: 취득일을 입력하세요.`);
      }
      if (asset.acquireDate && asset.transferDate && asset.acquireDate > asset.transferDate) {
        errors.push(`자산 ${num}: 취득일이 양도일보다 늦을 수 없습니다.`);
      }
      if (asset.transferPrice <= 0) {
        errors.push(`자산 ${num}: 양도가액을 입력하세요.`);
      }
      if (asset.acquirePrice <= 0) {
        errors.push(`자산 ${num}: 취득가액을 입력하세요.`);
      }
    }

    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentCase.bp1Assets.length === 0 && currentCase.bp2Assets.length === 0) {
      alert('최소 1개 이상의 자산을 입력하세요.');
      return;
    }

    const errors = validateAssets();
    if (errors.length > 0) {
      alert('입력 오류:\n\n' + errors.join('\n'));
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
          <br />
          <small>세율구분코드와 장기보유특별공제는 입력 내용에 따라 자동 추천됩니다.</small>
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
