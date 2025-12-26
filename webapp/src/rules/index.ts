// 연도별 룰팩 로더
import rates2024 from './2024/rates.json';
import ltDeduction2024 from './2024/ltDeduction.json';
import penalty2024 from './2024/penalty.json';
import basicDeduction2024 from './2024/basicDeduction.json';
import highValueHousing2024 from './2024/highValueHousing.json';
import eFilingCredit2024 from './2024/eFilingCredit.json';
import giftAndCarryover2024 from './2024/giftAndCarryover.json';

export interface RulePack {
  rates: typeof rates2024;
  ltDeduction: typeof ltDeduction2024;
  penalty: typeof penalty2024;
  basicDeduction: typeof basicDeduction2024;
  highValueHousing: typeof highValueHousing2024;
  eFilingCredit: typeof eFilingCredit2024;
  giftAndCarryover: typeof giftAndCarryover2024;
}

const rulePacks: Record<number, RulePack> = {
  2024: {
    rates: rates2024,
    ltDeduction: ltDeduction2024,
    penalty: penalty2024,
    basicDeduction: basicDeduction2024,
    highValueHousing: highValueHousing2024,
    eFilingCredit: eFilingCredit2024,
    giftAndCarryover: giftAndCarryover2024,
  },
  2023: {
    rates: rates2024, // 2023도 동일 (필요시 별도 파일)
    ltDeduction: ltDeduction2024,
    penalty: penalty2024,
    basicDeduction: basicDeduction2024,
    highValueHousing: highValueHousing2024,
    eFilingCredit: eFilingCredit2024,
    giftAndCarryover: giftAndCarryover2024,
  },
  2025: {
    rates: rates2024, // 2025도 동일 (필요시 별도 파일)
    ltDeduction: ltDeduction2024,
    penalty: penalty2024,
    basicDeduction: basicDeduction2024,
    highValueHousing: highValueHousing2024,
    eFilingCredit: eFilingCredit2024,
    giftAndCarryover: giftAndCarryover2024,
  },
};

export function getRulePack(year: number): RulePack {
  const pack = rulePacks[year];
  if (!pack) {
    // 기본값으로 가장 최신 룰팩 반환
    return rulePacks[2024];
  }
  return pack;
}

export { rates2024, ltDeduction2024, penalty2024, basicDeduction2024, highValueHousing2024, eFilingCredit2024, giftAndCarryover2024 };
