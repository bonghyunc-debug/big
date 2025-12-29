# 양도소득세 신고 앱 - HomeTax 수준 구현 계획

## 목표
홈택스 양도소득세 정기신고 > 일반신고와 동등한 수준의 완성도 달성

---

## Phase 1: 핵심 누락 기능 구현 (필수)

### 1.1 입력 검증 강화

#### 1.1.1 날짜 검증
- [ ] 취득일 < 양도일 검증
- [ ] 상속개시일 ≤ 양도일
- [ ] 증여일 ≤ 양도일
- [ ] 사업인정고시일 검증 (공익사업)
- [ ] 조정대상지역 지정일 기준 검증

#### 1.1.2 금액 검증
- [ ] 양도가액 > 0
- [ ] 취득가액 ≤ 양도가액 (경고, 차손 가능)
- [ ] 필요경비 합계 ≤ 양도가액
- [ ] 감면대상금액 ≤ 양도차익
- [ ] 감면한도 사전 경고

#### 1.1.3 비즈니스 로직 검증
- [ ] 1세대1주택: 보유2년 + 조정지역 거주2년 요건
- [ ] 자경농지: 8년 자경 + 거주지 요건
- [ ] 장기임대: 10년 임대등록 요건
- [ ] 다주택 중과: 주택수 + 조정지역 판정

### 1.2 고급 기능 UI 구현

#### 1.2.1 상속자산 상세 폼 (`InheritanceDetailForm.tsx`)
```typescript
// 필요 입력 필드
- 상속개시일 (피상속인 사망일)
- 피상속인 취득일
- 피상속인 취득가액
- 피상속인 취득원인 (매매/상속/증여/신축 등)
- 상속세 평가액
- 동일세대 여부 (체크박스)
- 피상속인 보유기간 (자동계산 + 수동입력)
- 피상속인 거주기간 (1세대1주택용)
- 가업상속 여부 (체크박스)
```

#### 1.2.2 이월과세 상세 폼 (`CarryoverTaxDetailForm.tsx`)
```typescript
// 필요 입력 필드
- 증여일
- 증여자 취득일
- 증여자 취득가액
- 증여세 납부(예정)액
- 증여세 과세표준
- 전체 증여재산 과세표준 (안분계산용)
- 증여자 관계 (배우자/직계존비속)
- 적용배제 사유 선택
  - NONE: 적용
  - ONE_HOUSE_EXEMPTION: 1세대1주택 비과세
  - LOWER_TAX_BENEFIT: 미적용이 유리
  - SPOUSE_DEATH: 배우자 사망
  - PUBLIC_ACQUISITION: 공익사업 수용
  - RELATIONSHIP_TERMINATED: 직계존비속 관계 소멸
- 이월과세 적용 여부 표시 (자동판정 결과)
- 비교계산 결과 표시 (적용 vs 미적용 세액)
```

#### 1.2.3 부담부증여 상세 폼 (`GiftWithDebtForm.tsx`)
```typescript
// 필요 입력 필드
- 증여재산 평가액
- 인수채무액
- 증여자 취득가액
- 채무비율 (자동계산)
- 양도차익 안분 결과 표시
```

#### 1.2.4 1세대1주택 비과세 검증 폼 (`OneHouseExemptionForm.tsx`)
```typescript
// 필요 입력 필드
- 실제 보유기간 (년)
- 실제 거주기간 (년)
- 동일세대 상속 보유기간 통산 (년)
- 동일세대 상속 거주기간 통산 (년)
- 보유요건 면제 사유
  - NONE
  - OVERSEAS_EMIGRATION: 해외이주
  - OVERSEAS_WORK_STUDY: 해외 취학/근무
  - RENTAL_HOUSING_RESIDENCE: 건설임대 5년 거주
- 거주요건 면제 사유
  - NONE
  - WORK_STUDY_ILLNESS: 취학/근무/질병
  - PRE_ADJUSTED_AREA_CONTRACT: 조정지역 고시 전 계약
- 일시적 2주택 등 예외 사유
  - NONE
  - TEMPORARY_2HOUSE: 일시적 2주택
  - INHERITED_HOUSE: 상속주택
  - MARRIAGE_MERGE: 혼인합가
  - ELDERLY_CARE: 동거봉양
  - RURAL_RELOCATION: 귀농
- 비과세 적용 가능 여부 (자동판정)
- 비과세 요건 미충족 시 사유 표시
```

#### 1.2.5 조정대상지역 정보 폼 (`AdjustedAreaInfoForm.tsx`)
```typescript
// 필요 입력 필드
- 취득 당시 조정대상지역 여부
- 현재 조정대상지역 여부
- 조정대상지역 지정 후 취득일
- 자동 판정 (주소 + 날짜 기반)
- 영향 안내 (거주요건/중과/장특공)
```

### 1.3 파생상품 (BP2_2) UI 구현

#### 1.3.1 Step3Derivative.tsx 신규
```typescript
// 파생상품 양도소득 계산명세서 (부표2의2)
- 세율구분코드 선택
- 종목명
- ⑧ 양도가액
- ⑨ 필요경비
- ⑪ 전연도 이월손익
- ⑫ 당해연도 손실
- ⑬ 이월결손
- ⑭ 기타공제
- 자동계산: ⑧-⑨-⑪-⑫+⑬-⑭
```

---

## Phase 2: 신고서 양식 완성

### 2.1 PDF 양식 구현

#### 2.1.1 양도소득과세표준신고서 (별지 제84호)
- [ ] 신고인 정보
- [ ] 양도소득금액 요약
- [ ] 세액계산 (①~⑱)
- [ ] 감면/공제 내역
- [ ] 가산세 내역
- [ ] 납부세액

#### 2.1.2 부표1 - 부동산 양도소득금액 계산명세서
- [ ] 자산별 상세
- [ ] 세율구분코드별 집계
- [ ] 장기보유특별공제 계산

#### 2.1.3 부표2 - 주식등 양도소득금액 계산명세서
- [ ] 종목별 상세
- [ ] 세율구분코드별 집계

#### 2.1.4 부표2의2 - 파생상품 양도소득금액 계산명세서
- [ ] 종목별 상세
- [ ] 손익통산 계산

#### 2.1.5 부표3 - 취득가액 및 필요경비 계산명세서
- [ ] 자산별 취득가액 상세
- [ ] 필요경비 항목별 명세

#### 2.1.6 부표4 - 양도소득세 세액감면신청서
- [ ] 감면종류별 신청내역
- [ ] 요건 충족 여부
- [ ] 감면한도 적용

#### 2.1.7 농어촌특별세 과세표준신고서
- [ ] 감면세액 × 20%
- [ ] 비과세 대상 구분

### 2.2 미리보기 개선
- [ ] 실제 신고서 양식 레이아웃
- [ ] 페이지 구분
- [ ] 인쇄 최적화

---

## Phase 3: 테스트 케이스 확충

### 3.1 자산 유형별 테스트

#### 부동산 (BP1)
- [ ] 토지 일반 양도
- [ ] 주택 2년 보유 양도
- [ ] 1세대1주택 비과세 (12억 이하)
- [ ] 1세대1주택 고가주택 (12억 초과)
- [ ] 조정대상지역 2주택 중과
- [ ] 조정대상지역 3주택 중과
- [ ] 비사업용토지 중과
- [ ] 미등기 양도
- [ ] 조합원입주권 1년 미만
- [ ] 조합원입주권 2년 이상
- [ ] 분양권 1년 미만 (70%)
- [ ] 분양권 1-2년 (60%)
- [ ] 분양권 2년 이상 (60%)

#### 상속/증여
- [ ] 상속자산 - 동일세대
- [ ] 상속자산 - 별도세대
- [ ] 증여자산 - 이월과세 적용
- [ ] 증여자산 - 이월과세 미적용 (5년 초과)
- [ ] 증여자산 - 이월과세 배제 (1세대1주택)
- [ ] 부담부증여

#### 주식 (BP2)
- [ ] 상장주식 대주주
- [ ] 비상장주식 중소기업
- [ ] 비상장주식 일반
- [ ] 국외주식

#### 파생상품 (BP2_2)
- [ ] 파생상품 5% (2018.3.31 이전)
- [ ] 파생상품 10% (2018.4.1 이후)
- [ ] 손익통산 케이스

### 3.2 감면 케이스 테스트

- [ ] 8년 자경농지 100%
- [ ] 농지대토 100%
- [ ] 공익사업 현금보상 10%
- [ ] 공익사업 채권 3년 30%
- [ ] 공익사업 채권 5년 40%
- [ ] 장기임대주택 100%
- [ ] 감면 종합한도 (연 1억) 초과
- [ ] 감면 종합한도 (5년 2억) 초과

### 3.3 복합 케이스 테스트

- [ ] 부동산 + 주식 동시 양도
- [ ] 감면 + 농어촌특별세
- [ ] 이월과세 + 감면
- [ ] 상속 + 1세대1주택
- [ ] 다자산 기본공제 배분

---

## Phase 4: 데이터 정합성 및 UX

### 4.1 데이터 검증 강화

#### 크로스필드 검증
- [ ] 날짜 순서 검증
- [ ] 금액 정합성 검증
- [ ] 요건 충족 검증
- [ ] 중복 자산 경고

#### 실시간 피드백
- [ ] 입력 시 즉시 검증
- [ ] 저장 전 전체 검증
- [ ] 오류 위치 하이라이트

### 4.2 UX 개선

#### 도움말/가이드
- [ ] 각 필드별 툴팁 강화
- [ ] 법적 근거 표시
- [ ] 입력 예시 제공
- [ ] FAQ 섹션

#### 자동화
- [ ] 세율코드 자동 판정
- [ ] 장기보유공제 자동 계산
- [ ] 보유기간 자동 계산
- [ ] 감면 요건 자동 검증

#### 편의 기능
- [ ] 자동 임시저장
- [ ] 저장 안 됨 경고
- [ ] 되돌리기/다시하기
- [ ] 이전 신고 불러오기
- [ ] 복사하여 새 신고 생성

### 4.3 접근성

- [ ] 키보드 네비게이션
- [ ] 스크린리더 지원
- [ ] 고대비 모드
- [ ] 폰트 크기 조절

---

## Phase 5: 고급 기능

### 5.1 환산취득가액 계산기
- [ ] 양도시 기준시가 입력
- [ ] 취득시 기준시가 입력
- [ ] 환산취득가액 자동 계산
- [ ] 환산율 표시

### 5.2 세금 비교 계산기
- [ ] 이월과세 적용 vs 미적용
- [ ] 장특공 적용 vs 미적용
- [ ] 감면 적용 vs 미적용
- [ ] 최적 시나리오 추천

### 5.3 납부일정 안내
- [ ] 예정신고 기한 (양도일 다음달 말)
- [ ] 확정신고 기한 (다음해 5월)
- [ ] 분납 가능 여부
- [ ] 납부지연 가산세 계산

### 5.4 첨부서류 안내
- [ ] 필요 서류 목록 자동 생성
- [ ] 서류별 안내 링크
- [ ] 체크리스트 제공

---

## Phase 6: 2025년 대응

### 6.1 2025년 세법 개정 반영
- [ ] 주식 이월과세 (1년)
- [ ] 다주택 중과 한시배제 연장 확인
- [ ] 세율 변경 확인
- [ ] 감면 규정 변경 확인

### 6.2 연도별 규칙 분리
- [ ] 2024/rules/ 복제 → 2025/rules/
- [ ] 변경사항 반영
- [ ] 연도 선택 시 규칙 자동 로드

---

## 우선순위 요약

| 순위 | Phase | 항목 | 예상 작업량 |
|------|-------|------|------------|
| 1 | 1.2 | 고급 기능 UI (상속/이월과세/부담부증여/비과세) | 대 |
| 2 | 1.1 | 입력 검증 강화 | 중 |
| 3 | 1.3 | 파생상품 UI | 소 |
| 4 | 3.1-3.3 | 테스트 케이스 확충 | 대 |
| 5 | 2.1 | 신고서 양식 PDF | 대 |
| 6 | 4.1-4.2 | 데이터 정합성/UX | 중 |
| 7 | 5.1-5.4 | 고급 기능 | 중 |
| 8 | 6.1-6.2 | 2025년 대응 | 소 |

---

## 파일 구조 변경 계획

```
src/
├── components/
│   ├── common/
│   │   └── (기존 유지)
│   ├── steps/
│   │   ├── Step0ReportType.tsx
│   │   ├── Step1Taxpayer.tsx
│   │   ├── Step2Assets.tsx
│   │   ├── Step3Stock.tsx
│   │   ├── Step3Derivative.tsx    ← 신규
│   │   ├── Step4Relief.tsx
│   │   ├── Step5Penalty.tsx
│   │   ├── Step6Result.tsx
│   │   └── Step7PDF.tsx
│   ├── forms/                      ← 신규 디렉토리
│   │   ├── InheritanceDetailForm.tsx
│   │   ├── CarryoverTaxDetailForm.tsx
│   │   ├── GiftWithDebtForm.tsx
│   │   ├── OneHouseExemptionForm.tsx
│   │   ├── AdjustedAreaInfoForm.tsx
│   │   └── ConvertedPriceCalculator.tsx
│   ├── validation/                 ← 신규 디렉토리
│   │   ├── dateValidation.ts
│   │   ├── amountValidation.ts
│   │   ├── businessRuleValidation.ts
│   │   └── crossFieldValidation.ts
│   └── pdf/
│       ├── TaxFormPDF.tsx          (기존)
│       ├── BP1FormPDF.tsx          ← 신규 (부표1)
│       ├── BP2FormPDF.tsx          ← 신규 (부표2)
│       ├── BP2_2FormPDF.tsx        ← 신규 (부표2의2)
│       ├── BP3FormPDF.tsx          ← 신규 (부표3)
│       ├── BP4FormPDF.tsx          ← 신규 (부표4)
│       └── RuralTaxFormPDF.tsx     ← 신규 (농특세)
├── tests/
│   ├── taxEngine.test.ts           (기존)
│   ├── validation.test.ts          ← 신규
│   └── scenarios/
│       ├── realEstate/             ← 확장
│       │   ├── land-basic.json
│       │   ├── house-2year.json
│       │   ├── house-1-exemption.json
│       │   ├── house-high-value.json
│       │   ├── adjusted-2house.json
│       │   ├── adjusted-3house.json
│       │   ├── non-business-land.json
│       │   ├── unregistered.json
│       │   ├── membership-1year.json
│       │   ├── membership-2year.json
│       │   ├── presale-1year.json
│       │   ├── presale-1-2year.json
│       │   └── presale-2year.json
│       ├── inheritance/            ← 신규
│       │   ├── same-household.json
│       │   ├── separate-household.json
│       │   └── business-succession.json
│       ├── gift/                   ← 신규
│       │   ├── carryover-applied.json
│       │   ├── carryover-excluded.json
│       │   └── gift-with-debt.json
│       ├── stock/                  ← 확장
│       │   ├── listed-major.json
│       │   ├── unlisted-sme.json
│       │   ├── unlisted-general.json
│       │   └── foreign.json
│       ├── derivative/             ← 신규
│       │   ├── before-2018.json
│       │   └── after-2018.json
│       ├── relief/                 ← 신규
│       │   ├── self-farm-8year.json
│       │   ├── farm-replacement.json
│       │   ├── public-cash.json
│       │   ├── public-bond-3year.json
│       │   ├── public-bond-5year.json
│       │   ├── long-term-rental.json
│       │   └── limit-exceeded.json
│       └── complex/                ← 신규
│           ├── multi-asset.json
│           ├── relief-with-rural-tax.json
│           ├── carryover-with-relief.json
│           └── inheritance-1house.json
└── rules/
    ├── 2024/                       (기존)
    └── 2025/                       ← 신규 (2025년 대응시)
```

---

## 예상 완성도

| Phase 완료 | HomeTax 대비 완성도 |
|-----------|---------------------|
| 현재 | 50% |
| Phase 1 완료 | 70% |
| Phase 2 완료 | 80% |
| Phase 3 완료 | 85% |
| Phase 4 완료 | 90% |
| Phase 5 완료 | 95% |
| Phase 6 완료 | 100% |
