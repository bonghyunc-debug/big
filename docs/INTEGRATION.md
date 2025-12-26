# 기존 코드베이스에 이 킷을 병합하는 방법

## 1) 폴더 복사(권장)
- `docs/` 전체
- `scripts/spec/` 전체
- `tests/scenarios/` 템플릿

## 2) package.json에 스크립트 추가
```json
{
  "scripts": {
    "spec:check": "node scripts/spec/check-spec.mjs",
    "spec:progress": "node scripts/spec/progress.mjs"
  }
}
```

## 3) 구현 진행 중 “게이트” 관리
- 구현이 끝난 FieldID/RuleID는 `docs/spec/implementation_map.csv`에서 Status를 `DONE`으로 변경
- ImplRef는 코드 위치(예: `src/domain/tax/engine.ts#calcBasicDeduction`)
- TestRef는 테스트 위치(예: `src/domain/tax/__tests__/T-DED-001.test.ts`)

