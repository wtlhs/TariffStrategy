/**
 * WelcomePage — 3步引导 + 内嵌 Demo 体验
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator, Pin, Gift, Rocket, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react'
import { useStrategyStore } from '@/store/strategy-store'
import { compareAllRoutes, generateAiSuggestion } from '@/lib/strategy-engine'

const STEPS = [
  { key: 'pin', icon: Pin, title: '固定扩展', desc: '点击浏览器工具栏的拼图图标，将税率工具固定到工具栏', tip: '固定后可一键打开，方便随时查询' },
  { key: 'register', icon: Gift, title: '注册领积分', desc: '注册账号即可获得 100 积分，用于体验高级功能', tip: '积分可用于 AI 分析、深度报告等' },
  { key: 'demo', icon: Rocket, title: '体验 Demo', desc: '直接体验策略对比功能，查看不同发货路线的成本差异', tip: '滚珠轴承 → 美国，$50,000 货值' },
]

export function WelcomePage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 py-6">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
            <Calculator size={28} className="text-blue-400" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t('welcome.title')}</h1>
        <p className="text-xs text-slate-400">3 步快速上手国际贸易发货策略对比工具</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button onClick={() => setStep(i)} className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${i === step ? 'bg-primary text-white shadow-glow' : i < step ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
              {i < step ? <Check size={16} /> : <span className="text-sm font-medium">{i + 1}</span>}
            </button>
            {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 w-8 ${i < step ? 'bg-emerald-500/30' : 'bg-slate-300 dark:bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 md:p-8">
        {step < 2 ? <GuideStep step={STEPS[step]} /> : <DemoStep />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} /> {t('common.previous')}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors">
            {t('common.next')} <ChevronRight size={14} />
          </button>
        ) : (
          <DemoButton />
        )}
      </div>
    </div>
  )
}

function GuideStep({ step }: { step: typeof STEPS[number] }) {
  const Icon = step.icon
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15"><Icon size={24} className="text-primary-light" /></div></div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">{step.desc}</p>
      <p className="text-xs text-slate-500">{step.tip}</p>
    </div>
  )
}

function DemoStep() {
  const { setResults, setAiSuggestion } = useStrategyStore()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleDemo = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    const routes = compareAllRoutes('8482.10', 50000, 'US')
    setResults(routes)
    setAiSuggestion(generateAiSuggestion(routes))
    setLoading(false)
    setDone(true)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center"><Rocket className="text-primary-light" size={24} /></div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">策略对比 Demo</h3>
      <p className="text-sm text-slate-400">滚珠轴承 (HS 8482.10) → 美国，货值 $50,000</p>
      {!done ? (
        <button onClick={handleDemo} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-6 py-3 text-sm font-medium text-white hover:shadow-glow transition-all disabled:opacity-50">
          <Sparkles size={16} /> {loading ? '计算中...' : '开始体验'}
        </button>
      ) : (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <Check size={20} className="mx-auto text-emerald-400 mb-2" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Demo 完成！</p>
          <p className="text-xs text-slate-400 mt-1">前往「策略分析」页查看完整对比结果</p>
        </div>
      )}
    </div>
  )
}

function DemoButton() {
  return (
    <button onClick={() => {/* handled by DemoStep internal state */}} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors">
      <Sparkles size={14} /> {window.location.href}
    </button>
  )
}
