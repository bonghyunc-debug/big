# 2024 자산별 검증 매트릭스

| 자산 유형 | 사용 부표 | 필수 필드 | 필수 부표/첨부 | 주요 오류 메시지 |
| --- | --- | --- | --- | --- |
| 부동산(land/building/mixed_use) | `schemas/2024/schedules/real_estate.json` | `assetId`, `assetType`, `location`, `acquisitionDate`, `transferDate`, `acquisitionPrice`, `transferPrice`, `holdingYears`, `gain` | 취득/양도 계약서 스캔본, 취득 원가 영수증 | `transferDate must be after acquisitionDate`; `gain mismatch with schedule formula`; `longTermDeductionRate exceeds limit.real_estate` |
| 금융자산(listed/unlisted/foreign) | `schemas/2024/schedules/financial_assets.json` | `assetId`, `marketType`, `acquisitionDate`, `transferDate`, `quantity`, `acquisitionPrice`, `transferPrice`, `gain` | 체결내역서(PDF), 수수료 명세 | `after: acquisitionDate`, `quantity must be >=1`, `gain mismatch for weighted calculation` |
| 가상자산 | `schemas/2024/schedules/virtual_assets.json` | `assetId`, `symbol`, `exchange`, `acquisitionDate`, `transferDate`, `quantity`, `acquisitionPrice`, `transferPrice`, `gain` | 거래소 거래내역(CSV), 수수료 영수증 | `after: acquisitionDate`, `quantity below minimum tick`, `gain mismatch for virtual_assets formula` |
| 본표 | `schemas/2024/form.json` | `filingYear`, `taxpayerId`, `residentType`, `aggregateTransferAmount`, `aggregateAcquisitionAmount`, `aggregateExpenses`, `aggregateNetGain`, `basicDeduction`, `taxableBase`, `progressiveTax` | 부표 합계(`real_estate`, `financial_assets`, `virtual_assets`), 기본공제 한도 테이블(`tables/2024/rates.json`) | `aggregate* must equal schedule aggregates`, `basicDeduction exceeds limit`, `taxableBase negative not allowed`, `progressiveTax not aligned with rate table` |

## 교차검증 요약
- 부표 합계(`totalTransferAmount`, `totalAcquisitionAmount`, `totalExpenses`, `totalGain`)는 본표 `bindings.scheduleBindings`를 통해 반드시 일치해야 한다.
- 장기보유특별공제율은 자산 유형별 `longTermHoldingSpecialDeductionLimit` 브래킷 이하여야 하며, 초과 시 캡핑 후 다시 계산한다.
- 기본공제는 `basicDeduction.appliesPerReturn=true` 기준으로 합산 후 1회 적용한다.
- 신고연도(`filingYear`)와 거주자 구분(`residentType`) 누락 시 부표 검증에 앞서 즉시 오류를 반환한다.
