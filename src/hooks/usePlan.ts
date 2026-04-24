/**
 * 套餐 Hook — 当前套餐信息、额度检查、升降级
 */

import { useCallback } from 'react'
import { useUserStore } from '@/store/user-store'
import {
  getCurrentPlan,
  getPlanDefinition,
  checkQuota,
  isPaidPlan,
  isTrialActive,
  getTrialRemainingDays,
  startTrial,
  subscribePlan,
} from '@/services/plans'
import { useConfigStore } from '@/store/config-store'
import { useSubscriptionStore } from '@/store/subscription-store'

export function usePlan() {
  const user = useUserStore((s) => s.user)
  const products = useConfigStore((s) => s.products)
  const origins = useConfigStore((s) => s.origins)
  const subscriptions = useSubscriptionStore((s) => s.subscriptions)

  const plan = getCurrentPlan()
  const paid = isPaidPlan()
  const trial = isTrialActive()
  const trialDays = getTrialRemainingDays()

  const productsQuota = checkQuota('products', products.length)
  const originsQuota = checkQuota('origins', origins.length)
  const subscriptionsQuota = checkQuota('subscriptions', subscriptions.length)

  const beginTrial = useCallback(async () => {
    return startTrial()
  }, [])

  const subscribe = useCallback(async (tier: typeof user extends { plan: infer T } ? T : never, billing: 'monthly' | 'yearly') => {
    return subscribePlan(tier as any, billing)
  }, [])

  return {
    plan,
    tier: user?.plan ?? 'free',
    paid,
    trial,
    trialDays,
    quota: {
      products: productsQuota,
      origins: originsQuota,
      subscriptions: subscriptionsQuota,
    },
    beginTrial,
    subscribe,
    getPlanDefinition,
  }
}
