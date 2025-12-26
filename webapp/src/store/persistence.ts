// IndexedDB 기반 영구 저장소
import localforage from 'localforage';
import type { TaxCase, CalculationResult } from '../schemas';

// IndexedDB 인스턴스 설정
const caseStore = localforage.createInstance({
  name: 'capitalGainsTax',
  storeName: 'cases',
  description: '양도소득세 신고서 케이스 저장소',
});

const calcStore = localforage.createInstance({
  name: 'capitalGainsTax',
  storeName: 'calculations',
  description: '계산 결과 저장소',
});

const settingsStore = localforage.createInstance({
  name: 'capitalGainsTax',
  storeName: 'settings',
  description: '앱 설정 저장소',
});

// 케이스 CRUD
export async function saveCase(taxCase: TaxCase): Promise<void> {
  await caseStore.setItem(taxCase.id, taxCase);
}

export async function loadCase(id: string): Promise<TaxCase | null> {
  return await caseStore.getItem<TaxCase>(id);
}

export async function deleteCase(id: string): Promise<void> {
  await caseStore.removeItem(id);
  await calcStore.removeItem(id);
}

export async function listCases(): Promise<TaxCase[]> {
  const cases: TaxCase[] = [];
  await caseStore.iterate<TaxCase, void>((value) => {
    cases.push(value);
  });
  return cases.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// 계산 결과
export async function saveCalculation(result: CalculationResult): Promise<void> {
  await calcStore.setItem(result.caseId, result);
}

export async function loadCalculation(caseId: string): Promise<CalculationResult | null> {
  return await calcStore.getItem<CalculationResult>(caseId);
}

// 설정
export interface AppSettings {
  lastCaseId?: string;
  recentCaseIds: string[];
  uiPreferences: {
    showTooltips: boolean;
    showEvidence: boolean;
  };
}

const defaultSettings: AppSettings = {
  recentCaseIds: [],
  uiPreferences: {
    showTooltips: true,
    showEvidence: true,
  },
};

export async function loadSettings(): Promise<AppSettings> {
  const settings = await settingsStore.getItem<AppSettings>('app');
  return settings ?? defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await settingsStore.setItem('app', settings);
}

// 전체 초기화 (디버그용)
export async function clearAllData(): Promise<void> {
  await caseStore.clear();
  await calcStore.clear();
  await settingsStore.clear();
}
