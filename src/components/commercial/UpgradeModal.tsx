/**
 * UpgradeModal — 升级弹窗 + 7 天试用入口 + 套餐对比表
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, Sparkles, Zap, Crown, Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PLAN_DEFINITIONS } from '@/services/plans'
import { usePlan } from '@/hooks/usePlan'
import type { PlanTier } from '@/types'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  highlightTier?: PlanTier
}

const TIER_ICONS: Record<PlanTier, typeof Sparkles> = {
  free: Sparkles,
  starter: Zap,
  pro: Crown,
  enterprise: Building2,
}

const TIER_COLORS: Record<PlanTier, string> = {
  free: 'text-slate-600 dark:text-slate-400',
  starter: 'text-blue-600 dark:text-blue-400',
  pro: 'text-purple-600 dark:text-purple-400',
  enterprise: 'text-amber-600 dark:text-amber-400',
}

export function UpgradeModal({ open, onClose, highlightTier }: UpgradeModalProps) {
  const { t } = useTranslation()
  const { tier: currentTier, beginTrial, trial, trialDays } = usePlan()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [trialLoading, setTrialLoading] = useState(false)

  const handleTrial = async () => {
    setTrialLoading(true)
    try {
      await beginTrial()
      onClose()
    } catch {
      // 错误处理由调用方负责
    } finally {
      setTrialLoading(false)
    }
  }

  const yearlySavePercent = (tier: PlanTier) => {
    const plan = PLAN_DEFINITIONS.find((p) => p.tier === tier)
    if (!plan?.yearlyPrice) return 0
    const monthlyYearly = plan.yearlyPrice / 12
    return Math.round((1 - monthlyYearly / plan.price) * 100)
  }

  return (
    <Modal open={open} onClose={onClose} className="!max-w-[900px]">
      <div className="max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('plan.compareTitle')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              billing === 'monthly'
                ? 'bg-primary/20 text-primary-light'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t('plan.monthly')}
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              billing === 'yearly'
                ? 'bg-primary/20 text-primary-light'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t('plan.yearly')}
          </button>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
          {PLAN_DEFINITIONS.map((plan) => {
            const Icon = TIER_ICONS[plan.tier]
            const color = TIER_COLORS[plan.tier]
            const isCurrent = plan.tier === currentTier
            const isHighlighted = plan.tier === highlightTier
            const isFree = plan.tier === 'free'

            return (
              <div
                key={plan.tier}
                className={`relative rounded-xl border p-4 transition-all ${
                  isHighlighted
                    ? 'border-primary bg-primary/5 shadow-glow'
                    : isCurrent
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                {isCurrent && (
                  <Badge variant="success" className="absolute -top-2 left-3">
                    {t('plan.current')}
                  </Badge>
                )}

                <div className="flex flex-col items-center text-center">
                  <Icon className={`h-6 w-6 ${color} mb-2`} />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {plan.name}
                  </h3>

                  <div className="mt-2 mb-3">
                    {isFree ? (
                      <span className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {t('plan.free')}
                      </span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                          ¥{billing === 'monthly' ? plan.price : (plan.yearlyPrice ?? plan.price)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          /{billing === 'monthly' ? '月' : '年'}
                        </span>
                        {billing === 'yearly' && plan.yearlyPrice && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            省 {yearlySavePercent(plan.tier)}%
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!isFree && !isCurrent && (
                    <Button
                      size="sm"
                      variant={isHighlighted ? 'primary' : 'secondary'}
                      className="w-full mt-auto"
                    >
                      {trial && trialDays > 0
                        ? t('plan.upgrade')
                        : t('plan.upgrade')}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80">
                <th className="text-left px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">
                  {t('plan.features.localCompare').split(' ').slice(-1)[0]}
                </th>
                {PLAN_DEFINITIONS.map((p) => (
                  <th key={p.tier} className="text-center px-3 py-3 text-slate-500 dark:text-slate-400 font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              <FeatureRow
                label={t('plan.features.localCompare')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.localCompare === 'unlimited'
                    ? '无限'
                    : `${p.features.localCompareWeeklyLimit}次/周`,
                )}
              />
              <FeatureRow
                label={t('plan.features.aiAnalysis')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.aiAnalysis === 'unlimited'
                    ? '无限'
                    : `${p.features.aiAnalysisMonthlyLimit}次/月`,
                )}
              />
              <FeatureRow
                label={t('plan.features.deepReport')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.aiDeepReport === 'unavailable'
                    ? '—'
                    : p.features.aiDeepReport === 'unlimited'
                      ? '无限'
                      : `${p.features.aiDeepReportMonthlyLimit}次/月`,
                )}
              />
              <FeatureRow
                label={t('plan.features.products')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.maxProducts === Infinity ? '无限' : `${p.features.maxProducts}`,
                )}
              />
              <FeatureRow
                label={t('plan.features.subscriptions')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.maxSubscriptions === Infinity
                    ? '无限'
                    : `${p.features.maxSubscriptions}`,
                )}
              />
              <FeatureRow
                label={t('plan.features.history')}
                values={PLAN_DEFINITIONS.map((p) =>
                  p.features.historyDays === Infinity ? '无限' : `${p.features.historyDays}天`,
                )}
              />
              <FeatureRow
                label={t('plan.features.trendChart')}
                values={PLAN_DEFINITIONS.map((p) => p.features.trendChart)}
                boolean
              />
              <FeatureRow
                label={t('plan.features.batchCompare')}
                values={PLAN_DEFINITIONS.map((p) => p.features.batchCompare)}
                boolean
              />
              <FeatureRow
                label={t('plan.features.checkInBonus')}
                values={PLAN_DEFINITIONS.map((p) => `${p.features.checkInMultiplier}x`)}
              />
            </tbody>
          </table>
        </div>

        {/* Trial CTA */}
        {currentTier === 'free' && !trial && (
          <div className="mt-4 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                专业版 7 天免费试用
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                试用期间享受专业版全部功能，到期自动降级
              </p>
            </div>
            <Button
              onClick={handleTrial}
              loading={trialLoading}
              variant="primary"
              size="sm"
            >
              {t('plan.trial')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function FeatureRow({
  label,
  values,
  boolean = false,
}: {
  label: string
  values: (string | boolean)[]
  boolean?: boolean
}) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{label}</td>
      {values.map((val, i) => (
        <td key={i} className="text-center px-3 py-2.5">
          {boolean ? (
            val ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
            ) : (
              <span className="text-slate-600">—</span>
            )
          ) : (
            <span className="text-slate-700 dark:text-slate-200">{val}</span>
          )}
        </td>
      ))}
    </tr>
  )
}
