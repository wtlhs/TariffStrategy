import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import chromeStorage from './persist-adapter'
import type { CheckInRecord, CreditTransaction } from '@/types'

interface CheckInState {
  checkIns: CheckInRecord[]
  transactions: CreditTransaction[]
  streak: number
  lastCheckIn: string | null
  makeupUsedThisMonth: number
  lastMakeupResetMonth: string

  checkIn: (record: CheckInRecord) => void
  makeup: (record: CheckInRecord) => void
  addTransaction: (tx: CreditTransaction) => void
  setStreak: (days: number) => void
  resetMonthlyMakeup: () => void
}

export const useCheckInStore = create<CheckInState>()(
  persist(
    (set) => ({
      checkIns: [],
      transactions: [],
      streak: 0,
      lastCheckIn: null,
      makeupUsedThisMonth: 0,
      lastMakeupResetMonth: '',

      checkIn: (record) =>
        set((state) => ({
          checkIns: [...state.checkIns, record],
          lastCheckIn: record.date,
          streak: state.streak + 1,
        })),

      makeup: (record) =>
        set((state) => ({
          checkIns: [...state.checkIns, record],
          lastCheckIn: record.date,
          makeupUsedThisMonth: state.makeupUsedThisMonth + 1,
        })),

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions].slice(0, 500),
        })),

      setStreak: (days) => set({ streak: days }),

      resetMonthlyMakeup: () => {
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        set({ makeupUsedThisMonth: 0, lastMakeupResetMonth: month })
      },
    }),
    {
      name: 'tariff-checkin',
      storage: chromeStorage,
    },
  ),
)
