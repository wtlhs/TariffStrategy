/**
 * ThemeToggle — 明暗主题切换（与 BI 系统一致）
 *
 * Sun/Moon 图标按钮，切换 .dark/.light class
 */

import { Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/store/settings-store'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useSettingsStore()

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? t('common.theme.toLight', '切换到浅色模式') : t('common.theme.toDark', '切换到深色模式')}
      className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
