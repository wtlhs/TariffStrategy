import { apiClient } from './api-client'
import { MOCK_TARIFF_DICT_US } from '@/lib/mock-data'
import type { TariffDictEntry, TariffDictMeta, TariffDictCache } from '@/types'

const CACHE_KEY_PREFIX = 'tariff-dict-'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

function isExpired(meta: TariffDictMeta): boolean {
  return Date.now() - new Date(meta.fetchedAt).getTime() > CACHE_TTL_MS
}

async function loadFromCache(countryCode: string): Promise<TariffDictCache | null> {
  try {
    const key = `${CACHE_KEY_PREFIX}${countryCode}`
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key)
      return result[key] ?? null
    }
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function saveToCache(
  countryCode: string,
  entries: TariffDictEntry[],
  meta: TariffDictMeta,
): Promise<void> {
  const data: TariffDictCache = { entries, meta }
  const key = `${CACHE_KEY_PREFIX}${countryCode}`
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: data })
    } else {
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch {
    // 存储满或不可用时静默失败
  }
}

export async function fetchTariffDict(countryCode: string): Promise<{ entries: TariffDictEntry[]; meta: TariffDictMeta }> {
  // 1. 检查本地缓存
  const cached = await loadFromCache(countryCode)
  if (cached && !isExpired(cached.meta)) {
    return { entries: cached.entries, meta: cached.meta }
  }

  // 2. 尝试 API
  if (navigator.onLine) {
    try {
      const res = await apiClient.get<TariffDictCache>(`/tariff-dict/${countryCode}`)
      if (res.success && res.data) {
        const meta: TariffDictMeta = {
          ...res.data.meta,
          countryCode,
          source: 'api',
        }
        await saveToCache(countryCode, res.data.entries, meta)
        return { entries: res.data.entries, meta }
      }
    } catch {
      // fall through to mock
    }
  }

  // 3. 回退到内置 mock
  if (countryCode === 'US') {
    const mockMeta: TariffDictMeta = {
      countryCode: 'US',
      fetchedAt: new Date().toISOString(),
      version: '2026.mock',
      entryCount: MOCK_TARIFF_DICT_US.length,
      source: 'mock',
    }
    return { entries: MOCK_TARIFF_DICT_US, meta: mockMeta }
  }

  return {
    entries: [],
    meta: {
      countryCode,
      fetchedAt: new Date().toISOString(),
      version: '0',
      entryCount: 0,
      source: 'mock',
    },
  }
}
