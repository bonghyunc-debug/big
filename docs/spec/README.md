# spec 파일 스키마

## field_catalog.csv
- 한 줄 = 한 FieldID
- “서식에 찍히는 모든 값”은 Field로 등록(합계, 체크박스, 코드, 고지문구 포함)
- Gate=Y: 완전 구현 대상(게이트 검사 대상)

권장 컬럼(이 repo 기본):
- FieldID, Form, Page, Section, Label, DataType, Cardinality, RequiredIf,
  InputOrCalc, EnumKey, Min, Max, Pattern, Unit,
  UIPath, OutputMapping, Evidence, Notes, Gate

## rule_matrix.csv
- 한 줄 = 한 RuleID
- Type: CALC / VAL / OUT
- Gate=Y: 완전 구현 대상(게이트 검사 대상)

권장 컬럼:
- RuleID, Type, Scope, Trigger, InputFields, OutputFields,
  FormulaOrConstraint, Rounding, Limit, EffectiveFrom, EffectiveTo,
  Evidence, TestID, ImplRef, Notes, Gate

## enum_registry.json
- 드롭다운/코드표의 단일 출처
- 룰팩(연도/시행일)에 따라 덮어쓸 수 있게 설계

