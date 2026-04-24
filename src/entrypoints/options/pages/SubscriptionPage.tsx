/**
 * SubscriptionPage — 订阅管理（规则 CRUD + 通知渠道配置）
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Mail, MessageSquare, Smartphone, Globe, X } from 'lucide-react'
import { useSubscriptionStore } from '@/store/subscription-store'
import { QuotaIndicator } from '@/components/commercial/PlanBadge'
import { generateId } from '@/lib/credit-engine'
import type { TariffSubscription, RuleType } from '@/types'

const RULE_TYPE_OPTIONS: { value: RuleType; label: string }[] = [
  { value: 'product', label: '产品税率变化' },
  { value: 'route', label: '路线成本变化' },
  { value: 'cost', label: '成本阈值触发' },
  { value: 'policy', label: '政策法规变化' },
]

const CHANNEL_OPTIONS = [
  { value: 'email', label: '邮件', icon: Mail },
  { value: 'dingtalk', label: '钉钉', icon: MessageSquare },
  { value: 'wechat', label: '企业微信', icon: Smartphone },
  { value: 'webhook', label: 'Webhook', icon: Globe },
]

export function SubscriptionPage() {
  const { t } = useTranslation()
  const { subscriptions, addSubscription, removeSubscription, toggleActive } = useSubscriptionStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ruleName: '', ruleType: 'product' as RuleType, channels: ['email'] as string[] })

  const handleAdd = () => {
    if (!form.ruleName) return
    const sub: TariffSubscription = {
      id: generateId(), ruleName: form.ruleName, ruleType: form.ruleType,
      ruleConfig: {}, channels: form.channels, isActive: true, createdAt: new Date().toISOString(),
    }
    addSubscription(sub)
    setForm({ ruleName: '', ruleType: 'product', channels: ['email'] })
    setShowForm(false)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
            <Bell size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('subscription.title')}</h2>
            <p className="text-xs text-slate-400">订阅税率变化通知</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-light hover:bg-primary/30 transition-colors">
          <Plus size={14} /> {t('subscription.addRule')}
        </button>
      </div>

      <QuotaIndicator type="subscriptions" current={subscriptions.length} />

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">新建订阅规则</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">{t('subscription.ruleName')}</label>
              <input value={form.ruleName} onChange={(e) => setForm({ ...form, ruleName: e.target.value })} placeholder="例: 滚珠轴承关税变化" className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">{t('subscription.ruleType')}</label>
              <select value={form.ruleType} onChange={(e) => setForm({ ...form, ruleType: e.target.value as RuleType })} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400">
                {RULE_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('subscription.channels')}</label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((ch) => {
                const Icon = ch.icon
                const active = form.channels.includes(ch.value)
                return (
                  <button key={ch.value} onClick={() => setForm({ ...form, channels: active ? form.channels.filter((c) => c !== ch.value) : [...form.channels, ch.value] })} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${active ? 'border-primary bg-primary/15 text-primary-light' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    <Icon size={13} /> {ch.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">{t('common.cancel')}</button>
            <button onClick={handleAdd} disabled={!form.ruleName || form.channels.length === 0} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">{t('common.save')}</button>
          </div>
        </div>
      )}

      {/* Subscription list */}
      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Bell size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('subscription.noSubscriptions')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div key={sub.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${sub.isActive ? 'border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none' : 'border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 opacity-60'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">{sub.ruleName}</p>
                  <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">{RULE_TYPE_OPTIONS.find((o) => o.value === sub.ruleType)?.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {sub.channels.map((ch) => { const opt = CHANNEL_OPTIONS.find((c) => c.value === ch); return opt ? <span key={ch} className="flex items-center gap-0.5 text-[11px] text-slate-500"><opt.icon size={10} /> {opt.label}</span> : null })}
                  <span className="text-[11px] text-slate-600">{sub.createdAt.split('T')[0]}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(sub.id)} className={`p-1 transition-colors ${sub.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{sub.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                <button onClick={() => removeSubscription(sub.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
