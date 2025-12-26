# 전수조사 SOP (Field Catalog + Rule Matrix + Scenario Test)

본 SOP는 “무엇을 구현해야 완전한지”를 100% 가시화하고, 구현 완료 판정을 코드가 아닌 **스펙+테스트**로 강제하기 위한 운영 절차입니다.

## A. 산출물(Artifacts) 5종
1) Field Catalog: `docs/spec/field_catalog.csv`  
2) Rule Matrix: `docs/spec/rule_matrix.csv`  
3) Enum Registry: `docs/spec/enum_registry.json`  
4) Scenario Test Suite: `docs/tests/SCENARIOS.md` + `tests/scenarios/*.json`  
5) Evidence Log: `docs/spec/evidence_log.md`

## B. 전수조사 흐름(하루 루틴)
1) 오늘 범위 1개만 선택(서식 1페이지 or 규칙군 1개)
2) Field Catalog 업데이트
3) Rule Matrix 업데이트(근거 링크 필수)
4) Scenario 3개(대표 1 + 경계 2) 추가
5) 테스트 통과
6) Evidence Log 기록(확인일/버전)
7) Git 커밋

## C. 누락 방지 게이트
- Field Catalog에서 `Gate=Y`인데 `OutputMapping` 비면 PR 차단
- Rule Matrix에서 `Gate=Y`인데 `Evidence` 또는 `TestID` 비면 PR 차단
- `npm run spec:check` 를 CI/로컬에서 항상 통과해야 함

## D. 홈택스 골든 비교(자격증명 공유 없이)
- 사용자가 직접 홈택스에서 동일 시나리오 입력 → 출력(PDF) 저장
- 골든 PDF를 `docs/tests/golden/`에 보관(개인정보 마스킹 권장)
- 우리 앱 출력과 “필드 값/페이지 구성” 비교

