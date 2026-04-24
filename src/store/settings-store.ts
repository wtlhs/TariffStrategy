/**
 * 设置 Store — 主题 (dark/light) + 语言 (zh/en)
 *
 * 主题：在 <html> 上切换 .dark / .light class（与 BI 系统一致）
 * 语言：同步 i18next + localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

interface SettingsState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      setTheme: (theme) => {
        applyThemeClass(theme)
        set({ theme })
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        applyThemeClass(next)
        set({ theme: next })
      },
    }),
    {
      name: 'tariff-settings',
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name)
          if (raw == null) return null
          try { return JSON.parse(raw) } catch { return null }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
      partialize: (state) => ({ theme: state.theme } as SettingsState),
    },
  ),
)

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
}

/** 初始化：在 App mount 前调用，确保无闪烁 */
export function initTheme() {
  try {
    const raw = localStorage.getItem('tariff-settings')
    const parsed = raw ? JSON.parse(raw) : null
    const theme = parsed?.state?.theme ?? 'dark'
    applyThemeClass(theme)
  } catch {
    applyThemeClass('dark')
  }
}
