import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import chromeStorage from './persist-adapter'
import type { UserAccount, PlanTier, CreditTransaction, SearchParams } from '@/types'

interface UserState {
  user: UserAccount | null
  isLoggedIn: boolean
  isOnline: boolean

  login: (user: UserAccount) => void
  logout: () => void
  updateCredits: (delta: number, reason: string) => void
  setPlan: (plan: PlanTier, expiresAt?: string) => void
  updateLastSearch: (params: SearchParams) => void
  addTransaction: (tx: CreditTransaction) => void
  setOnline: (online: boolean) => void
}

const createGuestUser = (): UserAccount => ({
  userId: 'guest',
  email: '',
  plan: 'free',
  credits: 100,
  totalCreditsEarned: 100,
  totalCreditsSpent: 0,
  checkInStreak: 0,
  createdAt: new Date().toISOString(),
})

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: createGuestUser(),
      isLoggedIn: false,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

      login: (user) => set({ user, isLoggedIn: true }),

      logout: () => set({ user: createGuestUser(), isLoggedIn: false }),

      updateCredits: (delta, reason) => {
        const user = get().user
        if (!user) return
        const newCredits = user.credits + delta
        set({
          user: {
            ...user,
            credits: Math.max(0, newCredits),
            totalCreditsEarned: delta > 0 ? user.totalCreditsEarned + delta : user.totalCreditsEarned,
            totalCreditsSpent: delta < 0 ? user.totalCreditsSpent + Math.abs(delta) : user.totalCreditsSpent,
          },
        })
      },

      setPlan: (plan, expiresAt) => {
        const user = get().user
        if (!user) return
        set({
          user: {
            ...user,
            plan,
            planExpiresAt: expiresAt,
          },
        })
      },

      updateLastSearch: (params) => {
        const user = get().user
        if (!user) return
        set({
          user: {
            ...user,
            lastSearchAt: new Date().toISOString(),
            lastSearchParams: params,
          },
        })
      },

      addTransaction: () => {
        // transactions stored in separate checkin-store for simplicity
      },

      setOnline: (online) => set({ isOnline: online }),
    }),
    {
      name: 'tariff-user',
      storage: chromeStorage,
      partialize: (state): Partial<UserState> => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
)
