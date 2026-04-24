/**
 * 签到 Hook — 签到状态、连续天数、签到日历数据
 */

import { useMemo } from 'react'
import { useCheckInStore } from '@/store/checkin-store'
import { useUserStore } from '@/store/user-store'
import { calculateCheckInCredits } from '@/lib/credit-engine'

export function useCheckIn() {
  const streak = useCheckInStore((s) => s.streak)
  const lastCheckIn = useCheckInStore((s) => s.lastCheckIn)
  const checkIns = useCheckInStore((s) => s.checkIns)
  const makeupUsed = useCheckInStore((s) => s.makeupUsedThisMonth)
  const plan = useUserStore((s) => s.user?.plan ?? 'free')

  const today = new Date().toISOString().split('T')[0]
  const hasCheckedInToday = lastCheckIn === today

  const nextCredits = useMemo(
    () => calculateCheckInCredits(hasCheckedInToday ? streak : streak + 1, plan),
    [streak, plan, hasCheckedInToday],
  )

  const currentMonthCheckIns = useMemo(() => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return checkIns.filter((c) => c.date >= monthStart)
  }, [checkIns])

  const canMakeup = makeupUsed < 3

  return {
    streak,
    lastCheckIn,
    hasCheckedInToday,
    nextCredits,
    currentMonthCheckIns,
    canMakeup,
    makeupUsedThisMonth: makeupUsed,
  }
}
