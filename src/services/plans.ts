/**
 * 套餐服务 — 当前套餐、额度检查、升降级、试用
 */

import { apiClient } from './api-client'
import { useUserStore } from '@/store/user-store'
import type { PlanTier, PlanDefinition } from '@/types'

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    tier: 'free',
    name: '免费版',
    nameEn: 'Free',
    price: 0,
    monthlyCredits: 0,
    features: {
      localCompare: 'limited',
      localCompareWeeklyLimit: 15,
      aiAnalysis: 'limited',
      aiAnalysisMonthlyLimit: 2,
      aiDeepReport: 'unavailable',
      maxProducts: 5,
      maxOrigins: 5,
      maxSubscriptions: 2,
      historyDays: 7,
      excelImport: false,
      cloudSync: false,
      trendChart: false,
      batchCompare: false,
      apiAccess: false,
      teamAccounts: 0,
      checkInMultiplier: 1,
    },
  },
  {
    tier: 'starter',
    name: '基础版',
    nameEn: 'Starter',
    price: 29,
    yearlyPrice: 290,
    monthlyCredits: 800,
    features: {
      localCompare: 'unlimited',
      aiAnalysis: 'limited',
      aiAnalysisMonthlyLimit: 30,
      aiDeepReport: 'limited',
      aiDeepReportMonthlyLimit: 10,
      maxProducts: 20,
      maxOrigins: 20,
      maxSubscriptions: 10,
      historyDays: 30,
      excelImport: true,
      cloudSync: true,
      trendChart: false,
      batchCompare: false,
      apiAccess: false,
      teamAccounts: 0,
      checkInMultiplier: 1.5,
    },
  },
  {
    tier: 'pro',
    name: '专业版',
    nameEn: 'Pro',
    price: 79,
    yearlyPrice: 699,
    monthlyCredits: 2500,
    features: {
      localCompare: 'unlimited',
      aiAnalysis: 'limited',
      aiAnalysisMonthlyLimit: 100,
      aiDeepReport: 'limited',
      aiDeepReportMonthlyLimit: 30,
      maxProducts: Infinity,
      maxOrigins: Infinity,
      maxSubscriptions: Infinity,
      historyDays: Infinity,
      excelImport: true,
      cloudSync: true,
      trendChart: true,
      batchCompare: true,
      apiAccess: true,
      teamAccounts: 0,
      checkInMultiplier: 2,
    },
  },
  {
    tier: 'enterprise',
    name: '企业版',
    nameEn: 'Enterprise',
    price: 299,
    yearlyPrice: 2999,
    monthlyCredits: 10000,
    features: {
      localCompare: 'unlimited',
      aiAnalysis: 'unlimited',
      aiDeepReport: 'unlimited',
      maxProducts: Infinity,
      maxOrigins: Infinity,
      maxSubscriptions: Infinity,
      historyDays: Infinity,
      excelImport: true,
      cloudSync: true,
      trendChart: true,
      batchCompare: true,
      apiAccess: true,
      teamAccounts: 5,
      checkInMultiplier: 3,
    },
  },
]

export function getCurrentPlan(): PlanDefinition {
  const user = useUserStore.getState().user
  const tier = user?.plan ?? 'free'
  return PLAN_DEFINITIONS.find((p) => p.tier === tier) ?? PLAN_DEFINITIONS[0]
}

export function getPlanDefinition(tier: PlanTier): PlanDefinition {
  return PLAN_DEFINITIONS.find((p) => p.tier === tier) ?? PLAN_DEFINITIONS[0]
}

export function checkQuota(
  type: 'products' | 'origins' | 'subscriptions',
  currentCount: number,
): { allowed: boolean; limit: number } {
  const plan = getCurrentPlan()
  const limits: Record<string, number> = {
    products: plan.features.maxProducts,
    origins: plan.features.maxOrigins,
    subscriptions: plan.features.maxSubscriptions,
  }

  const limit = limits[type]
  return { allowed: currentCount < limit, limit }
}

export async function startTrial(): Promise<void> {
  const store = useUserStore.getState()

  if (!store.isOnline) throw new Error('offline')

  const user = store.user
  if (!user) throw new Error('not_logged_in')
  if (user.plan !== 'free') throw new Error('already_on_paid_plan')
  if (user.trialEndsAt) throw new Error('trial_already_used')

  const res = await apiClient.post<{ plan: PlanTier; trialEndsAt: string }>(
    '/plans/trial',
    {},
  )

  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'trial_failed')
  }

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)

  store.setPlan('pro', trialEnd.toISOString())
  useUserStore.setState((state) => ({
    user: state.user
      ? { ...state.user, trialEndsAt: trialEnd.toISOString() }
      : state.user,
  }))
}

export async function subscribePlan(
  tier: PlanTier,
  billing: 'monthly' | 'yearly',
): Promise<string> {
  const store = useUserStore.getState()

  if (!store.isOnline) throw new Error('offline')

  const res = await apiClient.post<{ paymentUrl: string }>('/plans/subscribe', {
    tier,
    billing,
  })

  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'subscribe_failed')
  }

  return res.data.paymentUrl
}

export function isTrialActive(): boolean {
  const user = useUserStore.getState().user
  if (!user?.trialEndsAt) return false
  return new Date(user.trialEndsAt) > new Date()
}

export function getTrialRemainingDays(): number {
  const user = useUserStore.getState().user
  if (!user?.trialEndsAt) return 0
  const diff = new Date(user.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function isPaidPlan(): boolean {
  const user = useUserStore.getState().user
  return user?.plan !== 'free'
}
