import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { DsButton } from '@/design-system'
import { platformLogin } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { OtpInput } from '@/components/OtpInput'
import { useUiStore } from '@/stores/ui-store'
import { AuthChrome } from './AuthChrome'

export function MfaChallengePage() {
  const t = useUiStore((s) => s.t)
  const navigate = useNavigate()
  const location = useLocation()
  const mfaPhase = useAuthStore((s) => s.mfaPhase)
  const pendingCredentials = useAuthStore((s) => s.pendingCredentials)
  const applySuccessfulAuth = useAuthStore((s) => s.applySuccessfulAuth)
  const clearMfaFlow = useAuthStore((s) => s.clearMfaFlow)

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (mfaPhase !== 'challenge' || !pendingCredentials) {
    return <Navigate to="/login" replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { status, data } = await platformLogin({
        email: pendingCredentials!.email,
        password: pendingCredentials!.password,
        mfaCode: code,
      })
      if (status === 200 && data.success && data.accessToken) {
        applySuccessfulAuth(data)
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
        navigate(from && from !== '/login' ? from : '/oc', { replace: true })
        return
      }
      if (data.errorCode === 'MFA_INVALID') {
        setError(t('auth.mfaBadCode'))
        return
      }
      setError(data.errorMessage || t('auth.mfaAuthFailed'))
    } catch {
      setError(t('auth.mfaVerifyFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthChrome title={t('auth.mfaChallengeTitle')} subtitle={t('auth.mfaHint')}>
      <form onSubmit={onSubmit} className="hm-auth__card">
        <OtpInput value={code} onChange={setCode} autoFocus />
        <p className="hm-auth__hint">{t('auth.mfaClockHint')}</p>
        {error ? (
          <p role="alert" className="hm-auth__error">
            {error}
          </p>
        ) : null}
        <DsButton type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting || code.length < 6}>
          {submitting ? t('auth.mfaVerifying') : t('auth.mfaVerify')}
        </DsButton>
        <Link to="/login" onClick={() => clearMfaFlow()} className="text-center text-sm text-[var(--ds-text-muted)] underline">
          {t('auth.mfaBackLogin')}
        </Link>
      </form>
    </AuthChrome>
  )
}
