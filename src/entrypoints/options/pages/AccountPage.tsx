import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, LogOut, Phone } from 'lucide-react'
import { useUserStore } from '@/store/user-store'
import { logout } from '@/services/auth'
import { PlanBadge } from '@/components/commercial/PlanBadge'
import { LocaleToggle } from '@/components/common/LocaleToggle'
import { PhoneLoginModal } from '@/components/auth/PhoneLoginModal'
import { EmailBindSection } from '@/components/auth/EmailBindSection'

function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`
  }
  return phone
}

export function AccountPage() {
  const { t } = useTranslation()
  const userStore = useUserStore()
  const user = userStore.user
  const isLoggedIn = userStore.isLoggedIn
  const [showPhoneLogin, setShowPhoneLogin] = useState(false)

  const handleLogout = () => { logout() }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
          <User size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('profile.title')}</h2>
          <p className="text-xs text-slate-400">
            {t('profile.settings')}
          </p>
        </div>
      </div>

      {/* Account info */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 space-y-5">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
          {t('profile.currentPlan')}
        </h3>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
            <User size={24} className="text-slate-400" />
          </div>
          <div>
            {isLoggedIn ? (
              <p className="font-medium text-slate-900 dark:text-white">
                {user?.phone ? maskPhone(user.phone) : user?.email || '—'}
              </p>
            ) : (
              <p className="text-sm text-slate-400">{t('profile.notLoggedIn')}</p>
            )}
            <PlanBadge compact />
          </div>
        </div>

        {/* Login button (when not logged in) */}
        {!isLoggedIn && (
          <button
            onClick={() => setShowPhoneLogin(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Phone size={16} />
            {t('auth.phoneLogin')}
          </button>
        )}

        {/* Email bind (when logged in) */}
        {isLoggedIn && <EmailBindSection />}
      </section>

      {/* Settings */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5 space-y-4">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
          {t('profile.settings')}
        </h3>
        <LocaleToggle />
      </section>

      {isLoggedIn && (
        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={14} /> {t('profile.logout')}
          </button>
        </div>
      )}

      <div className="text-xs text-slate-600 text-center">{t('profile.version', { version: '1.0.0' })}</div>

      <PhoneLoginModal
        open={showPhoneLogin}
        onClose={() => setShowPhoneLogin(false)}
      />
    </div>
  )
}
