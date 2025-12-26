// Zustand 기반 상태 관리
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  TaxCase,
  ReportType,
  Taxpayer,
  BP1Asset,
  BP2Asset,
  BP2_2,
  Relief,
  PenaltyInfo,
  CalculationResult,
} from '../schemas';
import {
  saveCase,
  loadCase,
  deleteCase,
  listCases,
  saveCalculation,
  loadCalculation,
} from './persistence';

interface TaxCaseState {
  // 현재 케이스
  currentCase: TaxCase | null;
  calculationResult: CalculationResult | null;

  // 저장된 케이스 목록
  savedCases: TaxCase[];

  // UI 상태
  currentStep: number;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;

  // 케이스 관리
  createNewCase: () => Promise<void>;
  loadCaseById: (id: string) => Promise<void>;
  saveCurrent: () => Promise<void>;
  deleteCaseById: (id: string) => Promise<void>;
  refreshCaseList: () => Promise<void>;

  // 스텝 네비게이션
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 0: 신고구분
  setReportType: (type: ReportType) => void;
  setTaxYear: (year: number) => void;

  // Step 1: 신고인
  setTaxpayer: (taxpayer: Taxpayer) => void;

  // Step 2: 자산
  addBP1Asset: (asset: Omit<BP1Asset, 'id'>) => void;
  updateBP1Asset: (id: string, updates: Partial<BP1Asset>) => void;
  removeBP1Asset: (id: string) => void;

  addBP2Asset: (asset: Omit<BP2Asset, 'id'>) => void;
  updateBP2Asset: (id: string, updates: Partial<BP2Asset>) => void;
  removeBP2Asset: (id: string) => void;

  setBP2_2: (bp2_2: BP2_2) => void;

  // Step 3: 감면
  addRelief: (relief: Omit<Relief, 'id'>) => void;
  updateRelief: (id: string, updates: Partial<Relief>) => void;
  removeRelief: (id: string) => void;

  // Step 4: 가산세
  setPenaltyInfo: (info: PenaltyInfo) => void;

  // Step 5: 조정
  setAdjustments: (adjustments: TaxCase['adjustments']) => void;
  setFlags: (flags: TaxCase['flags']) => void;

  // 계산
  setCalculationResult: (result: CalculationResult) => void;

  // 에러 처리
  clearError: () => void;
}

function createEmptyCase(): TaxCase {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    reportType: 'PRELIM',
    taxYear: new Date().getFullYear(),
    taxpayer: {
      name: '',
      rrn: '',
      email: '',
      phone: '',
      address: '',
    },
    bp1Assets: [],
    bp2Assets: [],
    reliefs: [],
    adjustments: {
      prevReportedGainIncome: 0,
      foreignTaxCredit: 0,
      withholdingCredit: 0,
      pensionCredit: 0,
      prevTaxPaid: 0,
    },
    flags: {
      eFiling: true,
      proxyFiling: false,
    },
  };
}

export const useTaxCaseStore = create<TaxCaseState>((set, get) => ({
  currentCase: null,
  calculationResult: null,
  savedCases: [],
  currentStep: 0,
  isDirty: false,
  isLoading: false,
  error: null,

  // 케이스 관리
  createNewCase: async () => {
    const newCase = createEmptyCase();
    set({
      currentCase: newCase,
      calculationResult: null,
      currentStep: 0,
      isDirty: true,
      error: null,
    });
  },

  loadCaseById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const taxCase = await loadCase(id);
      if (taxCase) {
        const calcResult = await loadCalculation(id);
        set({
          currentCase: taxCase,
          calculationResult: calcResult,
          currentStep: 0,
          isDirty: false,
          isLoading: false,
        });
      } else {
        set({ error: '케이스를 찾을 수 없습니다.', isLoading: false });
      }
    } catch (err) {
      set({ error: '케이스 로딩 실패', isLoading: false });
    }
  },

  saveCurrent: async () => {
    const { currentCase, calculationResult } = get();
    if (!currentCase) return;

    set({ isLoading: true, error: null });
    try {
      const updated = {
        ...currentCase,
        updatedAt: new Date().toISOString(),
      };
      await saveCase(updated);
      if (calculationResult) {
        await saveCalculation(calculationResult);
      }
      set({
        currentCase: updated,
        isDirty: false,
        isLoading: false,
      });
      await get().refreshCaseList();
    } catch (err) {
      set({ error: '저장 실패', isLoading: false });
    }
  },

  deleteCaseById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteCase(id);
      const { currentCase } = get();
      if (currentCase?.id === id) {
        set({ currentCase: null, calculationResult: null });
      }
      await get().refreshCaseList();
      set({ isLoading: false });
    } catch (err) {
      set({ error: '삭제 실패', isLoading: false });
    }
  },

  refreshCaseList: async () => {
    try {
      const cases = await listCases();
      set({ savedCases: cases });
    } catch (err) {
      console.error('케이스 목록 로딩 실패:', err);
    }
  },

  // 스텝 네비게이션
  setStep: (step: number) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 6) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

  // Step 0: 신고구분
  setReportType: (type: ReportType) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, reportType: type } : null,
      isDirty: true,
    })),

  setTaxYear: (year: number) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, taxYear: year } : null,
      isDirty: true,
    })),

  // Step 1: 신고인
  setTaxpayer: (taxpayer: Taxpayer) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, taxpayer } : null,
      isDirty: true,
    })),

  // Step 2: 자산 - BP1
  addBP1Asset: (asset) =>
    set((s) => {
      if (!s.currentCase) return s;
      const newAsset: BP1Asset = { ...asset, id: uuidv4() } as BP1Asset;
      return {
        currentCase: {
          ...s.currentCase,
          bp1Assets: [...s.currentCase.bp1Assets, newAsset],
        },
        isDirty: true,
      };
    }),

  updateBP1Asset: (id, updates) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          bp1Assets: s.currentCase.bp1Assets.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        },
        isDirty: true,
      };
    }),

  removeBP1Asset: (id) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          bp1Assets: s.currentCase.bp1Assets.filter((a) => a.id !== id),
          reliefs: s.currentCase.reliefs.filter((r) => r.assetId !== id),
        },
        isDirty: true,
      };
    }),

  // Step 2: 자산 - BP2
  addBP2Asset: (asset) =>
    set((s) => {
      if (!s.currentCase) return s;
      const newAsset: BP2Asset = { ...asset, id: uuidv4() } as BP2Asset;
      return {
        currentCase: {
          ...s.currentCase,
          bp2Assets: [...s.currentCase.bp2Assets, newAsset],
        },
        isDirty: true,
      };
    }),

  updateBP2Asset: (id, updates) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          bp2Assets: s.currentCase.bp2Assets.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        },
        isDirty: true,
      };
    }),

  removeBP2Asset: (id) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          bp2Assets: s.currentCase.bp2Assets.filter((a) => a.id !== id),
          reliefs: s.currentCase.reliefs.filter((r) => r.assetId !== id),
        },
        isDirty: true,
      };
    }),

  setBP2_2: (bp2_2) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, bp2_2 } : null,
      isDirty: true,
    })),

  // Step 3: 감면
  addRelief: (relief) =>
    set((s) => {
      if (!s.currentCase) return s;
      const newRelief: Relief = { ...relief, id: uuidv4() } as Relief;
      return {
        currentCase: {
          ...s.currentCase,
          reliefs: [...s.currentCase.reliefs, newRelief],
        },
        isDirty: true,
      };
    }),

  updateRelief: (id, updates) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          reliefs: s.currentCase.reliefs.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        },
        isDirty: true,
      };
    }),

  removeRelief: (id) =>
    set((s) => {
      if (!s.currentCase) return s;
      return {
        currentCase: {
          ...s.currentCase,
          reliefs: s.currentCase.reliefs.filter((r) => r.id !== id),
        },
        isDirty: true,
      };
    }),

  // Step 4: 가산세
  setPenaltyInfo: (info) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, penaltyInfo: info } : null,
      isDirty: true,
    })),

  // Step 5: 조정
  setAdjustments: (adjustments) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, adjustments } : null,
      isDirty: true,
    })),

  setFlags: (flags) =>
    set((s) => ({
      currentCase: s.currentCase ? { ...s.currentCase, flags } : null,
      isDirty: true,
    })),

  // 계산
  setCalculationResult: (result) =>
    set({ calculationResult: result }),

  // 에러 처리
  clearError: () => set({ error: null }),
}));
