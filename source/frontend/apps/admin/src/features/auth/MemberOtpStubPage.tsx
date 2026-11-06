import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertError, Button, Input } from '@/components/ui/form'
import { getDisplayMessage, getStoredGymCode, sendMemberOtp, verifyMemberOtp } from '@/lib/api'

/**
 * Member OTP stubs — wired to §1 endpoints for later member-app UI.
 * Staff dashboard uses email/password login.
 */
export function MemberOtpStubPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [gymCode, setGymCode] = useState(getStoredGymCode())
  const [phoneNumber, setPhoneNumber] = useState('+20')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function requestOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await sendMemberOtp({ phoneNumber: phoneNumber.trim(), gymCode: gymCode.trim() })
      setMessage(res.message ?? 'OTP sent (5 minute window).')
      setStep('otp')
    } catch (err) {
      setError(getDisplayMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const session = await verifyMemberOtp({
        phoneNumber: phoneNumber.trim(),
        gymCode: gymCode.trim(),
        otp: otp.trim(),
      })
      setMessage(`Member session OK — ${session.user.fullName}. JWT stored (use sub as member id).`)
    } catch (err) {
      setError(getDisplayMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link to="/login" className="mb-6 text-sm font-medium text-[var(--t500)]">
        ← Staff login
      </Link>
      <h1 className="mb-1 font-[family-name:var(--fd)] text-2xl font-bold">Member OTP (stub)</h1>
      <p className="mb-8 text-sm text-[var(--ltt)]" dir="rtl">
        تدفق OTP للعضو · wired to /api/auth/member-otp + member-verify
      </p>

      <AlertError>{error}</AlertError>
      {message ? (
        <div className="mb-5 rounded-[var(--rmd)] border border-[rgba(59,130,246,0.25)] bg-[var(--inf100)] px-4 py-3 text-xs text-[var(--inftxt)]">
          {message}
        </div>
      ) : null}

      {step === 'phone' ? (
        <form onSubmit={requestOtp}>
          <Input label="Gym code" value={gymCode} onChange={(e) => setGymCode(e.target.value)} required />
          <Input
            label="Phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+201234567890"
            required
          />
          <Button type="submit" loading={loading}>
            Send OTP · إرسال الرمز
          </Button>
        </form>
      ) : (
        <form onSubmit={confirmOtp}>
          <Input
            label="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            required
          />
          <Button type="submit" loading={loading}>
            Verify · تأكيد
          </Button>
          <button
            type="button"
            className="mt-4 w-full text-sm text-[var(--t500)]"
            onClick={() => setStep('phone')}
          >
            Change phone
          </button>
        </form>
      )}
    </div>
  )
}
