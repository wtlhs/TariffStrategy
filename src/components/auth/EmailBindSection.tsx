import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Check, X } from 'lucide-react'
import { useUserStore } from '@/store/user-store'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}***@${domain}`
}

export function EmailBindSection() {
  const { t } = useTranslation()
  const userStore = useUserStore()
  const user = userStore.user
  const boundEmail = user?.email

  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  if (!user) return null

  const handleBind = () => {
    if (!email.trim()) {
      setError(t('auth.emailInvalid'))
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.emailInvalid'))
      return
    }
    userStore.login({ ...user, email: email.trim() })
    setEmail('')
    setError('')
    setEditing(false)
  }

  const handleRemove = () => {
    const { email: _, ...rest } = user
    userStore.login({ ...rest, email: undefined } as typeof user)
    setEditing(false)
  }

  const handleCancel = () => {
    setEmail('')
    setError('')
    setEditing(false)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-400">
        {t('profile.email')}
      </label>

      {boundEmail && !editing ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Mail size={14} className="text-emerald-500 shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {maskEmail(boundEmail)}
            </span>
            <span className="text-xs text-slate-400">({t('auth.emailBoundDesc')})</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => { setEditing(true); setEmail('') }}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            >
              {t('auth.emailChangeBtn')}
            </button>
            <button
              onClick={handleRemove}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder={t('auth.emailPlaceholder')}
              className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleBind}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-light hover:bg-primary/30 transition-colors shrink-0"
            >
              <Check size={14} />
              {t('auth.emailBindBtn')}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
            >
              {t('common.cancel')}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
