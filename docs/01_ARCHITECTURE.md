# 아키텍처 설계(스펙-구동형)

## 1) 레이어
- `src/domain/`
  - 타입/스키마(Zod)
  - 필드/룰 정의 로더(rulepack)
  - 계산 엔진(tax engine)
  - 검증 엔진(validation)
- `src/steps/`
  - 스텝퍼 UI(입력 폼)
  - 필드 정의 기반 폼 생성(가능하면)
- `src/storage/`
  - IndexedDB 저장(케이스 버전 스냅샷)
- `src/pdf/`
  - 서식 템플릿 렌더링(필드 매핑 기반)
  - 첨부서류 체크리스트 출력

## 2) 데이터 흐름
Input(CaseFile) → Derived(서식 필드 계산) → TaxEngine(세액/중간값) → OutputMapping(PDF)

## 3) “판정” 분리
- 판정값은 사용자가 선택/입력
- 엔진은 “판정값을 인자로 받은 계산/검증”만 수행
- 판정 도우미(Q&A)는 OUT/UX 영역(결정은 사용자가)

