import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTaxCaseStore } from '../../store';
import {
  StockDomesticForeignLabels,
  StockTypeCodeLabels,
  TransferAcquireTypeLabels,
  DerivativeRateCodeLabels,
  type StockDomesticForeign,
  type StockTypeCode,
  type TransferAcquireType,
  type DerivativeRateCode,
  type BP2Asset,
  type BP2_2Row,
  type BP2_2,
} from '../../schemas';
import { FormField, Select, NumberInput, DateInput, Button, Checkbox } from '../common';

const domesticForeignOptions = Object.entries(StockDomesticForeignLabels).map(([value, label]) => ({
  value,
  label,
}));

const stockTypeOptions = Object.entries(StockTypeCodeLabels).map(([value, label]) => ({
  value,
  label,
}));

const transferAcquireOptions = Object.entries(TransferAcquireTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const derivativeRateCodeOptions = Object.entries(DerivativeRateCodeLabels).map(([value, label]) => ({
  value,
  label,
}));

function createEmptyBP2Asset(): Omit<BP2Asset, 'id'> {
  return {
    issuerName: '',
    securityId: '',
    domesticForeign: '1' as StockDomesticForeign,
    stockTypeCode: '31' as StockTypeCode,
    transferType: '1' as TransferAcquireType,
    acquireType: '1' as TransferAcquireType,
    quantity: 0,
    transferDate: '',
    transferPrice: 0,
    acquirePrice: 0,
    necessaryExpense: 0,
  };
}

interface StockFormProps {
  asset: BP2Asset;
  onUpdate: (updates: Partial<BP2Asset>) => void;
  onRemove: () => void;
  index: number;
}

function StockForm({ asset, onUpdate, onRemove, index }: StockFormProps) {
  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <h4>주식 {index + 1}: {asset.issuerName || '(미입력)'}</h4>
        <Button variant="danger" size="sm" onClick={onRemove}>
          삭제
        </Button>
      </div>

      <div className="asset-card-body">
        <div className="form-row">
          <FormField label="종목명" required>
            <input
              type="text"
              className="text-input"
              value={asset.issuerName}
              onChange={(e) => onUpdate({ issuerName: e.target.value })}
              placeholder="삼성전자"
            />
          </FormField>

          <FormField label="종목코드/사업자번호">
            <input
              type="text"
              className="text-input"
              value={asset.securityId ?? ''}
              onChange={(e) => onUpdate({ securityId: e.target.value })}
              placeholder="005930 또는 123-45-67890"
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="국내/국외" required>
            <Select
              value={asset.domesticForeign}
              onChange={(v) => onUpdate({ domesticForeign: v as StockDomesticForeign })}
              options={domesticForeignOptions}
            />
          </FormField>

          <FormField label="주식종류" required tooltip="상장/비상장/중소기업 등">
            <Select
              value={asset.stockTypeCode}
              onChange={(v) => onUpdate({ stockTypeCode: v as StockTypeCode })}
              options={stockTypeOptions}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="양도유형">
            <Select
              value={asset.transferType}
              onChange={(v) => onUpdate({ transferType: v as TransferAcquireType })}
              options={transferAcquireOptions}
            />
          </FormField>

          <FormField label="취득유형">
            <Select
              value={asset.acquireType}
              onChange={(v) => onUpdate({ acquireType: v as TransferAcquireType })}
              options={transferAcquireOptions}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="양도수량" required>
            <NumberInput
              value={asset.quantity}
              onChange={(v) => onUpdate({ quantity: v })}
              unit="주"
            />
          </FormField>

          <FormField label="양도일" required>
            <DateInput
              value={asset.transferDate}
              onChange={(v) => onUpdate({ transferDate: v })}
            />
          </FormField>
        </div>

        <div className="form-row">
          <FormField label="양도가액" required>
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

        <FormField label="필요경비" tooltip="증권거래세, 수수료 등">
          <NumberInput
            value={asset.necessaryExpense}
            onChange={(v) => onUpdate({ necessaryExpense: v })}
          />
        </FormField>
      </div>
    </div>
  );
}

// 파생상품 행 생성
function createEmptyDerivativeRow(): Omit<BP2_2Row, 'id'> {
  return {
    rateCode: '81' as DerivativeRateCode, // 2018.4.1 이후 10%
    productName: '',
    r08_transferPrice: 0,
    r09_necessaryExpense: 0,
    r11_prevGain: 0,
    r12_currentLoss: 0,
    r13_carriedLoss: 0,
    r14_otherDeduction: 0,
  };
}

interface DerivativeFormProps {
  row: BP2_2Row;
  onUpdate: (updates: Partial<BP2_2Row>) => void;
  onRemove: () => void;
  index: number;
}

function DerivativeForm({ row, onUpdate, onRemove, index }: DerivativeFormProps) {
  // 자동 계산: 양도차익/손실, 과세표준
  const transferGain = row.r08_transferPrice - row.r09_necessaryExpense;
  const netGain = transferGain - row.r12_currentLoss - row.r13_carriedLoss - row.r14_otherDeduction;
  const taxRate = row.rateCode === '80' ? 5 : 10;
  const estimatedTax = netGain > 0 ? Math.floor(netGain * taxRate / 100) : 0;

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <h4>파생상품 {index + 1}: {row.productName || '(미입력)'}</h4>
        <Button variant="danger" size="sm" onClick={onRemove}>
          삭제
        </Button>
      </div>

      <div className="asset-card-body">
        {/* 기본정보 */}
        <div className="form-row">
          <FormField label="종목명" required tooltip="선물/옵션 상품명">
            <input
              type="text"
              className="text-input"
              value={row.productName}
              onChange={(e) => onUpdate({ productName: e.target.value })}
              placeholder="KOSPI200 선물, 개별주식옵션 등"
            />
          </FormField>

          <FormField
            label="세율구분"
            required
            tooltip="2018.3.31 이전 양도분 5%, 이후 양도분 10%"
            evidence={{ text: '소득세법 제104조 제1항 제11호의4' }}
          >
            <Select
              value={row.rateCode}
              onChange={(v) => onUpdate({ rateCode: v as DerivativeRateCode })}
              options={derivativeRateCodeOptions}
            />
          </FormField>
        </div>

        {/* 금액 */}
        <div className="form-section" style={{ marginTop: '1rem' }}>
          <h5>금액 (부표2의2 서식 기준)</h5>

          <div className="form-row">
            <FormField label="⑧ 양도가액" required tooltip="파생상품 양도대가">
              <NumberInput
                value={row.r08_transferPrice}
                onChange={(v) => onUpdate({ r08_transferPrice: v })}
              />
            </FormField>

            <FormField label="⑨ 필요경비" tooltip="거래수수료 등">
              <NumberInput
                value={row.r09_necessaryExpense}
                onChange={(v) => onUpdate({ r09_necessaryExpense: v })}
              />
            </FormField>
          </div>

          {/* 자동계산 표시 */}
          {row.r08_transferPrice > 0 && (
            <div className="calculated-info" style={{ marginTop: '0.5rem' }}>
              <span className="info-label">⑩ 양도차익:</span>
              <span className={`info-value ${transferGain < 0 ? 'negative' : ''}`}>
                {transferGain.toLocaleString()}원
              </span>
            </div>
          )}

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <FormField label="⑪ 전연도이월손익" tooltip="전년도에서 이월된 손익">
              <NumberInput
                value={row.r11_prevGain}
                onChange={(v) => onUpdate({ r11_prevGain: v })}
              />
            </FormField>

            <FormField label="⑫ 당해연도손실" tooltip="당해연도 파생상품 손실">
              <NumberInput
                value={row.r12_currentLoss}
                onChange={(v) => onUpdate({ r12_currentLoss: v })}
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="⑬ 이월결손" tooltip="과거 이월된 결손금">
              <NumberInput
                value={row.r13_carriedLoss}
                onChange={(v) => onUpdate({ r13_carriedLoss: v })}
              />
            </FormField>

            <FormField label="⑭ 기타공제" tooltip="기타 공제액">
              <NumberInput
                value={row.r14_otherDeduction}
                onChange={(v) => onUpdate({ r14_otherDeduction: v })}
              />
            </FormField>
          </div>

          {/* 최종 계산 결과 */}
          {row.r08_transferPrice > 0 && (
            <div className="calculated-summary" style={{ marginTop: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
              <div className="calculated-info">
                <span className="info-label">⑮ 과세표준:</span>
                <span className={`info-value ${netGain <= 0 ? 'zero' : ''}`}>
                  {Math.max(0, netGain).toLocaleString()}원
                </span>
              </div>
              <div className="calculated-info">
                <span className="info-label">세율:</span>
                <span className="info-value">{taxRate}%</span>
              </div>
              <div className="calculated-info">
                <span className="info-label">예상세액:</span>
                <span className="info-value">{estimatedTax.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 법적 근거 안내 */}
        <div className="notice notice-info" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
          <p><strong>파생상품 양도소득세</strong> (소득세법 제94조 제1항 제5호의2)</p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
            <li>국내 파생상품: KOSPI200 선물/옵션, 개별주식옵션, 미니선물/옵션 등</li>
            <li>해외 파생상품: 해외거래소 상장 파생상품</li>
            <li>기본공제: 연 250만원 (주식과 별도)</li>
            <li>세율: 2018.3.31 이전 5%, 이후 10%</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Step3Stock() {
  const {
    currentCase,
    addBP2Asset,
    updateBP2Asset,
    removeBP2Asset,
    setBP2_2,
    nextStep,
    prevStep,
  } = useTaxCaseStore();

  const [showDerivatives, setShowDerivatives] = React.useState(
    (currentCase?.bp2_2?.rows?.length ?? 0) > 0
  );

  if (!currentCase) return null;

  const taxYear = currentCase.taxYear || new Date().getFullYear();

  const handleAddStock = () => {
    addBP2Asset(createEmptyBP2Asset());
  };

  const handleAddDerivative = () => {
    const newRow: BP2_2Row = {
      ...createEmptyDerivativeRow(),
      id: uuidv4(),
    } as BP2_2Row;

    const current = currentCase.bp2_2 || { taxYear, rows: [] };
    setBP2_2({
      ...current,
      rows: [...current.rows, newRow],
    });
  };

  const handleUpdateDerivative = (id: string, updates: Partial<BP2_2Row>) => {
    if (!currentCase.bp2_2) return;
    setBP2_2({
      ...currentCase.bp2_2,
      rows: currentCase.bp2_2.rows.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    });
  };

  const handleRemoveDerivative = (id: string) => {
    if (!currentCase.bp2_2) return;
    setBP2_2({
      ...currentCase.bp2_2,
      rows: currentCase.bp2_2.rows.filter((r) => r.id !== id),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nextStep();
  };

  return (
    <form className="step-form" onSubmit={handleSubmit}>
      <div className="step-header">
        <h2>주식/파생상품 입력</h2>
        <p className="step-description">
          양도한 주식 및 파생상품 정보를 입력하세요. (부표2/부표2의2 연계)
        </p>
      </div>

      <div className="step-content">
        <h3>주식 (부표2)</h3>
        <div className="asset-list">
          {currentCase.bp2Assets.map((asset, idx) => (
            <StockForm
              key={asset.id}
              asset={asset}
              index={idx}
              onUpdate={(updates) => updateBP2Asset(asset.id, updates)}
              onRemove={() => removeBP2Asset(asset.id)}
            />
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={handleAddStock}>
          + 주식 추가
        </Button>

        {/* 파생상품 섹션 */}
        <div className="form-section" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3>파생상품 (부표2의2)</h3>
            <Checkbox
              checked={showDerivatives}
              onChange={(v) => setShowDerivatives(v)}
              label="파생상품 입력"
            />
          </div>

          {showDerivatives && (
            <>
              <div className="asset-list" style={{ marginTop: '1rem' }}>
                {(currentCase.bp2_2?.rows ?? []).map((row, idx) => (
                  <DerivativeForm
                    key={row.id}
                    row={row}
                    index={idx}
                    onUpdate={(updates) => handleUpdateDerivative(row.id, updates)}
                    onRemove={() => handleRemoveDerivative(row.id)}
                  />
                ))}
              </div>

              <Button type="button" variant="secondary" onClick={handleAddDerivative}>
                + 파생상품 추가
              </Button>

              {(currentCase.bp2_2?.rows?.length ?? 0) === 0 && (
                <div className="notice notice-info" style={{ marginTop: '1rem' }}>
                  <p>
                    '파생상품 추가' 버튼을 눌러 KOSPI200 선물/옵션, 개별주식옵션 등의 양도내역을 입력하세요.
                    <br />
                    <small>기본공제: 연 250만원 (주식 양도소득과 별도)</small>
                  </p>
                </div>
              )}
            </>
          )}

          {!showDerivatives && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              파생상품(선물, 옵션 등)을 양도한 경우 체크하여 입력하세요.
            </p>
          )}
        </div>
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button type="submit" variant="primary">
          다음: 감면/공제
        </Button>
      </div>
    </form>
  );
}
