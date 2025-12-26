# 골든 PDF 비교 가이드(자격증명 공유 없이)

1) 사용자가 직접 홈택스에서 시나리오 입력
2) 신고서 출력(PDF 인쇄) 저장
3) 개인정보는 마스킹(권장)
4) `docs/tests/golden/<ScenarioID>-hometax.pdf` 로 저장
5) 우리 앱 출력은 `docs/tests/golden/<ScenarioID>-app.pdf` 로 저장
6) 비교 기준:
   - 페이지 구성 동일(필요 부표 포함 여부)
   - 각 FieldID 값 동일(좌표/서체는 달라도 됨)

