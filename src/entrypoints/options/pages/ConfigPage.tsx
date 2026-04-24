/**
 * ConfigPage — 基础配置（产品 CRUD + 发货国家 CRUD + 额度指示）
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Package, Globe, Plus, Trash2, AlertCircle } from 'lucide-react'
import { useConfigStore } from '@/store/config-store'
import { usePlan } from '@/hooks/usePlan'
import { QuotaIndicator } from '@/components/commercial/PlanBadge'
import { generateId } from '@/lib/credit-engine'
import { ORIGIN_COUNTRIES } from '@/constants/countries'
import type { TariffProduct, TariffOrigin } from '@/types'

export function ConfigPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'products' | 'origins'>('products')

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header — 同策略分析页 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
          <Settings size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">基础配置</h2>
          <p className="text-xs text-slate-400">管理产品和发货国家</p>
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-1 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 p-1 w-fit">
        <TabBtn active={tab === 'products'} onClick={() => setTab('products')} icon={<Package size={14} />}>
          {t('data.productList')}
        </TabBtn>
        <TabBtn active={tab === 'origins'} onClick={() => setTab('origins')} icon={<Globe size={14} />}>
          {t('data.originList')}
        </TabBtn>
      </div>

      {tab === 'products' ? <ProductsSection /> : <OriginsSection />}
    </div>
  )
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-primary/20 text-primary-light' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {icon} {children}
    </button>
  )
}

function ProductsSection() {
  const { t } = useTranslation()
  const { products, addProduct, removeProduct } = useConfigStore()
  const { quota } = usePlan()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ hsCode: '', name: '', defaultValue: 50000, remark: '' })

  const handleAdd = () => {
    if (!form.hsCode || !form.name) return
    const now = new Date().toISOString()
    const product: TariffProduct = {
      id: generateId(), hsCode: form.hsCode, name: form.name,
      defaultValue: form.defaultValue, remark: form.remark || undefined,
      createdAt: now, updatedAt: now,
    }
    addProduct(product)
    setForm({ hsCode: '', name: '', defaultValue: 50000, remark: '' })
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <QuotaIndicator type="products" current={products.length} />
        {!quota.products.allowed ? (
          <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12} /> 额度已满</span>
        ) : (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-light hover:bg-primary/30 transition-colors">
            <Plus size={14} /> {t('common.add')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="HS编码" value={form.hsCode} onChange={(v) => setForm({ ...form, hsCode: v })} placeholder="8482.10" />
            <FormField label="产品名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="滚珠轴承" />
            <FormField label="默认货值 (USD)" value={String(form.defaultValue)} onChange={(v) => setForm({ ...form, defaultValue: Number(v) })} type="number" />
            <FormField label="备注" value={form.remark} onChange={(v) => setForm({ ...form, remark: v })} placeholder="可选" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark">{t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Package size={16} className="text-slate-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.hsCode} · ${p.defaultValue.toLocaleString()}{p.remark && <span className="ml-2 text-slate-500">{p.remark}</span>}</p>
              </div>
            </div>
            <button onClick={() => removeProduct(p.id)} className="shrink-0 p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function OriginsSection() {
  const { t } = useTranslation()
  const { origins, addOrigin, removeOrigin } = useConfigStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', shippingDays: 14, shippingCost: 2000 })

  const handleAdd = () => {
    if (!form.code || !form.name) return
    const now = new Date().toISOString()
    const origin: TariffOrigin = {
      id: generateId(), code: form.code.toUpperCase(), name: form.name,
      shippingDays: form.shippingDays, shippingCost: form.shippingCost,
      createdAt: now, updatedAt: now,
    }
    addOrigin(origin)
    setForm({ code: '', name: '', shippingDays: 14, shippingCost: 2000 })
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <QuotaIndicator type="origins" current={origins.length} />
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-light hover:bg-primary/30 transition-colors">
          <Plus size={14} /> {t('common.add')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">国家代码</label>
              <select value={form.code} onChange={(e) => { const c = ORIGIN_COUNTRIES.find((c) => c.code === e.target.value); setForm({ ...form, code: e.target.value, name: c?.name ?? '' }) }} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400">
                <option value="">选择国家</option>
                {ORIGIN_COUNTRIES.map((c) => (<option key={c.code} value={c.code}>{c.flag} {c.name}</option>))}
              </select>
            </div>
            <FormField label="国家名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <FormField label="运输天数" value={String(form.shippingDays)} onChange={(v) => setForm({ ...form, shippingDays: Number(v) })} type="number" />
            <FormField label="运费 (USD/40ft)" value={String(form.shippingCost)} onChange={(v) => setForm({ ...form, shippingCost: Number(v) })} type="number" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark">{t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {origins.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Globe size={16} className="text-slate-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{o.name}</p>
                <p className="text-xs text-slate-400">{o.code} · {o.shippingDays}天 · ${o.shippingCost.toLocaleString()}/40ft</p>
              </div>
            </div>
            <button onClick={() => removeOrigin(o.id)} className="shrink-0 p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400" />
    </div>
  )
}
