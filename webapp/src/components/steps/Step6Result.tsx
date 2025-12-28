import React from 'react';
import { useTaxCaseStore } from '../../store';
import { calculateTaxCase } from '../../engine';
import { formatKRW } from '../../engine/utils';
import { Button } from '../common';

export function Step6Result() {
  const {
    currentCase,
    calculationResult,
    setCalculationResult,
    saveCurrent,
    prevStep,
    isDirty,
  } = useTaxCaseStore();

  const [isCalculating, setIsCalculating] = React.useState(false);

  React.useEffect(() => {
    if (currentCase && !calculationResult) {
      handleCalculate();
    }
  }, [currentCase?.id]);

  const handleCalculate = () => {
    if (!currentCase) return;

    setIsCalculating(true);
    try {
      const result = calculateTaxCase(currentCase);
      setCalculationResult(result);
    } catch (err) {
      console.error('계산 오류:', err);
      alert('계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = async () => {
    await saveCurrent();
    alert('저장되었습니다.');
  };

  if (!currentCase) return null;

  const result = calculationResult;

  return (
    <div className="step-form">
      <div className="step-header">
        <h2>계산 결과</h2>
        <p className="step-description">
          입력 정보를 기반으로 계산된 양도소득세 결과입니다.
        </p>
      </div>

      <div className="step-content">
        {isCalculating ? (
          <div className="loading">계산 중...</div>
        ) : result ? (
          <div className="result-container">
            {/* 요약 */}
            <section className="result-summary">
              <h3>납부할 세액</h3>
              <div className="tax-due-amount">
                {formatKRW(result.mainResult.line18_taxDue)} 원
              </div>
            </section>

            {/* 상세 내역 */}
            <section className="result-detail">
              <h3>계산 내역</h3>
              <table className="result-table">
                <tbody>
                  <tr>
                    <td>④ 양도소득금액</td>
                    <td className="amount">{formatKRW(result.mainResult.line04_gainIncomeTotal)} 원</td>
                  </tr>
                  <tr>
                    <td>⑤ 기신고 양도소득금액</td>
                    <td className="amount">{formatKRW(result.mainResult.line05_prevReportedGainIncome)} 원</td>
                  </tr>
                  <tr>
                    <td>⑥ 소득감면대상 소득금액</td>
                    <td className="amount">{formatKRW(result.mainResult.line06_incomeDeductionBase)} 원</td>
                  </tr>
                  <tr>
                    <td>⑦ 양도소득기본공제</td>
                    <td className="amount">{formatKRW(result.mainResult.line07_basicDeduction)} 원</td>
                  </tr>
                  <tr className="highlight">
                    <td>⑧ 과세표준</td>
                    <td className="amount">{formatKRW(result.mainResult.line08_taxBase)} 원</td>
                  </tr>
                  <tr>
                    <td>⑨ 세율</td>
                    <td>{result.mainResult.line09_rateLabel}</td>
                  </tr>
                  <tr className="sub-row">
                    <td className="indent">A(가) 누진세율 적용</td>
                    <td className="amount">{formatKRW(result.mainResult.taxA)} 원</td>
                  </tr>
                  <tr className="sub-row">
                    <td className="indent">B(나) 자산별 합계</td>
                    <td className="amount">{formatKRW(result.mainResult.taxB)} 원</td>
                  </tr>
                  <tr className="highlight">
                    <td>⑩ 산출세액 [max(A,B)]</td>
                    <td className="amount">{formatKRW(result.mainResult.line10_taxBeforeCredits)} 원</td>
                  </tr>
                  <tr>
                    <td>⑪ 감면세액</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line11_taxRelief)} 원</td>
                  </tr>
                  <tr>
                    <td>⑫ 외국납부세액공제</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line12_foreignTaxCredit)} 원</td>
                  </tr>
                  <tr>
                    <td>⑬ 원천징수세액공제</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line13_withholdingCredit)} 원</td>
                  </tr>
                  <tr>
                    <td>⑭ 연금계좌세액공제</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line14_pensionCredit)} 원</td>
                  </tr>
                  <tr>
                    <td>⑮ 전자신고세액공제</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line15_eFilingCredit)} 원</td>
                  </tr>
                  {result.mainResult.penaltyTotal > 0 && (
                    <>
                      <tr>
                        <td>⑯ 가산세</td>
                        <td className="amount">(+) {formatKRW(result.mainResult.penaltyTotal)} 원</td>
                      </tr>
                      <tr className="sub-row">
                        <td className="indent">- 무(과소)신고</td>
                        <td className="amount">{formatKRW(result.mainResult.penaltyUnderReport)} 원</td>
                      </tr>
                      <tr className="sub-row">
                        <td className="indent">- 납부지연</td>
                        <td className="amount">{formatKRW(result.mainResult.penaltyLatePayment)} 원</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td>⑰ 기신고세액</td>
                    <td className="amount">(-) {formatKRW(result.mainResult.line17_prevTaxPaid)} 원</td>
                  </tr>
                  <tr className="total">
                    <td>⑱ 납부할 세액 (양도소득세)</td>
                    <td className="amount">{formatKRW(result.mainResult.line18_taxDue)} 원</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* 농어촌특별세 */}
            {result.mainResult.ruralSpecialTax && result.mainResult.line11_taxRelief > 0 && (
              <section className="result-detail" style={{ marginTop: '1.5rem' }}>
                <h3>농어촌특별세 (농특세법 제5조)</h3>
                <table className="result-table">
                  <tbody>
                    <tr>
                      <td>감면세액 합계</td>
                      <td className="amount">{formatKRW(result.mainResult.line11_taxRelief)} 원</td>
                    </tr>
                    <tr>
                      <td>농특세 과세 대상 감면액</td>
                      <td className="amount">{formatKRW(result.mainResult.ruralSpecialTax.taxableReliefAmount)} 원</td>
                    </tr>
                    <tr>
                      <td>농특세 비과세 감면액</td>
                      <td className="amount">{formatKRW(result.mainResult.ruralSpecialTax.exemptReliefAmount)} 원</td>
                    </tr>
                    <tr>
                      <td>세율</td>
                      <td className="amount">{result.mainResult.ruralSpecialTax.taxRate}%</td>
                    </tr>
                    <tr className="highlight">
                      <td>농어촌특별세액</td>
                      <td className="amount">{formatKRW(result.mainResult.ruralSpecialTax.taxAmount)} 원</td>
                    </tr>
                  </tbody>
                </table>

                {/* 농특세 상세 내역 */}
                {result.mainResult.ruralSpecialTax.details.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>감면별 농특세 내역</h4>
                    {result.mainResult.ruralSpecialTax.details.map((detail, idx) => (
                      <div key={idx} style={{
                        padding: '0.5rem',
                        backgroundColor: detail.isExempt ? '#e8f5e9' : '#fff3e0',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        fontSize: '0.85rem'
                      }}>
                        <div><strong>{detail.reliefName}</strong></div>
                        <div>감면액: {formatKRW(detail.reliefAmount)}원</div>
                        {detail.isExempt ? (
                          <div style={{ color: '#2e7d32' }}>
                            ✓ 비과세 ({detail.exemptReason})
                          </div>
                        ) : (
                          <div style={{ color: '#e65100' }}>
                            농특세: {formatKRW(detail.ruralTaxAmount)}원
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 감면 한도 적용 결과 */}
            {result.mainResult.reliefLimitResult && result.mainResult.reliefLimitResult.requestedAmount > 0 && (
              <section className="result-detail" style={{ marginTop: '1.5rem' }}>
                <h3>감면 종합한도 적용 (조특법 제133조)</h3>
                <table className="result-table">
                  <tbody>
                    <tr>
                      <td>한도 대상 감면 요청액</td>
                      <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.requestedAmount)} 원</td>
                    </tr>
                    <tr>
                      <td>연간 한도</td>
                      <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.annualLimit)} 원</td>
                    </tr>
                    <tr>
                      <td>5년 한도</td>
                      <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.fiveYearLimit)} 원</td>
                    </tr>
                    <tr>
                      <td>직전 4년 사용액</td>
                      <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.prevFourYearsUsed)} 원</td>
                    </tr>
                    {result.mainResult.reliefLimitResult.exceededAmount > 0 && (
                      <tr className="sub-row" style={{ color: '#c62828' }}>
                        <td>한도 초과액 (감면 배제)</td>
                        <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.exceededAmount)} 원</td>
                      </tr>
                    )}
                    <tr className="highlight">
                      <td>한도 적용 후 감면액</td>
                      <td className="amount">{formatKRW(result.mainResult.reliefLimitResult.limitedAmount)} 원</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}

            {/* 총 납부세액 요약 */}
            <section className="result-summary" style={{ marginTop: '1.5rem' }}>
              <h3>총 납부세액</h3>
              <table className="result-table">
                <tbody>
                  <tr>
                    <td>양도소득세</td>
                    <td className="amount">{formatKRW(result.mainResult.line18_taxDue)} 원</td>
                  </tr>
                  {result.mainResult.ruralSpecialTax && result.mainResult.ruralSpecialTax.taxAmount > 0 && (
                    <tr>
                      <td>농어촌특별세</td>
                      <td className="amount">{formatKRW(result.mainResult.ruralSpecialTax.taxAmount)} 원</td>
                    </tr>
                  )}
                  <tr className="total">
                    <td><strong>합계</strong></td>
                    <td className="amount"><strong>{formatKRW(result.mainResult.totalTaxDue)} 원</strong></td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* 자산별 내역 */}
            <section className="result-assets">
              <h3>자산별 계산 결과</h3>
              {result.assetResults.map((ar, idx) => (
                <div key={ar.assetId} className="asset-result-card">
                  <h4>자산 {idx + 1} ({ar.assetType})</h4>
                  <div className="asset-result-grid">
                    <div>
                      <span className="label">양도차익:</span>
                      <span className="value">{formatKRW(ar.transferGainTotal)} 원</span>
                    </div>
                    <div>
                      <span className="label">과세대상:</span>
                      <span className="value">{formatKRW(ar.taxableTransferGain)} 원</span>
                    </div>
                    <div>
                      <span className="label">장특공:</span>
                      <span className="value">{ar.ltDeductionRate}% ({formatKRW(ar.taxableLtDeduction)} 원)</span>
                    </div>
                    <div>
                      <span className="label">양도소득금액:</span>
                      <span className="value">{formatKRW(ar.gainIncome)} 원</span>
                    </div>
                    <div>
                      <span className="label">세율코드:</span>
                      <span className="value">{ar.rateCode}</span>
                    </div>
                    <div>
                      <span className="label">기본공제배분:</span>
                      <span className="value">{formatKRW(ar.basicDeductionAllocated)} 원</span>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* 경고/오류 */}
            {result.warnings.length > 0 && (
              <section className="result-warnings">
                <h3>경고</h3>
                <ul>
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.errors.length > 0 && (
              <section className="result-errors">
                <h3>오류</h3>
                <ul>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 고지 */}
            <div className="notice notice-warning">
              <strong>안내</strong>
              <p>
                본 계산 결과는 정보 제공 목적이며, 세무 자문이 아닙니다.
                정확한 신고를 위해 세무 전문가와 상담하시기 바랍니다.
                법적 효력이 있는 신고는 홈택스를 통해 진행하세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="no-result">
            <p>계산 결과가 없습니다. 다시 계산해주세요.</p>
          </div>
        )}

        <div className="result-actions">
          <Button variant="secondary" onClick={handleCalculate} disabled={isCalculating}>
            다시 계산
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={!isDirty}>
            저장
          </Button>
        </div>
      </div>

      <div className="step-actions">
        <Button type="button" variant="ghost" onClick={prevStep}>
          이전
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            // PDF 미리보기/다운로드로 이동
            const nextStep = useTaxCaseStore.getState().nextStep;
            nextStep();
          }}
        >
          PDF 출력
        </Button>
      </div>
    </div>
  );
}
