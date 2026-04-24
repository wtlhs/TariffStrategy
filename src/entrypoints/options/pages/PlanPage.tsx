/**
 * PlanPage — 套餐积分（套餐对比 + 签到 + 积分流水）
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Coins, Crown, Zap, Sparkles, Building2, ArrowUpRight, ArrowDownRight, Check } from 'lucide-react'
import { useCredits } from '@/hooks/useCredits'
import { usePlan } from '@/hooks/usePlan'
import { PlanBadge } from '@/components/commercial/PlanBadge'
import { CheckInCalendar } from '@/components/commercial/CheckInCalendar'
import { UpgradeModal } from '@/components/commercial/UpgradeModal'
import { PLAN_DEFINITIONS } from '@/services/plans'
import type { PlanTier } from '@/types'

const TIER_ICONS: Record<PlanTier, typeof Sparkles> = { free: Sparkles, starter: Zap, pro: Crown, enterprise: Building2 }

export function PlanPage() {
  const { t } = useTranslation()
  const { balance, transactions } = useCredits()
  const { tier, paid, trial, trialDays } = usePlan()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [highlightTier] = useState<PlanTier>('pro')

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
            <CreditCard size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('plan.current')}</h2>
            <p className="text-xs text-slate-400">管理套餐、签到、积分</p>
          </div>
        </div>
        <PlanBadge />
      </div>

      {/* Stats cards — 同策略分析页 KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('credits.balance')}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-amber-700 dark:text-amber-300">{balance}</span>
            <span className="text-sm text-slate-500">积分</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('plan.current')}</p>
          <div className="mt-2 flex items-center gap-2">
            {(() => { const Icon = TIER_ICONS[tier]; return <Icon size={18} className="text-primary-light" /> })()}
            <span className="text-lg font-semibold text-slate-900 dark:text-white">{PLAN_DEFINITIONS.find((p) => p.tier === tier)?.name}</span>
          </div>
          {trial && trialDays > 0 && <p className="mt-1 text-xs text-primary-light">{t('plan.trialDays', { days: trialDays })}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-4 col-span-2 lg:col-span-1">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('credits.buy')}</p>
          <div className="mt-2 space-y-1.5">
            {[{ amount: 500, price: 39 }, { amount: 1500, price: 99 }, { amount: 5000, price: 289 }].map((pkg) => (
              <div key={pkg.amount} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">{pkg.amount} 积分</span>
                <button className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors">¥{pkg.price}</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 签到 + 套餐对比 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CheckInCalendar />
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">{t('plan.compareTitle')}</h3>
            <button onClick={() => setShowUpgrade(true)} className="flex items-center gap-1 text-xs text-primary-light hover:underline">
              {t('plan.upgrade')} <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {PLAN_DEFINITIONS.map((plan) => {
              const Icon = TIER_ICONS[plan.tier]
              const isCurrent = plan.tier === tier
              return (
                <div key={plan.tier} className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={isCurrent ? 'text-primary-light' : 'text-slate-500'} />
                    <span className={`text-sm ${isCurrent ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}`}>{plan.name}</span>
                    {isCurrent && <Check size={12} className="text-primary-light" />}
                  </div>
                  <span className="text-sm text-slate-400">{plan.price === 0 ? '免费' : `¥${plan.price}/月`}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4">{t('credits.transaction.history')}</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">暂无积分记录</p>
        ) : (
          <div className="space-y-1">
            {transactions.slice(0, 20).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  {tx.type === 'earn' ? <ArrowDownRight size={14} className="text-emerald-400" /> : <ArrowUpRight size={14} className="text-red-400" />}
                  <span className="text-sm text-slate-600 dark:text-slate-300">{tx.reason}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${tx.type === 'earn' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>{tx.type === 'earn' ? '+' : '-'}{tx.amount}</span>
                  <span className="text-xs text-slate-600">{tx.createdAt.split('T')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} highlightTier={highlightTier} />
    </div>
  )
}
