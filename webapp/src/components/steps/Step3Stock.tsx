import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTaxCaseStore } from '../../store';
import {
  StockDomesticForeignLabels,
  StockTypeCodeLabels,
  TransferAcquireTypeLabels,
  type StockDomesticForeign,
  type StockTypeCode,
  type TransferAcquireType,
  type BP2Asset,
} from '../../schemas';
import { FormField, Select, NumberInput, DateInput, Button } from '../common';

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

export function Step3Stock() {
  const {
    currentCase,
    addBP2Asset,
    updateBP2Asset,
    removeBP2Asset,
    nextStep,
    prevStep,
  } = useTaxCaseStore();

  if (!currentCase) return null;

  const handleAddStock = () => {
    addBP2Asset(createEmptyBP2Asset());
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

        <div className="notice notice-info" style={{ marginTop: '1rem' }}>
          <p>
            파생상품(부표2의2)은 현재 간소화 버전에서 지원합니다.
            상세 입력이 필요한 경우 별도 양식을 참고하세요.
          </p>
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
