import React from 'react';
import { useTaxCaseStore } from '../store';
import { ReportTypeLabels } from '../schemas';

const STEPS = [
  { id: 0, label: '신고구분', shortLabel: '구분' },
  { id: 1, label: '신고인', shortLabel: '신고인' },
  { id: 2, label: '부동산/권리', shortLabel: '부동산' },
  { id: 3, label: '주식/파생', shortLabel: '주식' },
  { id: 4, label: '감면/공제', shortLabel: '감면' },
  { id: 5, label: '가산세/조정', shortLabel: '조정' },
  { id: 6, label: '계산결과', shortLabel: '결과' },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentCase, currentStep, setStep, isDirty, saveCurrent, createNewCase, savedCases, loadCaseById } = useTaxCaseStore();

  const handleStepClick = (stepId: number) => {
    // 이전 단계로만 이동 가능
    if (stepId <= currentStep) {
      setStep(stepId);
    }
  };

  return (
    <div className="app-layout">
      {/* 헤더 */}
      <header className="app-header">
        <div className="header-left">
          <h1>양도소득세 신고서 작성</h1>
          {currentCase && (
            <span className="case-info">
              {currentCase.taxYear}년 {ReportTypeLabels[currentCase.reportType]}
              {isDirty && <span className="dirty-indicator">*</span>}
            </span>
          )}
        </div>
        <div className="header-right">
          {currentCase && (
            <button className="header-btn" onClick={saveCurrent} disabled={!isDirty}>
              저장
            </button>
          )}
          <button className="header-btn" onClick={createNewCase}>
            새 신고서
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* 사이드바 - 스테퍼 */}
        <aside className="app-sidebar">
          <nav className="stepper">
            {STEPS.map((step) => (
              <button
                key={step.id}
                className={`stepper-item ${currentStep === step.id ? 'active' : ''} ${
                  step.id < currentStep ? 'completed' : ''
                } ${step.id > currentStep ? 'disabled' : ''}`}
                onClick={() => handleStepClick(step.id)}
                disabled={step.id > currentStep}
              >
                <span className="stepper-number">{step.id + 1}</span>
                <span className="stepper-label">{step.label}</span>
              </button>
            ))}
          </nav>

          {/* 저장된 케이스 목록 */}
          {savedCases.length > 0 && (
            <div className="saved-cases">
              <h4>저장된 신고서</h4>
              <ul>
                {savedCases.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button
                      className={`case-item ${currentCase?.id === c.id ? 'active' : ''}`}
                      onClick={() => loadCaseById(c.id)}
                    >
                      <span className="case-year">{c.taxYear}년</span>
                      <span className="case-type">{ReportTypeLabels[c.reportType]}</span>
                      <span className="case-name">{c.taxpayer.name || '(미입력)'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* 메인 컨텐츠 */}
        <main className="app-main">
          {currentCase ? (
            children
          ) : (
            <div className="welcome-screen">
              <h2>양도소득세 신고서 작성 도우미</h2>
              <p>
                양도소득세 신고서(별지 제84호) 및 부표를 작성하고 PDF로 출력할 수 있습니다.
              </p>
              <ul className="feature-list">
                <li>부동산, 주식, 파생상품 양도소득세 계산</li>
                <li>장기보유특별공제, 고가주택 안분 자동 계산</li>
                <li>기한후/수정신고 가산세 계산</li>
                <li>부담부증여, 이월과세 지원</li>
                <li>PDF 출력 (별지 제84호 + 부표)</li>
              </ul>
              <button className="btn btn-primary btn-lg" onClick={createNewCase}>
                새 신고서 작성 시작
              </button>
              <div className="disclaimer">
                <strong>안내:</strong> 본 서비스는 정보 제공 목적이며, 세무 자문이 아닙니다.
                법적 효력이 있는 신고는 홈택스(hometax.go.kr)를 이용하세요.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 푸터 */}
      <footer className="app-footer">
        <p>
          본 앱은 정보 제공 목적으로만 사용됩니다. 세무 자문이 아니며, 법적 효력이 없습니다.
          정확한 신고를 위해 세무 전문가와 상담하세요.
        </p>
      </footer>
    </div>
  );
}
