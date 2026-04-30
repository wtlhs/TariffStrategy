import { create } from 'zustand'
import { fetchTariffDict } from '@/services/tariff-dict'
import { MOCK_DATA_HEALTH } from '@/lib/tariff-change-log'
import type { TariffDictEntry, TariffDictMeta, DataSourceHealth } from '@/types'

interface TariffDictState {
  dicts: Record<string, TariffDictEntry[]>
  metas: Record<string, TariffDictMeta>
  loading: boolean
  /** 数据源健康状态 */
  dataHealth: DataSourceHealth[]
  /** 最后一次健康检查时间 */
  lastHealthCheckAt: string | null

  loadDict: (countryCode: string) => Promise<void>
  getDict: (countryCode: string) => TariffDictEntry[]
  getMeta: (countryCode: string) => TariffDictMeta | null
  refreshHealth: () => void
  getDataHealthSummary: () => { total: number; fresh: number; stale: number; expired: number }
}

export const useTariffDictStore = create<TariffDictState>((set, get) => ({
  dicts: {},
  metas: {},
  loading: false,
  dataHealth: MOCK_DATA_HEALTH,
  lastHealthCheckAt: null,

  loadDict: async (countryCode: string) => {
    if (get().dicts[countryCode]?.length) return
    set({ loading: true })
    try {
      const { entries, meta } = await fetchTariffDict(countryCode)
      set((state) => ({
        dicts: { ...state.dicts, [countryCode]: entries },
        metas: { ...state.metas, [countryCode]: meta },
      }))
    } finally {
      set({ loading: false })
    }
  },

  getDict: (countryCode: string) => get().dicts[countryCode] ?? [],

  getMeta: (countryCode: string) => get().metas[countryCode] ?? null,

  refreshHealth: () => {
    // TODO: 后端 API 就绪后，替换为真实数据
    set({ dataHealth: MOCK_DATA_HEALTH, lastHealthCheckAt: new Date().toISOString() })
  },

  getDataHealthSummary: () => {
    const health = get().dataHealth
    return {
      total: health.length,
      fresh: health.filter(h => h.freshness === 'fresh').length,
      stale: health.filter(h => h.freshness === 'stale').length,
      expired: health.filter(h => h.freshness === 'expired').length,
    }
  },
}))
