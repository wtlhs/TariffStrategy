/**
 * 积分计算引擎
 *
 * 签到积分（连续签到加成）、操作消耗积分、套餐乘数、额度检查
 */

import type { CreditAction, CreditCostConfig, PlanTier, CheckInRecord } from '@/types'

/** 各操作的积分消耗配置 */
export const CREDIT_COSTS: Record<CreditAction, CreditCostConfig> = {
  local_compare:     { action: 'local_compare',     freeUserCost: 2,  paidUserCost: 0, freeWeeklyLimit: 15 },
  ai_analysis:       { action: 'ai_analysis',        freeUserCost: 10, paidUserCost: 10, freeWeeklyLimit: 2 },
  ai_deep_report:    { action: 'ai_deep_report',     freeUserCost: 999, paidUserCost: 25, freeWeeklyLimit: 0 },
  data_refresh:      { action: 'data_refresh',       freeUserCost: 5,  paidUserCost: 5,  freeWeeklyLimit: 5 },
  excel_export:      { action: 'excel_export',       freeUserCost: 3,  paidUserCost: 3,  freeWeeklyLimit: undefined },
  excel_import:      { action: 'excel_import',       freeUserCost: 5,  paidUserCost: 5,  freeWeeklyLimit: undefined },
  create_subscription: { action: 'create_subscription', freeUserCost: 5, paidUserCost: 5, freeWeeklyLimit: undefined },
  send_notification:  { action: 'send_notification',  freeUserCost: 1, paidUserCost: 1,  freeWeeklyLimit: undefined },
}

/** 套餐签到加成乘数 */
export const PLAN_CHECKIN_MULTIPLIERS: Record<PlanTier, number> = {
  free: 1.0,
  starter: 1.5,
  pro: 2.0,
  enterprise: 3.0,
}

/** 签到基础积分和连续签到奖励 */
const CHECKIN_BASE = 10
const STREAK_TIERS = [
  { threshold: 30, bonus: 20 },
  { threshold: 7, bonus: 10 },
  { threshold: 3, bonus: 5 },
  { threshold: 0, bonus: 0 },
]

/**
 * 计算签到可获积分
 */
export function calculateCheckInCredits(
  streak: number,
  plan: PlanTier,
): Omit<CheckInRecord, 'date'> {
  const multiplier = PLAN_CHECKIN_MULTIPLIERS[plan]
  const streakBonus = STREAK_TIERS.find((t) => streak >= t.threshold)?.bonus ?? 0
  const rawTotal = (CHECKIN_BASE + streakBonus) * multiplier

  return {
    baseCredits: CHECKIN_BASE,
    streakBonus,
    planMultiplier: multiplier,
    totalCredits: Math.round(rawTotal),
  }
}

/**
 * 获取操作消耗的积分数
 */
export function getActionCost(action: CreditAction, plan: PlanTier): number {
  const config = CREDIT_COSTS[action]
  const isPaid = plan !== 'free'
  return isPaid ? config.paidUserCost : config.freeUserCost
}

/**
 * 检查是否有足够积分
 */
export function canAfford(credits: number, action: CreditAction, plan: PlanTier): boolean {
  if (plan !== 'free' && action === 'local_compare') return true
  const cost = getActionCost(action, plan)
  return cost === 0 || credits >= cost
}

/**
 * 检查操作是否可用（免费用户周额度）
 */
export function isActionAvailable(
  action: CreditAction,
  plan: PlanTier,
  weeklyUsage: number,
): { available: boolean; remaining: number } {
  if (plan !== 'free') {
    return { available: true, remaining: Infinity }
  }

  const config = CREDIT_COSTS[action]
  if (config.freeWeeklyLimit === undefined) {
    return { available: true, remaining: Infinity }
  }

  const remaining = Math.max(0, config.freeWeeklyLimit - weeklyUsage)
  return { available: remaining > 0, remaining }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}
