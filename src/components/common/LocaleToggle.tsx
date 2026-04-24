/**
 * LocaleToggle — 中英文切换（与 BI 系统分段式按钮一致）
 */

import { useTranslation } from 'react-i18next'

export function LocaleToggle() {
  const { i18n } = useTranslation()
  const locale = i18n.language

  const switchLocale = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('locale', lang)
    document.documentElement.setAttribute('lang', lang)
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700/50 dark:border-slate-700/50 light:border-slate-200 overflow-hidden">
      <button
        onClick={() => switchLocale('zh')}
        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
          locale === 'zh'
            ? 'bg-primary text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        中文
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-slate-700/50 ${
          locale === 'en'
            ? 'bg-primary text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        EN
      </button>
    </div>
  )
}
