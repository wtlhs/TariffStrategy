/**
 * PlanBadge — 套餐角标 + 额度指示器
 *
 * 显示当前套餐等级、试用剩余天数、额度使用进度
 */

import { useTranslation } from 'react-i18next'
import { Crown, Zap, Sparkles, Building2 } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import type { PlanTier } from '@/types'

const TIER_CONFIG: Record<PlanTier, {
  icon: typeof Sparkles
  label: string
  color: string
  bg: string
}> = {
  free: {
    icon: Sparkles,
    label: 'plan.free',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-200/50 dark:bg-slate-700/30',
  },
  starter: {
    icon: Zap,
    label: 'plan.starter',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
  },
  pro: {
    icon: Crown,
    label: 'plan.pro',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
  },
  enterprise: {
    icon: Building2,
    label: 'plan.enterprise',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
}

interface PlanBadgeProps {
  showTrial?: boolean
  compact?: boolean
}

export function PlanBadge({ showTrial = true, compact = false }: PlanBadgeProps) {
  const { t } = useTranslation()
  const { tier, trial, trialDays } = usePlan()
  const config = TIER_CONFIG[tier]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${config.bg}`}
      >
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        <span className={`text-xs font-medium ${config.color}`}>
          {t(config.label)}
        </span>
      </div>

      {showTrial && trial && trialDays > 0 && (
        <span className="text-xs text-primary-light">
          {t('plan.trialDays', { days: trialDays })}
        </span>
      )}
    </div>
  )
}

interface QuotaIndicatorProps {
  type: 'products' | 'origins' | 'subscriptions'
  current: number
}

export function QuotaIndicator({ type, current }: QuotaIndicatorProps) {
  const { quota } = usePlan()
  const info = quota[type]

  if (info.limit === Infinity) {
    return (
      <span className="text-xs text-slate-400">
        {current} / ∞
      </span>
    )
  }

  const percent = Math.round((current / info.limit) * 100)
  const isNearLimit = percent >= 80

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-amber-400' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`text-xs ${isNearLimit ? 'text-amber-400' : 'text-slate-400'}`}>
        {current} / {info.limit}
      </span>
    </div>
  )
}
