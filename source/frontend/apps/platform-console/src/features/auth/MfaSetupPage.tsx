import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DsButton } from '@/design-system'
import { platformMfaSetup } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { OtpInput } from '@/components/OtpInput'
import { useUiStore } from '@/stores/ui-store'
import { AuthChrome } from './AuthChrome'

export function MfaSetupPage() {
  const t = useUiStore((s) => s.t)
  const navigate = useNavigate()
  const mfaPhase = useAuthStore((s) => s.mfaPhase)
  const setupToken = useAuthStore((s) => s.setupToken)
  const otpAuthUri = useAuthStore((s) => s.otpAuthUri)
  const mfaManualKey = useAuthStore((s) => s.mfaManualKey)
  const applySuccessfulAuth = useAuthStore((s) => s.applySuccessfulAuth)
  const clearMfaFlow = useAuthStore((s) => s.clearMfaFlow)

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (mfaPhase !== 'setup' || !setupToken) {
    return <Navigate to="/login" replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { status, data } = await platformMfaSetup({ setupToken: setupToken!, mfaCode: code })
      if (status === 200 && data.success && data.accessToken) {
        applySuccessfulAuth(data)
        navigate('/oc', { replace: true })
        return
      }
      if (data.errorCode === 'SETUP_TOKEN_EXPIRED' || data.errorCode === 'SETUP_TOKEN_INVALID') {
        setExpired(true)
        setError(t('auth.mfaSetupExpired'))
        return
      }
      setError(data.errorMessage || t('auth.mfaBadCode'))
    } catch {
      setError(t('auth.mfaSetupFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthChrome title={t('auth.mfaSetupTitle')} subtitle={t('auth.mfaHint')}>
      <div className="hm-auth__card">
        {otpAuthUri ? (
          <div className="hm-auth__qr">
            <QRCodeSVG value={otpAuthUri} size={180} />
          </div>
        ) : null}
        {mfaManualKey ? (
          <p className="hm-auth__manual">
            {t('auth.mfaManual')} <code className="select-all">{mfaManualKey}</code>
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <OtpInput value={code} onChange={setCode} autoFocus />
          {error ? (
            <p role="alert" className="hm-auth__error">
              {error}{' '}
              {expired ? (
                <Link to="/login" onClick={() => clearMfaFlow()} className="underline">
                  {t('auth.mfaBackLogin')}
                </Link>
              ) : null}
            </p>
          ) : null}
          <DsButton type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting || code.length < 6}>
            {submitting ? t('auth.mfaVerifying') : t('auth.mfaEnable')}
          </DsButton>
        </form>
      </div>
    </AuthChrome>
  )
}
