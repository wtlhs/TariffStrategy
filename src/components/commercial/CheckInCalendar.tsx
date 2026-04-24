/**
 * CheckInCalendar — 签到日历 + 连续天数动画 + 积分获取提示
 *
 * 显示当月日历网格，已签到日期高亮
 * 连续签到天数和下一天可获得积分
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Flame, Gift, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { useCredits } from '@/hooks/useCredits'

interface CheckInCalendarProps {
  onCheckIn?: () => void
}

export function CheckInCalendar({ onCheckIn }: CheckInCalendarProps) {
  const { t } = useTranslation()
  const {
    streak,
    hasCheckedInToday,
    nextCredits,
    currentMonthCheckIns,
    canMakeup,
  } = useCheckIn()
  const { balance, checkIn } = useCredits()
  const [loading, setLoading] = useState(false)
  const [earnedAmount, setEarnedAmount] = useState<number | null>(null)

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const result = await checkIn()
      setEarnedAmount(result.record.totalCredits)
      setTimeout(() => setEarnedAmount(null), 3000)
      onCheckIn?.()
    } catch {
      // 错误处理
    } finally {
      setLoading(false)
    }
  }

  // 生成日历网格
  const days = generateCalendarDays(viewMonth.year, viewMonth.month)
  const checkedDates = new Set(currentMonthCheckIns.map((c) => c.date))
  const today = new Date().toISOString().split('T')[0]

  const prevMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month === 0 ? 11 : prev.month - 1
      const y = prev.month === 0 ? prev.year - 1 : prev.year
      return { year: y, month: m }
    })
  }

  const nextMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month === 11 ? 0 : prev.month + 1
      const y = prev.month === 11 ? prev.year + 1 : prev.year
      return { year: y, month: m }
    })
  }

  const monthLabel = `${viewMonth.year}年${viewMonth.month + 1}月`

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm dark:shadow-none p-4">
      {/* Header: streak + balance */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame className={`h-5 w-5 ${streak >= 7 ? 'text-orange-400' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('credits.checkIn.streak', { days: streak })}
            </span>
          </div>
          {streak >= 3 && (
            <span className="text-xs text-amber-400">
              +{nextCredits.streakBonus} {t('credits.checkIn.bonus', { amount: nextCredits.streakBonus })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <Gift className="h-4 w-4 text-amber-400" />
          {t('credits.balance')}: <span className="text-amber-700 dark:text-amber-300 font-medium">{balance}</span>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div key={d} className="text-center text-xs text-slate-500 py-1">
            {d}
          </div>
        ))}
        {days.map((date, i) => {
          const isChecked = date ? checkedDates.has(date) : false
          const isToday = date === today

          return (
            <div
              key={i}
              className={`relative aspect-square flex items-center justify-center rounded-lg text-xs transition-all ${
                !date
                  ? ''
                  : isChecked
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium'
                    : isToday
                      ? 'border border-primary/50 text-slate-800 dark:text-slate-200'
                      : 'text-slate-400'
              }`}
            >
              {date ? parseInt(date.split('-')[2], 10) : ''}
              {isChecked && (
                <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
          )
        })}
      </div>

      {/* Check-in button */}
      <div className="relative">
        <button
          onClick={handleCheckIn}
          disabled={hasCheckedInToday || loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
            hasCheckedInToday
              ? 'bg-slate-200 dark:bg-slate-700/50 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-glow'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {hasCheckedInToday
            ? t('credits.checkIn.already')
            : loading
              ? '...'
              : `${t('credits.checkIn.btn')} (+${nextCredits.totalCredits})`}
        </button>

        {/* Earned animation */}
        {earnedAmount !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-amber-700 dark:text-amber-300 font-bold text-lg animate-bounce">
              +{earnedAmount}
            </span>
          </div>
        )}
      </div>

      {/* Streak bonus info */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Sparkles className="h-3.5 w-3.5" />
        <span>
          {t('plan.features.checkInBonus')}: {nextCredits.planMultiplier}x
        </span>
        {nextCredits.streakBonus > 0 && (
          <span className="text-amber-400">
            {t('credits.checkIn.bonus', { amount: nextCredits.streakBonus })}
          </span>
        )}
      </div>
    </div>
  )
}

function generateCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // 周一为第一天
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStr = `${year}-${pad(month + 1)}`

  const result: (string | null)[] = []
  for (let i = 0; i < startDow; i++) result.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    result.push(`${monthStr}-${pad(d)}`)
  }

  return result
}
