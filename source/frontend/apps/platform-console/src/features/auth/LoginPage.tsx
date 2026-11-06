import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DsButton, PasswordInput, TextInput } from '@/design-system'
import { platformLogin } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { AuthChrome } from './AuthChrome'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useUiStore((s) => s.t)
  const beginMfaSetup = useAuthStore((s) => s.beginMfaSetup)
  const beginMfaChallenge = useAuthStore((s) => s.beginMfaChallenge)
  const applySuccessfulAuth = useAuthStore((s) => s.applySuccessfulAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { status, data } = await platformLogin({ email: email.trim(), password })
      const credentials = { email: email.trim(), password }

      if (status === 403 || data.mfaSetupRequired) {
        beginMfaSetup(data, credentials)
        navigate('/mfa-setup', { replace: true })
        return
      }

      if (status === 401 && data.errorCode === 'MFA_REQUIRED') {
        beginMfaChallenge(credentials)
        navigate('/mfa-challenge', { replace: true, state: location.state })
        return
      }

      if (status === 200 && data.success && data.accessToken) {
        applySuccessfulAuth(data)
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
        navigate(from && from !== '/login' ? from : '/oc', { replace: true })
        return
      }

      const message = data && typeof data === 'object' ? (data as { errorMessage?: string }).errorMessage : undefined

      if (status === 401) {
        setError(message || t('auth.invalidCredentials'))
        return
      }

      setError(message || t('errors.generic'))
    } catch {
      setError(t('errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthChrome title={t('auth.signIn')} subtitle={t('auth.platformHint')}>
      <form onSubmit={onSubmit} className="hm-auth__card">
        <TextInput
          label={t('auth.email')}
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label={t('auth.password')}
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p role="alert" className="hm-auth__error">
            {error}
          </p>
        ) : null}
        <DsButton type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
          {submitting ? t('auth.signingIn') : t('common.continue')}
        </DsButton>
      </form>
    </AuthChrome>
  )
}
