/**
 * 积分服务 — 余额查询、签到、消耗、补签
 *
 * 本地模式：直接操作 user-store + checkin-store
 * 在线模式：同步到服务端 /credits/*
 */

import { apiClient } from './api-client'
import { useUserStore } from '@/store/user-store'
import { useCheckInStore } from '@/store/checkin-store'
import { useConfigStore } from '@/store/config-store'
import {
  calculateCheckInCredits,
  canAfford,
  getActionCost,
  isActionAvailable,
  generateId,
} from '@/lib/credit-engine'
import type { CreditAction, CreditTransaction, CheckInRecord } from '@/types'

interface CheckInResult {
  record: CheckInRecord
  transaction: CreditTransaction
}

interface ConsumeResult {
  success: boolean
  transaction?: CreditTransaction
  error?: string
}

const MAX_MAKEUP_PER_MONTH = 3
const MAKEUP_COST = 20

export function getBalance(): number {
  return useUserStore.getState().user?.credits ?? 0
}

export function canPerformAction(action: CreditAction): boolean {
  const store = useUserStore.getState()
  const user = store.user
  if (!user) return false

  return canAfford(user.credits, action, user.plan)
}

export function checkActionAvailability(
  action: CreditAction,
  weeklyUsage: number,
): { available: boolean; remaining: number } {
  const user = useUserStore.getState().user
  if (!user) return { available: false, remaining: 0 }

  return isActionAvailable(action, user.plan, weeklyUsage)
}

export async function performCheckIn(): Promise<CheckInResult> {
  const userStore = useUserStore.getState()
  const checkinStore = useCheckInStore.getState()
  const user = userStore.user

  if (!user) throw new Error('not_logged_in')

  const today = new Date().toISOString().split('T')[0]
  if (checkinStore.lastCheckIn === today) {
    throw new Error('already_checked_in')
  }

  const newStreak = isConsecutiveDay(checkinStore.lastCheckIn)
    ? checkinStore.streak + 1
    : 1

  const credits = calculateCheckInCredits(newStreak, user.plan)

  const record: CheckInRecord = {
    date: today,
    ...credits,
  }

  const transaction: CreditTransaction = {
    id: generateId(),
    type: 'earn',
    amount: credits.totalCredits,
    reason: `每日签到（连续${newStreak}天）`,
    balanceAfter: user.credits + credits.totalCredits,
    createdAt: new Date().toISOString(),
  }

  checkinStore.checkIn(record)
  checkinStore.addTransaction(transaction)
  userStore.updateCredits(credits.totalCredits, '每日签到')

  if (userStore.isOnline) {
    apiClient.post('/credits/check-in', { date: today }).catch(() => {
      // 静默失败，本地状态已更新
    })
  }

  return { record, transaction }
}

export async function makeupCheckIn(date: string): Promise<CheckInResult> {
  const userStore = useUserStore.getState()
  const checkinStore = useCheckInStore.getState()
  const user = userStore.user

  if (!user) throw new Error('not_logged_in')
  if (checkinStore.makeupUsedThisMonth >= MAX_MAKEUP_PER_MONTH) {
    throw new Error('makeup_limit_reached')
  }
  if (user.credits < MAKEUP_COST) {
    throw new Error('insufficient_credits')
  }

  const existing = checkinStore.checkIns.find((c) => c.date === date)
  if (existing) throw new Error('already_checked_in')

  const credits = calculateCheckInCredits(0, user.plan)

  const record: CheckInRecord = {
    date,
    baseCredits: 0,
    streakBonus: 0,
    planMultiplier: credits.planMultiplier,
    totalCredits: 0,
  }

  const spendTx: CreditTransaction = {
    id: generateId(),
    type: 'spend',
    amount: MAKEUP_COST,
    reason: `补签 ${date}`,
    balanceAfter: user.credits - MAKEUP_COST,
    createdAt: new Date().toISOString(),
  }

  checkinStore.makeup(record)
  checkinStore.addTransaction(spendTx)
  userStore.updateCredits(-MAKEUP_COST, `补签 ${date}`)

  if (userStore.isOnline) {
    apiClient.post('/credits/check-in/makeup', { date }).catch(() => {})
  }

  return { record, transaction: spendTx }
}

export async function consumeCredits(
  action: CreditAction,
  weeklyUsage: number,
): Promise<ConsumeResult> {
  const userStore = useUserStore.getState()
  const checkinStore = useCheckInStore.getState()
  const user = userStore.user

  if (!user) return { success: false, error: 'not_logged_in' }

  const availability = checkActionAvailability(action, weeklyUsage)
  if (!availability.available) {
    return { success: false, error: 'weekly_limit_reached' }
  }

  const cost = getActionCost(action, user.plan)
  if (cost > 0 && user.credits < cost) {
    return { success: false, error: 'insufficient_credits' }
  }

  if (cost === 0) {
    return { success: true }
  }

  const transaction: CreditTransaction = {
    id: generateId(),
    type: 'spend',
    amount: cost,
    reason: action,
    balanceAfter: user.credits - cost,
    createdAt: new Date().toISOString(),
  }

  checkinStore.addTransaction(transaction)
  userStore.updateCredits(-cost, action)

  if (userStore.isOnline) {
    apiClient.post('/credits/consume', { action, amount: cost }).catch(() => {})
  }

  return { success: true, transaction }
}

export function getTransactions(limit = 50): CreditTransaction[] {
  return useCheckInStore.getState().transactions.slice(0, limit)
}

export function getCheckInHistory(days = 30): CheckInRecord[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  return useCheckInStore
    .getState()
    .checkIns.filter((c) => c.date >= cutoffStr)
}

export function getWeeklyUsage(action: CreditAction): number {
  const transactions = useCheckInStore.getState().transactions
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  return transactions.filter(
    (t) =>
      t.type === 'spend' &&
      t.reason === action &&
      new Date(t.createdAt) >= weekAgo,
  ).length
}

function isConsecutiveDay(lastCheckIn: string | null): boolean {
  if (!lastCheckIn) return false

  const last = new Date(lastCheckIn)
  const today = new Date()
  const diff = today.getTime() - last.getTime()
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24))

  return daysDiff === 1
}
