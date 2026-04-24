import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import chromeStorage from './persist-adapter'
import type { TariffSubscription } from '@/types'

interface SubscriptionState {
  subscriptions: TariffSubscription[]

  addSubscription: (sub: TariffSubscription) => void
  updateSubscription: (id: string, updates: Partial<TariffSubscription>) => void
  removeSubscription: (id: string) => void
  toggleActive: (id: string) => void
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      subscriptions: [],

      addSubscription: (sub) =>
        set((state) => ({ subscriptions: [...state.subscriptions, sub] })),

      updateSubscription: (id, updates) =>
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === id ? { ...s, ...updates } : s,
          ),
        })),

      removeSubscription: (id) =>
        set((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== id),
        })),

      toggleActive: (id) =>
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === id ? { ...s, isActive: !s.isActive } : s,
          ),
        })),
    }),
    {
      name: 'tariff-subscriptions',
      storage: chromeStorage,
    },
  ),
)
