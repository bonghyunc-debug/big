import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  PDFViewer,
  PDFDownloadLink,
} from '@react-pdf/renderer';
import type { TaxCase, CalculationResult } from '../../schemas';
import { ReportTypeLabels, AssetTypeLabels } from '../../schemas';
import { formatKRW, maskRRN } from '../../engine/utils';

// 스타일 정의
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 5,
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 3,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 3,
  },
  cellLabel: {
    flex: 2,
    paddingHorizontal: 3,
  },
  cellValue: {
    flex: 1,
    textAlign: 'right',
    paddingHorizontal: 3,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 3,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 3,
    fontSize: 8,
  },
  tableCellSmall: {
    flex: 0.5,
    paddingHorizontal: 2,
    fontSize: 7,
  },
  disclaimer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff3cd',
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatureBox: {
    width: 150,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 30,
    paddingTop: 5,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 5,
  },
  checkboxChecked: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#000',
    marginRight: 5,
  },
});

interface TaxFormPDFProps {
  taxCase: TaxCase;
  result: CalculationResult;
  maskSensitive?: boolean;
}

// 메인 신고서 PDF 문서
function TaxFormDocument({ taxCase, result, maskSensitive = true }: TaxFormPDFProps) {
  const { taxpayer } = taxCase;
  const { mainResult, assetResults } = result;

  const displayRRN = maskSensitive ? maskRRN(taxpayer.rrn) : taxpayer.rrn;

  return (
    <Document>
      {/* 메인 신고서 (별지 제84호) */}
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>양도소득과세표준 신고 및 납부계산서</Text>
          <Text style={styles.subtitle}>(별지 제84호서식)</Text>
        </View>

        {/* 신고구분 체크박스 */}
        <View style={[styles.section, { flexDirection: 'row', justifyContent: 'center' }]}>
          <View style={{ flexDirection: 'row', marginRight: 20 }}>
            <View style={taxCase.reportType === 'PRELIM' ? styles.checkboxChecked : styles.checkbox} />
            <Text>예정신고</Text>
          </View>
          <View style={{ flexDirection: 'row', marginRight: 20 }}>
            <View style={taxCase.reportType === 'FINAL' ? styles.checkboxChecked : styles.checkbox} />
            <Text>확정신고</Text>
          </View>
          <View style={{ flexDirection: 'row', marginRight: 20 }}>
            <View style={taxCase.reportType === 'AMEND' ? styles.checkboxChecked : styles.checkbox} />
            <Text>수정신고</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={taxCase.reportType === 'LATE' ? styles.checkboxChecked : styles.checkbox} />
            <Text>기한후신고</Text>
          </View>
        </View>

        {/* 신고인 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 신고인</Text>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>성명</Text>
            <Text style={styles.cellValue}>{taxpayer.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>주민등록번호</Text>
            <Text style={styles.cellValue}>{displayRRN}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>주소</Text>
            <Text style={styles.cellValue}>{taxpayer.address}</Text>
          </View>
          {taxpayer.phone && (
            <View style={styles.row}>
              <Text style={styles.cellLabel}>전화번호</Text>
              <Text style={styles.cellValue}>{taxpayer.phone}</Text>
            </View>
          )}
        </View>

        {/* 세율구분 집계 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 세율구분별 양도소득금액 (③)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellSmall}>세율코드</Text>
              <Text style={styles.tableCell}>자산수</Text>
              <Text style={[styles.tableCell, { textAlign: 'right' }]}>양도소득금액</Text>
            </View>
            {mainResult.rateCategorySummary.map((summary, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{summary.rateCode}</Text>
                <Text style={styles.tableCell}>{summary.assetCount}건</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>
                  {formatKRW(summary.gainIncomeSum)}원
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 계산 내역 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 세액 계산</Text>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>④ 양도소득금액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line04_gainIncomeTotal)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑤ 기신고 양도소득금액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line05_prevReportedGainIncome)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑥ 소득감면대상 소득금액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line06_incomeDeductionBase)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑦ 양도소득기본공제</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line07_basicDeduction)}원</Text>
          </View>
          <View style={[styles.row, { backgroundColor: '#f0f0f0' }]}>
            <Text style={styles.cellLabel}>⑧ 과세표준 (④-⑤-⑥-⑦)</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line08_taxBase)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑨ 세율</Text>
            <Text style={styles.cellValue}>{mainResult.line09_rateLabel}</Text>
          </View>
          <View style={[styles.row, { backgroundColor: '#f0f0f0' }]}>
            <Text style={styles.cellLabel}>⑩ 산출세액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line10_taxBeforeCredits)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑪ 감면세액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line11_taxRelief)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑫ 외국납부세액공제</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line12_foreignTaxCredit)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑬ 원천징수세액공제</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line13_withholdingCredit)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑭ 연금계좌세액공제</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line14_pensionCredit)}원</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑮ 전자신고세액공제</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line15_eFilingCredit)}원</Text>
          </View>

          {mainResult.penaltyTotal > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.cellLabel}>⑯ 가산세 (계)</Text>
                <Text style={styles.cellValue}>{formatKRW(mainResult.penaltyTotal)}원</Text>
              </View>
              <View style={[styles.row, { paddingLeft: 20 }]}>
                <Text style={styles.cellLabel}>- 무(과소)신고</Text>
                <Text style={styles.cellValue}>{formatKRW(mainResult.penaltyUnderReport)}원</Text>
              </View>
              <View style={[styles.row, { paddingLeft: 20 }]}>
                <Text style={styles.cellLabel}>- 납부지연</Text>
                <Text style={styles.cellValue}>{formatKRW(mainResult.penaltyLatePayment)}원</Text>
              </View>
            </>
          )}

          <View style={styles.row}>
            <Text style={styles.cellLabel}>⑰ 기신고세액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line17_prevTaxPaid)}원</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.cellLabel}>⑱ 납부할 세액</Text>
            <Text style={styles.cellValue}>{formatKRW(mainResult.line18_taxDue)}원</Text>
          </View>
        </View>

        {/* 서명란 */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>신고인 (서명 또는 인)</Text>
          </View>
        </View>

        {/* 고지 */}
        <View style={styles.disclaimer}>
          <Text>
            본 문서는 정보 제공 목적으로 생성되었으며, 법적 효력이 있는 공식 신고서가 아닙니다.
            실제 양도소득세 신고는 홈택스(www.hometax.go.kr)를 통해 진행하시기 바랍니다.
          </Text>
        </View>

        {/* 푸터 */}
        <Text style={styles.footer}>
          생성일시: {new Date().toLocaleString('ko-KR')} | 양도소득세 신고서 작성 도우미
        </Text>
      </Page>

      {/* 부표1 - 부동산 자산별 내역 */}
      {taxCase.bp1Assets.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>부표1. 양도소득금액 계산명세서</Text>
            <Text style={styles.subtitle}>(부동산 등)</Text>
          </View>

          {assetResults
            .filter((r) => r.assetType === 'BP1')
            .map((ar, idx) => {
              const asset = taxCase.bp1Assets.find((a) => a.id === ar.assetId);
              if (!asset) return null;

              return (
                <View key={ar.assetId} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    자산 {idx + 1}: {AssetTypeLabels[asset.assetTypeCode] ?? asset.assetTypeCode}
                  </Text>

                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>세율구분코드</Text>
                    <Text style={styles.cellValue}>{asset.rateCode}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>양도일</Text>
                    <Text style={styles.cellValue}>{asset.transferDate}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>취득일</Text>
                    <Text style={styles.cellValue}>{asset.acquireDate}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑪ 양도가액</Text>
                    <Text style={styles.cellValue}>{formatKRW(asset.transferPrice)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑫ 취득가액</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.effectiveAcquirePrice)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑭ 필요경비</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.effectiveExpense)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>양도차익</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.transferGainTotal)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑮ 과세대상양도차익</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.taxableTransferGain)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>장특공율 ({asset.ltDeductionCode})</Text>
                    <Text style={styles.cellValue}>{ar.ltDeductionRate}%</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑰ 장특공액</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.taxableLtDeduction)}원</Text>
                  </View>
                  <View style={[styles.row, { backgroundColor: '#f0f0f0' }]}>
                    <Text style={styles.cellLabel}>⑱ 양도소득금액</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.gainIncome)}원</Text>
                  </View>
                </View>
              );
            })}

          <Text style={styles.footer}>
            부표1 - 양도소득금액 계산명세서 (부동산 등)
          </Text>
        </Page>
      )}

      {/* 부표2 - 주식 자산별 내역 */}
      {taxCase.bp2Assets.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>부표2. 양도소득금액 계산명세서</Text>
            <Text style={styles.subtitle}>(주식등)</Text>
          </View>

          {assetResults
            .filter((r) => r.assetType === 'BP2')
            .map((ar, idx) => {
              const asset = taxCase.bp2Assets.find((a) => a.id === ar.assetId);
              if (!asset) return null;

              return (
                <View key={ar.assetId} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    주식 {idx + 1}: {asset.issuerName}
                  </Text>

                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>종목코드</Text>
                    <Text style={styles.cellValue}>{asset.securityId ?? '-'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>양도일</Text>
                    <Text style={styles.cellValue}>{asset.transferDate}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>양도수량</Text>
                    <Text style={styles.cellValue}>{asset.quantity}주</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑩ 양도가액</Text>
                    <Text style={styles.cellValue}>{formatKRW(asset.transferPrice)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑬ 취득가액</Text>
                    <Text style={styles.cellValue}>{formatKRW(asset.acquirePrice)}원</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.cellLabel}>⑭ 필요경비</Text>
                    <Text style={styles.cellValue}>{formatKRW(asset.necessaryExpense)}원</Text>
                  </View>
                  <View style={[styles.row, { backgroundColor: '#f0f0f0' }]}>
                    <Text style={styles.cellLabel}>⑮ 양도소득금액</Text>
                    <Text style={styles.cellValue}>{formatKRW(ar.gainIncome)}원</Text>
                  </View>
                </View>
              );
            })}

          <Text style={styles.footer}>
            부표2 - 양도소득금액 계산명세서 (주식등)
          </Text>
        </Page>
      )}

      {/* 첨부서류 체크리스트 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>첨부서류 체크리스트</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>공통 첨부서류</Text>
          <View style={styles.row}>
            <View style={styles.checkbox} />
            <Text>양도소득과세표준 신고서 (별지 제84호서식)</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.checkbox} />
            <Text>양도소득금액 계산명세서 (부표1, 2 등)</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.checkbox} />
            <Text>매매계약서 사본</Text>
          </View>
        </View>

        {taxCase.bp1Assets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>부동산 관련 (부표1 자산)</Text>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>등기사항증명서 (취득/양도 시점)</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>토지대장 또는 건축물대장</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>취득세 납부영수증</Text>
            </View>
            {taxCase.bp1Assets.some((a) => a.userFlags.oneHouseExemption) && (
              <>
                <View style={styles.row}>
                  <View style={styles.checkbox} />
                  <Text>주민등록등본 (1세대1주택 확인용)</Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.checkbox} />
                  <Text>전입세대열람내역 (거주기간 확인용)</Text>
                </View>
              </>
            )}
          </View>
        )}

        {taxCase.bp2Assets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>주식 관련 (부표2 자산)</Text>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>주식양수도계약서</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>주주명부 또는 주식등변동상황명세서</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>증권거래내역서 (증권사 발급)</Text>
            </View>
          </View>
        )}

        {taxCase.reliefs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>감면 관련</Text>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>감면신청서 (조세특례제한법상 해당 서식)</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.checkbox} />
              <Text>감면요건 증빙서류</Text>
            </View>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Text>
            위 체크리스트는 참고용입니다. 개별 상황에 따라 추가 서류가 필요할 수 있으며,
            정확한 첨부서류는 국세청 안내를 확인하세요.
          </Text>
        </View>

        <Text style={styles.footer}>
          첨부서류 체크리스트
        </Text>
      </Page>
    </Document>
  );
}

// PDF 뷰어 컴포넌트
export function TaxFormPDFViewer({ taxCase, result, maskSensitive = true }: TaxFormPDFProps) {
  return (
    <PDFViewer style={{ width: '100%', height: '600px' }}>
      <TaxFormDocument taxCase={taxCase} result={result} maskSensitive={maskSensitive} />
    </PDFViewer>
  );
}

// PDF 다운로드 링크 컴포넌트
export function TaxFormPDFDownload({ taxCase, result, maskSensitive = true }: TaxFormPDFProps) {
  const fileName = `양도소득세신고서_${taxCase.taxYear}년_${taxCase.taxpayer.name || '미입력'}.pdf`;

  return (
    <PDFDownloadLink
      document={<TaxFormDocument taxCase={taxCase} result={result} maskSensitive={maskSensitive} />}
      fileName={fileName}
      className="btn btn-primary"
    >
      {({ loading }) => (loading ? 'PDF 생성 중...' : 'PDF 다운로드')}
    </PDFDownloadLink>
  );
}

export { TaxFormDocument };
