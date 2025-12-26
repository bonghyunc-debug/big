import React from 'react';
import { useTaxCaseStore } from '../../store';
import { TaxFormPDFViewer, TaxFormPDFDownload } from '../pdf/TaxFormPDF';
import { Checkbox, Button } from '../common';

export function Step7PDF() {
  const { currentCase, calculationResult, prevStep } = useTaxCaseStore();
  const [maskSensitive, setMaskSensitive] = React.useState(true);
  const [showPreview, setShowPreview] = React.useState(false);

  if (!currentCase || !calculationResult) {
    return (
      <div className="step-form">
        <div className="step-header">
          <h2>PDF 출력</h2>
        </div>
        <div className="step-content">
          <div className="notice notice-warning">
            <p>먼저 계산을 완료해주세요.</p>
          </div>
        </div>
        <div className="step-actions">
          <Button variant="ghost" onClick={prevStep}>
            이전
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="step-form">
      <div className="step-header">
        <h2>PDF 출력</h2>
        <p className="step-description">
          양도소득세 신고서를 PDF로 미리보기 및 다운로드할 수 있습니다.
        </p>
      </div>

      <div className="step-content">
        {/* 출력 옵션 */}
        <section className="form-section">
          <h3>출력 옵션</h3>

          <Checkbox
            checked={maskSensitive}
            onChange={setMaskSensitive}
            label="주민등록번호 마스킹"
            tooltip="주민등록번호 뒷자리를 *로 표시합니다"
          />

          <div className="notice notice-info">
            <strong>포함 페이지</strong>
            <ul>
              <li>별지 제84호 - 양도소득과세표준 신고 및 납부계산서</li>
              {currentCase.bp1Assets.length > 0 && <li>부표1 - 양도소득금액 계산명세서 (부동산)</li>}
              {currentCase.bp2Assets.length > 0 && <li>부표2 - 양도소득금액 계산명세서 (주식)</li>}
              <li>첨부서류 체크리스트</li>
            </ul>
          </div>
        </section>

        {/* 미리보기 */}
        <section className="form-section">
          <h3>미리보기</h3>

          <Button
            variant="secondary"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? '미리보기 닫기' : '미리보기 열기'}
          </Button>

          {showPreview && (
            <div className="pdf-preview-container" style={{ marginTop: '1rem' }}>
              <TaxFormPDFViewer
                taxCase={currentCase}
                result={calculationResult}
                maskSensitive={maskSensitive}
              />
            </div>
          )}
        </section>

        {/* 다운로드 */}
        <section className="form-section">
          <h3>다운로드</h3>

          <TaxFormPDFDownload
            taxCase={currentCase}
            result={calculationResult}
            maskSensitive={maskSensitive}
          />
        </section>

        {/* 고지 */}
        <div className="notice notice-warning">
          <strong>중요 안내</strong>
          <p>
            본 PDF는 정보 제공 목적으로 생성된 것으로, 법적 효력이 있는 공식 신고서가 아닙니다.
            실제 양도소득세 신고는 반드시 홈택스(www.hometax.go.kr)를 통해 진행하시기 바랍니다.
          </p>
          <p>
            본 앱은 세무 자문을 제공하지 않으며, 계산 결과의 정확성을 보장하지 않습니다.
            정확한 세액 계산 및 신고를 위해 세무 전문가와 상담하시기 바랍니다.
          </p>
        </div>
      </div>

      <div className="step-actions">
        <Button variant="ghost" onClick={prevStep}>
          이전
        </Button>
      </div>
    </div>
  );
}
