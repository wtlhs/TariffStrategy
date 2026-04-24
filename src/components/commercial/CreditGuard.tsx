/**
 * CreditGuard — 非阻断积分不足提示条
 *
 * 显示在内容区顶部，不遮挡上次结果
 * 提供"签到"或"升级"两个行动路径
 */

import { useTranslation } from 'react-i18next'
import { AlertTriangle, Coins, Crown } from 'lucide-react'
import { useCredits } from '@/hooks/useCredits'
import { canAfford } from '@/lib/credit-engine'
import { useUserStore } from '@/store/user-store'
import type { CreditAction } from '@/types'

interface CreditGuardProps {
  action: CreditAction
  onCheckIn?: () => void
  onUpgrade?: () => void
  weeklyUsage?: number
}

export function CreditGuard({
  action,
  onCheckIn,
  onUpgrade,
  weeklyUsage = 0,
}: CreditGuardProps) {
  const { t } = useTranslation()
  const { balance, plan, getWeeklyUsage } = useCredits()
  const user = useUserStore((s) => s.user)

  const canDo = user ? canAfford(user.credits, action, user.plan) : false
  const weeklyCount = getWeeklyUsage(action)
  const config = { freeWeeklyLimit: action === 'local_compare' ? 15 : action === 'ai_analysis' ? 2 : 5 }
  const isWeeklyLimited = plan === 'free' && config.freeWeeklyLimit !== undefined && weeklyCount >= config.freeWeeklyLimit

  if (canDo && !isWeeklyLimited) return null

  const isInsufficient = !canDo

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-200">
          {isInsufficient
            ? t('error.insufficientCredits')
            : t('error.weeklyLimitReached')}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {t('credits.balance')}: {balance}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isInsufficient && onCheckIn && (
          <button
            onClick={onCheckIn}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            <Coins className="h-3.5 w-3.5" />
            {t('credits.checkIn.btn')}
          </button>
        )}

        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-light hover:bg-primary/30 transition-colors"
          >
            <Crown className="h-3.5 w-3.5" />
            {t('plan.upgrade')}
          </button>
        )}
      </div>
    </div>
  )
}
