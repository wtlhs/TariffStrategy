import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import chromeStorage from './persist-adapter'
import type { RouteData, SearchParams } from '@/types'

interface StrategyState {
  searchParams: SearchParams
  results: RouteData[]
  isComparing: boolean
  aiSuggestion: string

  setSearchParams: (params: Partial<SearchParams>) => void
  setResults: (results: RouteData[]) => void
  setComparing: (v: boolean) => void
  setAiSuggestion: (s: string) => void
  resetResults: () => void
}

const DEFAULT_SEARCH_PARAMS: SearchParams = {
  hsCode: '8482.10',
  origin: 'RO',
  destination: 'US',
  goodsValue: 50000,
}

export const useStrategyStore = create<StrategyState>()(
  persist(
    (set) => ({
      searchParams: DEFAULT_SEARCH_PARAMS,
      results: [],
      isComparing: false,
      aiSuggestion: '',

      setSearchParams: (params) =>
        set((state) => ({
          searchParams: { ...state.searchParams, ...params },
        })),

      setResults: (results) => set({ results, isComparing: false }),

      setComparing: (v) => set({ isComparing: v }),

      setAiSuggestion: (s) => set({ aiSuggestion: s }),

      resetResults: () => set({ results: [], aiSuggestion: '' }),
    }),
    {
      name: 'tariff-strategy',
      storage: chromeStorage,
      partialize: (state): Partial<StrategyState> => ({
        searchParams: state.searchParams,
      }),
    },
  ),
)
