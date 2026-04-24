import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calculator, TrendingUp, Package, Sparkles, RefreshCw,
  Check, Lightbulb, Bell, Settings, Database, User,
  CreditCard, BookOpen, Mail, MessageSquare,
  X, Info, HelpCircle, ChevronDown,
} from 'lucide-react'
import { useStrategyStore } from '@/store/strategy-store'
import { useUserStore } from '@/store/user-store'
import { useSettingsStore, initTheme } from '@/store/settings-store'
import { compareAllRoutes, generateAiSuggestion } from '@/lib/strategy-engine'
import { DEMO_HS_CODES, DEMO_ORIGINS } from '@/lib/mock-data'
import { DESTINATION_COUNTRIES } from '@/constants/countries'
import { PlanBadge } from '@/components/commercial/PlanBadge'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LocaleToggle } from '@/components/common/LocaleToggle'
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

// ============================================================
// 策略分析页 — 对齐 BI 系统样式
// ============================================================

function StrategyPage() {
  const { searchParams, setSearchParams, results, setResults, aiSuggestion, setAiSuggestion, setComparing } = useStrategyStore()
  const [loading, setLoading] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showHSInfo, setShowHSInfo] = useState(false)
  const [showModelInfo, setShowModelInfo] = useState(false)
  const [showQuickSubscribe, setShowQuickSubscribe] = useState(false)
  const [subscribeChannels, setSubscribeChannels] = useState<string[]>(['email'])
  const [subscribeEmail, setSubscribeEmail] = useState('')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [animatedStats, setAnimatedStats] = useState({ bestCost: 0, savings: 0, taxRate: 0 })
  const [copied, setCopied] = useState(false)

  const handleCompare = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const routes = compareAllRoutes(searchParams.hsCode, searchParams.goodsValue, searchParams.destination)
    setResults(routes)
    setAiSuggestion(generateAiSuggestion(routes))
    setLoading(false)
  }

  // 数字动画
  useEffect(() => {
    if (results.length === 0) return
    const best = results[0]
    const second = results[1]
    const duration = 800
    const steps = 25
    let step = 0
    const timer = setInterval(() => {
      step++
      const p = step / steps
      setAnimatedStats({
        bestCost: Math.round(best.totalCost * p),
        savings: Math.round((second?.savingsVsBest ?? 0) * p),
        taxRate: Math.round(best.effectiveRate * 100 * p * 10) / 10,
      })
      if (step >= steps) {
        clearInterval(timer)
        setAnimatedStats({
          bestCost: best.totalCost,
          savings: second?.savingsVsBest ?? 0,
          taxRate: Math.round(best.effectiveRate * 1000) / 10,
        })
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [results])

  const handleCopy = () => {
    if (results.length === 0) return
    const text = results
      .map((r, i) => `${i + 1}. ${r.originName}→${r.destinationName}  $${r.totalCost.toLocaleString()}  ${(r.effectiveRate * 100).toFixed(1)}%${r.isBest ? ' ★最优' : ` +$${r.savingsVsBest?.toLocaleString()}`}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleQuickSubscribe = async () => {
    setSubscribeLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubscribeLoading(false)
    setShowQuickSubscribe(false)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* ===== 头部：搜索表单 ===== */}
      <section className="rounded-2xl border border-blue-200 dark:border-blue-300/20 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-4 md:p-6 shadow-sm overflow-visible">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
              <Calculator size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">策略对比</h2>
              <p className="text-xs text-slate-400">输入参数对比所有可选路线总成本</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHSInfo(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <HelpCircle size={13} /> HS编码说明
            </button>
            <button
              onClick={() => setShowModelInfo(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Info size={13} /> 模型说明
            </button>
          </div>
        </div>

        {/* 检索条件 */}
        <div className="flex flex-wrap items-end gap-3 md:gap-3">
          {/* HS编码 */}
          <div className="flex-1 min-w-[180px] max-w-[260px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">HS编码</label>
            <div className="relative">
              <Package size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchParams.hsCode}
                onChange={(e) => setSearchParams({ hsCode: e.target.value })}
                onFocus={() => setShowProductPicker(true)}
                className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-14 text-sm text-slate-900 dark:text-white outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {searchParams.hsCode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSearchParams({ hsCode: '8482.10', goodsValue: 50000 }) }}
                    className="p-0.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                )}
                <button onClick={() => setShowProductPicker(!showProductPicker)} className="p-0.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* 产品选择下拉 */}
              {showProductPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProductPicker(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                    <div className="px-2.5 py-1.5 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">预设产品</div>
                    {DEMO_HS_CODES.map((h) => (
                      <button
                        key={h.hsCode}
                        onClick={() => { setSearchParams({ hsCode: h.hsCode, goodsValue: h.defaultValue }); setShowProductPicker(false) }}
                        className="w-full px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">{h.hsCode}</div>
                        <div className="text-xs text-slate-400">{h.name} · ${h.defaultValue.toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 发出地 */}
          <div className="w-[150px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">发出地</label>
            <select
              value={searchParams.origin}
              onChange={(e) => setSearchParams({ origin: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            >
              {DEMO_ORIGINS.map((o) => (
                <option key={o.code} value={o.code}>{o.code} {o.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2 text-slate-500">→</div>

          {/* 目的地 */}
          <div className="w-[150px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">目的地</label>
            <select
              value={searchParams.destination}
              onChange={(e) => setSearchParams({ destination: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            >
              {DESTINATION_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          {/* 货值 */}
          <div className="w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">货值</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
              <input
                type="number"
                value={searchParams.goodsValue}
                onChange={(e) => setSearchParams({ goodsValue: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-6 pr-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
            </div>
          </div>

          {/* 对比按钮 */}
          <div className="flex items-end">
            <button
              onClick={handleCompare}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> 计算中...</>
              ) : (
                <><Sparkles size={14} /> 开始对比</>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ===== 结果区 ===== */}
      {results.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI 指标卡片 */}
          <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">最优路线</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{results[0].originName}→{results[0].destinationName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">到岸总成本</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-200">${animatedStats.bestCost.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">相比次优节省</p>
              <p className="mt-2 text-lg font-semibold text-blue-700 dark:text-blue-300">${animatedStats.savings.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">综合税率</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{animatedStats.taxRate}%</p>
            </div>
          </section>

          {/* 快速订阅横幅 */}
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                  <Bell size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">订阅税率变化</p>
                  <p className="text-xs text-slate-400">当 {searchParams.origin}→{searchParams.destination} 税率变化时通知您</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickSubscribe(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
              >
                <Bell size={14} /> 快速订阅
              </button>
            </div>
          </section>

          {/* 最优方案详情 + AI 建议 */}
          {results[0] && (
            <section className="rounded-2xl border border-blue-200 dark:border-blue-300/20 bg-gradient-to-br from-white/95 to-slate-50/80 dark:from-slate-900/95 dark:to-slate-800/80 backdrop-blur p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <Check size={18} className="text-emerald-600 dark:text-emerald-300" />
                最优方案详情
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">路线</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">{results[0].originName}→{results[0].destinationName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">关税</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">${results[0].customsDuty.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">运费</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">${results[0].shippingCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">到岸总成本</p>
                    <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-200">${results[0].totalCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 p-4 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={18} className="text-amber-400" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">AI 建议</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{aiSuggestion}</p>
                </div>
              </div>
            </section>
          )}

          {/* 全部路线对比表格 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <TrendingUp size={18} className="text-blue-400" />
                全部路线对比
              </h3>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {copied ? '✓ 已复制' : '复制结果'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">路线</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MFN</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">S301</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">FTA</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">运费</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">到岸总成本</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">税率</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">天数</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">对比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {results.map((r) => (
                    <tr
                      key={r.routing}
                      className={`transition-colors ${r.isBest ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {r.isBest && <Check size={14} className="text-emerald-400" />}
                          <span className={`font-medium ${r.isBest ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                            {r.originName}→{r.destinationName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">{(r.mfnRate * 100).toFixed(1)}%</td>
                      <td className="py-3 px-3 text-right">
                        {r.section301Rate > 0
                          ? <span className="text-red-600 dark:text-red-400">{(r.section301Rate * 100).toFixed(0)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.ftaApplied
                          ? <span className="text-blue-700 dark:text-blue-300">{r.ftaName}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">${r.shippingCost.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white">${r.totalCost.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={r.effectiveRate === 0 ? 'text-emerald-700 dark:text-emerald-300' : r.effectiveRate > 0.2 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}>
                          {(r.effectiveRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">{r.shippingDays}天</td>
                      <td className="py-3 px-3 text-right">
                        {r.isBest
                          ? <span className="inline-flex rounded-lg border px-2.5 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30">最优</span>
                          : <span className="inline-flex rounded-lg border px-2.5 py-1 text-sm font-medium text-red-700 dark:text-red-200 bg-red-500/10 border-red-500/30">+${r.savingsVsBest?.toLocaleString()}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 空状态 */}
      {results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Calculator size={48} className="mb-4 opacity-30" />
          <p className="text-base mb-1">选择产品参数后点击「开始对比」</p>
          <p className="text-sm">对比所有可选发货路线的总成本，AI 推荐最优方案</p>
        </div>
      )}

      {/* ===== 弹窗：HS编码说明 ===== */}
      {showHSInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">HS编码说明</h3>
              <button onClick={() => setShowHSInfo(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
{`HS编码（协调制度编码）是国际贸易商品的统一分类代码：

• 前2位：章号（如84=机械）
• 前4位：品目（如8412=其他发动机）
• 前6位：子目（国际统一）
• 后续位：各国细分

示例：
8482.10 = 滚珠轴承
8501.10 = 电动机
6110.20 = 棉制针织衫

输入建议：4-6位可查询到基础税率`}
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹窗：比较模型说明 ===== */}
      {showModelInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">比较模型说明</h3>
              <button onClick={() => setShowModelInfo(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
{`## Landed Cost 到岸总成本公式

到岸总成本 = 货值 + 关税 + Section301 + AD/CVD + MPF + HMF + 运费 + 保险

### 税费构成
1. MFN关税 — 基础进口关税，基于HS编码
2. Section 301 — 对华惩罚性关税
3. FTA优惠 — 自贸协定减免（KORUS、USMCA等）
4. MPF — 商品处理费 0.3464%
5. HMF — 港口维护费 0.125%（海运）
6. 保险 — CIF 价值的 0.5%

### De Minimis 豁免
货值 ≤ $800 且无 Section301/AD/CVD 时，关税全免。

### 数据来源
• 美国USITC HTS税率表
• USTR Section 301数据
• Drewry WCI运费指数`}
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹窗：快速订阅 ===== */}
      {showQuickSubscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">快速订阅</h3>
              <button onClick={() => setShowQuickSubscribe(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-700 p-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">路线: <span className="font-medium text-slate-900 dark:text-white">{searchParams.origin} → {searchParams.destination}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300">HS编码: <span className="font-medium text-slate-900 dark:text-white">{searchParams.hsCode}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">通知渠道</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSubscribeChannels(subscribeChannels.includes('email') ? subscribeChannels.filter((c) => c !== 'email') : [...subscribeChannels, 'email'])}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                      subscribeChannels.includes('email')
                        ? 'border-blue-400 bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Mail size={14} /> 邮件
                  </button>
                  <button
                    onClick={() => setSubscribeChannels(subscribeChannels.includes('dingtalk') ? subscribeChannels.filter((c) => c !== 'dingtalk') : [...subscribeChannels, 'dingtalk'])}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                      subscribeChannels.includes('dingtalk')
                        ? 'border-blue-400 bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <MessageSquare size={14} /> 钉钉
                  </button>
                </div>
              </div>
              {subscribeChannels.includes('email') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowQuickSubscribe(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600">
                取消
              </button>
              <button onClick={handleQuickSubscribe} disabled={subscribeLoading || subscribeChannels.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {subscribeLoading ? '创建中...' : '创建订阅'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
