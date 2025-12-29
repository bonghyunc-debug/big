import React from 'react';
import { FormField, DateInput, Checkbox } from '../common';
import type { BP1Asset } from '../../schemas';
import { isAdjustmentArea, ADJUSTMENT_AREAS, isMultiHomeSurtaxSuspended } from '../../data/taxRules';

interface AdjustedAreaInfoFormProps {
  asset: BP1Asset;
  onUpdate: (updates: Partial<BP1Asset>) => void;
}

/**
 * 조정대상지역 정보 폼
 * 법적 근거:
 * - 주택법 제63조의2 제1항 제1호: 조정대상지역 지정
 * - 소득세법 시행령 제154조 제1항: 거주요건 (조정지역 취득 시)
 * - 소득세법 제104조 제7항: 다주택 중과세율
 * - 시행령 제167조의3: 장기보유특별공제 배제/제한
 *
 * 2024년 현재 조정대상지역: 서울 강남/서초/송파/용산구
 */
export function AdjustedAreaInfoForm({ asset, onUpdate }: AdjustedAreaInfoFormProps) {
  const adjustedAreaInfo = asset.adjustedAreaInfo ?? {
    acquiredInAdjustedArea: false,
    currentlyAdjustedArea: false,
    adjustedAreaAcquireDate: undefined,
  };

  const handleUpdate = (updates: Partial<typeof adjustedAreaInfo>) => {
    onUpdate({
      adjustedAreaInfo: { ...adjustedAreaInfo, ...updates },
    });
  };

  // 자동 판정 (주소 기반)
  const autoDetectedAdjusted = React.useMemo(() => {
    if (!asset.location) return false;
    const checkDate = asset.acquireDate || new Date().toISOString().split('T')[0];
    return isAdjustmentArea(asset.location, checkDate);
  }, [asset.location, asset.acquireDate]);

  // 한시배제 기간 체크
  const isSurtaxSuspended = asset.transferDate
    ? isMultiHomeSurtaxSuspended(asset.transferDate)
    : false;

  // 현재 조정대상지역 목록
  const currentAdjustedAreas = ADJUSTMENT_AREAS
    .filter((area) => area.effectiveTo === null)
    .map((area) => `${area.city} ${area.district}`);

  return (
    <div className="form-section adjusted-area-form">
      <h5>조정대상지역 정보 (주택법 제63조의2)</h5>

      <div className="notice notice-info" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem' }}>
          <strong>현재 조정대상지역:</strong> {currentAdjustedAreas.join(', ')}<br />
          <br />
          <strong>조정대상지역 취득 시 영향:</strong><br />
          • 1세대1주택 비과세: 2년 보유 + <strong>2년 거주</strong> 요건<br />
          • 다주택자 중과세율: 2주택 +20%p, 3주택 +30%p
          {isSurtaxSuspended && <span style={{ color: '#059669' }}> (현재 한시배제 중 ~2026.5.9)</span>}<br />
          • 장기보유특별공제: 다주택 중과 시 배제
        </p>
      </div>

      {autoDetectedAdjusted && (
        <div className="notice notice-warning" style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.85rem' }}>
            <strong>자동 감지:</strong> 입력하신 주소({asset.location})가 조정대상지역으로 판단됩니다.
          </p>
        </div>
      )}

      <Checkbox
        checked={adjustedAreaInfo.acquiredInAdjustedArea}
        onChange={(v) => handleUpdate({ acquiredInAdjustedArea: v })}
        label="취득 당시 조정대상지역 소재 주택입니다"
        tooltip="취득일 기준으로 조정대상지역 여부 판단 (1세대1주택 거주요건 적용)"
      />

      {adjustedAreaInfo.acquiredInAdjustedArea && (
        <>
          <div className="form-row" style={{ marginTop: '0.5rem' }}>
            <FormField
              label="조정지역 지정 후 취득일"
              tooltip="해당 지역이 조정대상지역으로 지정된 후 취득한 날짜"
            >
              <DateInput
                value={adjustedAreaInfo.adjustedAreaAcquireDate ?? ''}
                onChange={(v) => handleUpdate({ adjustedAreaAcquireDate: v })}
              />
            </FormField>
          </div>

          <div className="notice notice-warning" style={{ marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem' }}>
              <strong>주의:</strong> 조정대상지역 취득 주택의 1세대1주택 비과세를 받으려면<br />
              보유기간 2년 + <strong>거주기간 2년</strong>을 충족해야 합니다.<br />
              (단, 조정지역 고시 전 계약 + 무주택자는 거주요건 면제)
            </p>
          </div>
        </>
      )}

      <Checkbox
        checked={adjustedAreaInfo.currentlyAdjustedArea}
        onChange={(v) => handleUpdate({ currentlyAdjustedArea: v })}
        label="양도 당시 조정대상지역 소재 주택입니다"
        tooltip="양도일 기준으로 조정대상지역 여부 판단 (다주택 중과 적용)"
      />

      {adjustedAreaInfo.currentlyAdjustedArea && asset.userFlags.multiHomeSurtax && (
        <div
          className={`notice ${isSurtaxSuspended ? 'notice-success' : 'notice-error'}`}
          style={{ marginTop: '0.5rem' }}
        >
          <p style={{ fontSize: '0.85rem' }}>
            {isSurtaxSuspended ? (
              <>
                <strong>한시배제 적용:</strong> 2022.5.10 ~ 2026.5.9 양도분은 다주택 중과세율이 한시 배제됩니다.<br />
                기본세율이 적용되며 장기보유특별공제도 적용 가능합니다.
              </>
            ) : (
              <>
                <strong>다주택 중과세율 적용:</strong><br />
                • 2주택: 기본세율 + 20%p<br />
                • 3주택 이상: 기본세율 + 30%p<br />
                • 장기보유특별공제 배제
              </>
            )}
          </p>
        </div>
      )}

      {/* 조정대상지역 연혁 */}
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#666' }}>
          조정대상지역 지정 연혁 보기
        </summary>
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '4px' }}>지역</th>
                <th style={{ textAlign: 'left', padding: '4px' }}>지정일</th>
                <th style={{ textAlign: 'left', padding: '4px' }}>해제일</th>
              </tr>
            </thead>
            <tbody>
              {ADJUSTMENT_AREAS.map((area, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px' }}>{area.city} {area.district}</td>
                  <td style={{ padding: '4px' }}>{area.effectiveFrom}</td>
                  <td style={{ padding: '4px' }}>{area.effectiveTo ?? '현재'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
