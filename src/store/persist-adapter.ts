import type { PersistStorage, StorageValue } from 'zustand/middleware'

const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage?.local

const chromeStorage: PersistStorage<unknown> = {
  getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
    if (!hasChromeStorage) {
      const raw = localStorage.getItem(name)
      if (raw == null) return null
      try { return JSON.parse(raw) } catch { return null }
    }
    const result = await chrome.storage.local.get(name)
    const raw = result[name]
    if (raw == null) return null
    if (typeof raw === 'object' && 'state' in raw) return raw as StorageValue<unknown>
    return { state: raw }
  },

  setItem: async (name: string, value: StorageValue<unknown>): Promise<void> => {
    if (!hasChromeStorage) {
      localStorage.setItem(name, JSON.stringify(value))
      return
    }
    await chrome.storage.local.set({ [name]: value })
  },

  removeItem: async (name: string): Promise<void> => {
    if (!hasChromeStorage) {
      localStorage.removeItem(name)
      return
    }
    await chrome.storage.local.remove(name)
  },
}

export default chromeStorage
