import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import chromeStorage from './persist-adapter'
import type { TariffProduct, TariffOrigin } from '@/types'
import { DEMO_HS_CODES, DEMO_ORIGINS } from '@/lib/mock-data'

interface ConfigState {
  products: TariffProduct[]
  origins: TariffOrigin[]

  addProduct: (product: TariffProduct) => void
  updateProduct: (id: string, updates: Partial<TariffProduct>) => void
  removeProduct: (id: string) => void

  addOrigin: (origin: TariffOrigin) => void
  updateOrigin: (id: string, updates: Partial<TariffOrigin>) => void
  removeOrigin: (id: string) => void
}

const now = () => new Date().toISOString()

const defaultProducts: TariffProduct[] = DEMO_HS_CODES.map((h, i) => ({
  id: `demo-${i}`,
  hsCode: h.hsCode,
  name: h.name,
  defaultValue: h.defaultValue,
  remark: `${h.nameEn} — MFN ${(h.mfnRate * 100).toFixed(1)}%`,
  createdAt: now(),
  updatedAt: now(),
}))

const defaultOrigins: TariffOrigin[] = DEMO_ORIGINS.map((o, i) => ({
  id: `demo-origin-${i}`,
  code: o.code,
  name: o.name,
  shippingDays: o.shippingDays,
  shippingCost: o.shippingCostPer40ft,
  createdAt: now(),
  updatedAt: now(),
}))

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      products: defaultProducts,
      origins: defaultOrigins,

      addProduct: (product) =>
        set((state) => ({ products: [...state.products, product] })),

      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: now() } : p,
          ),
        })),

      removeProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      addOrigin: (origin) =>
        set((state) => ({ origins: [...state.origins, origin] })),

      updateOrigin: (id, updates) =>
        set((state) => ({
          origins: state.origins.map((o) =>
            o.id === id ? { ...o, ...updates, updatedAt: now() } : o,
          ),
        })),

      removeOrigin: (id) =>
        set((state) => ({
          origins: state.origins.filter((o) => o.id !== id),
        })),
    }),
    {
      name: 'tariff-config',
      storage: chromeStorage,
    },
  ),
)
