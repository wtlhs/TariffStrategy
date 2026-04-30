import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calculator, Settings, Database, User,
  CreditCard, BookOpen, Bell,
} from 'lucide-react'
import { useUserStore } from '@/store/user-store'
import { useSettingsStore, initTheme } from '@/store/settings-store'
import { PlanBadge } from '@/components/commercial/PlanBadge'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LocaleToggle } from '@/components/common/LocaleToggle'
import { StrategyPage } from './pages/StrategyPage'
import { ConfigPage } from './pages/ConfigPage'
import { DataCenterPage } from './pages/DataCenterPage'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { PlanPage } from './pages/PlanPage'
import { AccountPage } from './pages/AccountPage'
import { WelcomePage } from './pages/WelcomePage'

type PageId = 'strategy' | 'config' | 'datacenter' | 'subscription' | 'plan' | 'account' | 'welcome'

interface NavGroup {
  label: string
  items: { id: PageId; label: string; icon: typeof Calculator }[]
}

export default function App() {
  const { t } = useTranslation()
  const [activePage, setActivePage] = useState<PageId>('strategy')
  const user = useUserStore((s) => s.user)
  const credits = user?.credits ?? 0

  // 初始化主题
  useEffect(() => { initTheme() }, [])

  // 打开 options 页时清除 Badge
  useEffect(() => {
    try {
      chrome.runtime.sendMessage({ type: 'clear-badge' })
    } catch {
      // 非 Chrome 扩展环境（serve 预览模式）忽略
    }
  }, [])

  const navGroups: NavGroup[] = [
    {
      label: t('tabs.compare'),
      items: [{ id: 'strategy', label: '策略分析', icon: Calculator }],
    },
    {
      label: t('tabs.data'),
      items: [
        { id: 'config', label: '基础配置', icon: Settings },
        { id: 'datacenter', label: '数据中心', icon: Database },
      ],
    },
    {
      label: t('tabs.subscribe'),
      items: [{ id: 'subscription', label: '订阅管理', icon: Bell }],
    },
    {
      label: t('tabs.profile'),
      items: [
        { id: 'plan', label: '套餐积分', icon: CreditCard },
        { id: 'account', label: '账户设置', icon: User },
        { id: 'welcome', label: '使用引导', icon: BookOpen },
      ],
    },
  ]

  return (
    <div className="flex h-screen">
      {/* 侧边栏 — 响应式：<1024px 折叠为图标模式 */}
      <aside className="w-16 lg:w-52 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all duration-200">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 border-b border-slate-200 dark:border-slate-700/50 lg:justify-start lg:px-5 lg:gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
            <Calculator size={16} className="text-blue-400" />
          </div>
          <span className="hidden lg:inline text-sm font-semibold text-slate-900 dark:text-white">税率政策工具</span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="hidden lg:block px-5 mb-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.15em]">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    title={item.label}
                    className={`w-full flex items-center justify-center px-0 py-2 text-sm transition-colors lg:px-5 lg:justify-start lg:gap-2.5 ${
                      active
                        ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* 底部：积分 + 主题 + 语言 */}
        <div className="border-t border-slate-200 dark:border-slate-700/50 p-2 lg:p-3 space-y-2">
          <div className="flex items-center justify-center lg:justify-between text-xs">
            <span className="text-amber-400 font-medium text-[10px] lg:text-xs">🪙 {credits}</span>
            <span className="hidden lg:inline"><PlanBadge compact /></span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <ThemeToggle />
            <LocaleToggle />
          </div>
        </div>
      </aside>

      {/* 主内容区 — 深色/浅色背景 */}
      <main className="flex-1 overflow-y-auto transition-colors duration-300">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}

function PageContent({ page }: { page: PageId }) {
  switch (page) {
    case 'strategy':
      return <StrategyPage />
    case 'config':
      return <ConfigPage />
    case 'datacenter':
      return <DataCenterPage />
    case 'subscription':
      return <SubscriptionPage />
    case 'plan':
      return <PlanPage />
    case 'account':
      return <AccountPage />
    case 'welcome':
      return <WelcomePage />
    default:
      return <StrategyPage />
  }
}
