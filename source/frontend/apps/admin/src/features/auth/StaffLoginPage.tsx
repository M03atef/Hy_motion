import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertError, Button, Input } from '@/components/ui/form'
import { getDisplayMessage, getStoredGymCode, probeAuthenticatedSession, staffLogin } from '@/lib/api'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'

export function StaffLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gymCode, setGymCode] = useState(getStoredGymCode())
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await staffLogin({
        email: email.trim(),
        password,
        gymCode: gymCode.trim(),
      })
      // New session → re-probe feature flags once in the shell.
      useFeatureFlagsStore.getState().reset()
      // Acceptance: login token succeeds against a permissioned endpoint.
      await probeAuthenticatedSession()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(getDisplayMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden max-[900px]:flex-col">
      <aside className="relative flex w-[40%] flex-col items-center justify-center overflow-hidden bg-[var(--c900)] px-10 py-12 text-[var(--dtp)] max-[900px]:w-full max-[900px]:px-6 max-[900px]:py-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(160,224,64,.03) 60px,rgba(160,224,64,.03) 61px), repeating-linear-gradient(-45deg,transparent,transparent 60px,rgba(160,224,64,.03) 60px,rgba(160,224,64,.03) 61px)',
          }}
        />
        <div className="relative z-10 w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-3">
            <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12 shrink-0" aria-hidden>
              <rect width="48" height="48" rx="12" fill="#7ACC00" />
              <path
                d="M15 33L24 14L33 33"
                stroke="#0D0D0D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M18 28H30" stroke="#0D0D0D" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-[family-name:var(--fd)] text-[28px] font-bold tracking-tight text-[var(--l400)]">
              HyMotion
            </span>
          </div>
          <h2 className="mb-2 font-[family-name:var(--fd)] text-[22px] font-semibold leading-snug">
            Manage your gym
            <br />
            with clarity
          </h2>
          <p className="mb-10 text-[15px] text-[var(--c400)]">
            منصة تشغيل صالات الجيم / The operations platform for fitness businesses.
          </p>
          <ul className="flex flex-col gap-5 text-sm text-[var(--c400)]">
            <li>JWT session with silent refresh (Token-Expired)</li>
            <li>Role + permission claims gate every screen</li>
            <li>Arabic-first bilingual staff UI</li>
          </ul>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[var(--l500)] to-[var(--t500)]" />
      </aside>

      <main className="flex w-[60%] items-center justify-center bg-[var(--ls1)] px-16 py-12 max-[900px]:w-full max-[900px]:px-6">
        <div className="w-full max-w-[440px]">
          <h1 className="mb-1 font-[family-name:var(--fd)] text-[28px] font-bold">Welcome back</h1>
          <p className="mb-8 text-[15px] text-[var(--ltt)]">Staff sign-in · تسجيل دخول الموظفين</p>

          <AlertError>{error}</AlertError>

          <form onSubmit={onSubmit} noValidate>
            <Input
              label="Gym code"
              name="gymCode"
              value={gymCode}
              onChange={(e) => setGymCode(e.target.value)}
              placeholder="GYM-CAIRO-01"
              autoComplete="organization"
              required
              hint="Provided by your gym admin · كود الصالة"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gym.com"
              autoComplete="username"
              required
            />
            <Input
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="-mt-3 mb-5 text-left text-[13px] font-medium text-[var(--t500)] hover:text-[var(--t400)]"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>

            <Button type="submit" loading={loading} className="w-full">
              Sign in · دخول
            </Button>
          </form>

          <p className="mt-8 text-center text-[13px] text-[var(--ltt)]">
            Member OTP stubs:{' '}
            <a className="font-medium text-[var(--t500)] hover:text-[var(--t400)]" href="/member-otp">
              /member-otp
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
