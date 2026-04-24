/**
 * 积分 Hook — 余额查询、消耗、签到
 */

import { useCallback } from 'react'
import { useUserStore } from '@/store/user-store'
import { useCheckInStore } from '@/store/checkin-store'
import {
  consumeCredits,
  performCheckIn,
  makeupCheckIn,
  getWeeklyUsage,
} from '@/services/credits'
import type { CreditAction } from '@/types'

export function useCredits() {
  const user = useUserStore((s) => s.user)
  const transactions = useCheckInStore((s) => s.transactions)
  const isOnline = useUserStore((s) => s.isOnline)

  const balance = user?.credits ?? 0
  const plan = user?.plan ?? 'free'

  const consume = useCallback(
    async (action: CreditAction) => {
      const weeklyUsage = getWeeklyUsage(action)
      return consumeCredits(action, weeklyUsage)
    },
    [],
  )

  const checkIn = useCallback(async () => {
    return performCheckIn()
  }, [])

  const makeup = useCallback(async (date: string) => {
    return makeupCheckIn(date)
  }, [])

  return {
    balance,
    plan,
    isOnline,
    transactions,
    consume,
    checkIn,
    makeup,
    getWeeklyUsage,
  }
}
