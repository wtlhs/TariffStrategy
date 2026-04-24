import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { sendVerificationCode, loginWithPhone } from '@/services/auth'

interface PhoneLoginModalProps {
  open: boolean
  onClose: () => void
}

const PHONE_RE = /^1\d{10}$/
const CODE_RE = /^\d{6}$/

export function PhoneLoginModal({ open, onClose }: PhoneLoginModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; code?: string }>({})
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const resetAndClose = useCallback(() => {
    setStep('phone')
    setPhone('')
    setCode('')
    setErrors({})
    setCountdown(0)
    setLoading(false)
    onClose()
  }, [onClose])

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setErrors({ phone: t('auth.phoneRequired') })
      return
    }
    if (!PHONE_RE.test(phone.trim())) {
      setErrors({ phone: t('auth.phoneInvalid') })
      return
    }
    setErrors({})
    setLoading(true)
    try {
      await sendVerificationCode(phone.trim())
      setStep('code')
      setCountdown(60)
    } catch {
      setErrors({ phone: t('auth.loginFailed') })
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!code.trim()) {
      setErrors({ code: t('auth.codeRequired') })
      return
    }
    if (!CODE_RE.test(code.trim())) {
      setErrors({ code: t('auth.codeInvalid') })
      return
    }
    setErrors({})
    setLoading(true)
    try {
      await loginWithPhone({ phone: phone.trim(), code: code.trim() })
      resetAndClose()
    } catch {
      setErrors({ code: t('auth.loginFailed') })
    } finally {
      setLoading(false)
    }
  }

  const maskedPhone = phone.length >= 7
    ? `${phone.slice(0, 3)}****${phone.slice(7)}`
    : phone

  const inputCls =
    'h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors'

  return (
    <Modal open={open} onClose={resetAndClose}>
      <div className="space-y-5 py-2">
        {step === 'phone' ? (
          <>
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15">
                <Phone size={22} className="text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('auth.phoneLogin')}
              </h3>
            </div>

            {/* Phone input */}
            <div>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-3 h-10 text-sm text-slate-500 dark:text-slate-400 shrink-0">
                  +86
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ''))
                    setErrors({})
                  }}
                  placeholder={t('auth.phonePlaceholder')}
                  className={inputCls}
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Send code button */}
            <Button
              onClick={handleSendCode}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {t('auth.sendCode')}
            </Button>

            <p className="text-center text-xs text-slate-400">
              {t('auth.noAccount')}
            </p>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <ShieldCheck size={22} className="text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('auth.codePlaceholder')}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {t('auth.sentTo', { phone: maskedPhone })}
              </p>
            </div>

            {/* Code input */}
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  setErrors({})
                }}
                placeholder={t('auth.codePlaceholder')}
                className="h-12 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-center text-xl tracking-[0.5em] text-slate-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                autoFocus
              />
              {errors.code && (
                <p className="mt-1.5 text-xs text-red-500">{errors.code}</p>
              )}
            </div>

            {/* Login button */}
            <Button
              onClick={handleLogin}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </Button>

            {/* Back + Resend */}
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => { setStep('phone'); setCode(''); setErrors({}) }}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft size={14} />
                {t('common.back')}
              </button>
              {countdown > 0 ? (
                <span className="text-xs text-slate-400">
                  {t('auth.resendCode')} {t('auth.countdown', { seconds: countdown })}
                </span>
              ) : (
                <button
                  onClick={handleSendCode}
                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  {t('auth.resendCode')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
