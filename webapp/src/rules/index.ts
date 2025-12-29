// 연도별 룰팩 로더
import rates2024 from './2024/rates.json';
import ltDeduction2024 from './2024/ltDeduction.json';
import penalty2024 from './2024/penalty.json';
import basicDeduction2024 from './2024/basicDeduction.json';
import highValueHousing2024 from './2024/highValueHousing.json';
import eFilingCredit2024 from './2024/eFilingCredit.json';
import giftAndCarryover2024 from './2024/giftAndCarryover.json';
import reliefs2024 from './2024/reliefs.json';
import ruralSpecialTax2024 from './2024/ruralSpecialTax.json';
import acquisitionRules2024 from './2024/acquisitionRules.json';

export interface RulePack {
  rates: typeof rates2024;
  ltDeduction: typeof ltDeduction2024;
  penalty: typeof penalty2024;
  basicDeduction: typeof basicDeduction2024;
  highValueHousing: typeof highValueHousing2024;
  eFilingCredit: typeof eFilingCredit2024;
  giftAndCarryover: typeof giftAndCarryover2024;
  reliefs: typeof reliefs2024;
  ruralSpecialTax: typeof ruralSpecialTax2024;
  acquisitionRules: typeof acquisitionRules2024;
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
    reliefs: reliefs2024,
    ruralSpecialTax: ruralSpecialTax2024,
    acquisitionRules: acquisitionRules2024,
  },
  2023: {
    rates: rates2024,
    ltDeduction: ltDeduction2024,
    penalty: penalty2024,
    basicDeduction: basicDeduction2024,
    highValueHousing: highValueHousing2024,
    eFilingCredit: eFilingCredit2024,
    giftAndCarryover: giftAndCarryover2024,
    reliefs: reliefs2024,
    ruralSpecialTax: ruralSpecialTax2024,
    acquisitionRules: acquisitionRules2024,
  },
  2025: {
    rates: rates2024,
    ltDeduction: ltDeduction2024,
    penalty: penalty2024,
    basicDeduction: basicDeduction2024,
    highValueHousing: highValueHousing2024,
    eFilingCredit: eFilingCredit2024,
    giftAndCarryover: giftAndCarryover2024,
    reliefs: reliefs2024,
    ruralSpecialTax: ruralSpecialTax2024,
    acquisitionRules: acquisitionRules2024,
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

export {
  rates2024,
  ltDeduction2024,
  penalty2024,
  basicDeduction2024,
  highValueHousing2024,
  eFilingCredit2024,
  giftAndCarryover2024,
  reliefs2024,
  ruralSpecialTax2024,
  acquisitionRules2024,
};
