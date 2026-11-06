import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { provisionTenant, fetchCommercialPlans } from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { cairoDatePlusDays, formatCairoDate, formatEgp } from '@/lib/format'
import { PLATFORM_TRIAL_DAYS, planDisplayLabel } from '@/lib/platform-plans'
import { useUiStore } from '@/stores/ui-store'
import {
  emptyProvisionForm,
  validateProvisionForm,
  type ProvisionFormValues,
} from './provision-form'

interface ProvisionGymDialogProps {
  open: boolean
  onClose: () => void
}

type WizardStep = 'business' | 'owner' | 'plan' | 'trial' | 'review' | 'created'

const STEPS: { id: Exclude<WizardStep, 'created'>; label: string }[] = [
  { id: 'business', label: 'Business' },
  { id: 'owner', label: 'Owner' },
  { id: 'plan', label: 'Plan' },
  { id: 'trial', label: 'Trial' },
  { id: 'review', label: 'Review' },
]

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  )
}

const inputClass = 'cp-input'

function formatCap(value: number | null | undefined): string {
  return value == null ? '∞' : value.toLocaleString('en-US')
}

function stepIndex(step: WizardStep): number {
  if (step === 'created') return STEPS.length
  return STEPS.findIndex((s) => s.id === step)
}

export function ProvisionGymDialog({ open, onClose }: ProvisionGymDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useUiStore((s) => s.showToast)

  const [step, setStep] = useState<WizardStep>('business')
  const [values, setValues] = useState<ProvisionFormValues>(emptyProvisionForm)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProvisionFormValues, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    tenantId: string
    gymCode: string
    trialStarted: boolean
    trialError?: string | null
  } | null>(null)

  const plansQuery = useQuery({
    queryKey: ['commercial-plans'],
    queryFn: fetchCommercialPlans,
    enabled: open,
  })

  const salesPlans = useMemo(
    () => (plansQuery.data ?? []).filter((p) => p.isActiveForSales),
    [plansQuery.data],
  )

  useEffect(() => {
    if (!open || !plansQuery.data?.length) return
    setValues((v) => {
      if (v.tier) return v
      const defaultTier =
        plansQuery.data!.find((p) => p.isDefault)?.tier ?? plansQuery.data!.find((p) => p.isActiveForSales)?.tier
      return defaultTier ? { ...v, tier: defaultTier } : v
    })
  }, [open, plansQuery.data])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setValues(emptyProvisionForm())
      setFieldErrors({})
      setSubmitError(null)
      setCreated(null)
      setStep('business')
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: provisionTenant,
    onSuccess: async (data) => {
      if (!data.trialStarted) {
        showToast(
          `Gym ${data.gymCode} created, but trial did not start${data.trialError ? `: ${data.trialError}` : ''}`,
          'error',
          8000,
        )
      } else {
        showToast(`Gym ${data.gymCode} provisioned`, 'success')
      }
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setCreated({
        tenantId: data.tenantId,
        gymCode: data.gymCode,
        trialStarted: data.trialStarted,
        trialError: data.trialError,
      })
      setStep('created')
    },
    onError: (err) => {
      setSubmitError(
        err instanceof ApiClientError
          ? err.status === 403
            ? 'Forbidden — Requires Platform Ops (403).'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Provisioning failed',
      )
    },
  })

  function patch(key: keyof ProvisionFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function validateStep(target: Exclude<WizardStep, 'created' | 'review' | 'trial' | 'plan'> | 'business' | 'owner'): boolean {
    const result = validateProvisionForm(values)
    if (result.ok) {
      setFieldErrors({})
      return true
    }
    const keys: (keyof ProvisionFormValues)[] =
      target === 'business'
        ? ['name', 'city', 'phoneNumber', 'email', 'gymCode']
        : ['ownerFullName', 'ownerEmail', 'ownerPassword']
    const stepErrors: Partial<Record<keyof ProvisionFormValues, string>> = {}
    for (const k of keys) {
      if (result.errors[k]) stepErrors[k] = result.errors[k]
    }
    // Business step also requires core fields even if owner fails later
    if (target === 'business') {
      for (const k of ['name', 'city', 'phoneNumber', 'email'] as const) {
        if (result.errors[k]) stepErrors[k] = result.errors[k]
      }
    }
    setFieldErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  function goNext() {
    setSubmitError(null)
    if (step === 'business') {
      if (!validateStep('business')) return
      setStep('owner')
      return
    }
    if (step === 'owner') {
      if (!validateStep('owner')) return
      setStep('plan')
      return
    }
    if (step === 'plan') {
      if (!values.tier) {
        setFieldErrors({ tier: 'Choose a plan.' })
        return
      }
      setFieldErrors({})
      setStep('trial')
      return
    }
    if (step === 'trial') {
      setStep('review')
      return
    }
  }

  function goBack() {
    setSubmitError(null)
    if (step === 'owner') setStep('business')
    else if (step === 'plan') setStep('owner')
    else if (step === 'trial') setStep('plan')
    else if (step === 'review') setStep('trial')
  }

  function handleCreate() {
    setSubmitError(null)
    const result = validateProvisionForm(values)
    if (!result.ok) {
      setFieldErrors(result.errors)
      setStep('business')
      return
    }
    setFieldErrors({})
    mutation.mutate(result.body)
  }

  const busy = mutation.isPending
  const idx = stepIndex(step)
  const selectedPlan = salesPlans.find((p) => p.tier === values.tier)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="w-[min(100%,42rem)] rounded-[var(--radius-lg)] border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/40 open:flex open:flex-col"
      onCancel={(e) => {
        if (busy) {
          e.preventDefault()
          return
        }
        onClose()
      }}
      onClick={(e) => {
        if (busy) return
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="flex max-h-[90vh] flex-col gap-3 overflow-y-auto p-5" aria-busy={busy}>
        <div>
          <h2 id={titleId} className="text-lg font-bold text-gray-900">
            {step === 'created' ? 'Cloud gym created' : 'Create Cloud gym'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {step === 'created'
              ? 'Provisioning finished. Review the outcome below.'
              : 'Creates a Cloud gym, Owner account with an initial password, and starts the platform trial.'}
          </p>
        </div>

        {step !== 'created' ? (
          <div className="wiz-steps" aria-label="Provisioning steps">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`wiz-step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}`}
              >
                {s.label}
              </div>
            ))}
          </div>
        ) : null}

        {step === 'business' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gym name *" error={fieldErrors.name}>
              <input
                className={inputClass}
                value={values.name}
                disabled={busy}
                onChange={(e) => patch('name', e.target.value)}
                autoComplete="organization"
              />
            </Field>
            <Field label="Gym code" error={fieldErrors.gymCode} hint="Leave blank to auto-generate.">
              <input
                className={inputClass}
                value={values.gymCode}
                disabled={busy}
                onChange={(e) => patch('gymCode', e.target.value)}
                placeholder="Auto if blank"
              />
            </Field>
            <Field label="City *" error={fieldErrors.city}>
              <input
                className={inputClass}
                value={values.city}
                disabled={busy}
                onChange={(e) => patch('city', e.target.value)}
              />
            </Field>
            <Field label="Phone *" error={fieldErrors.phoneNumber}>
              <input
                className={inputClass}
                value={values.phoneNumber}
                disabled={busy}
                onChange={(e) => patch('phoneNumber', e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field label="Email *" error={fieldErrors.email}>
              <input
                type="email"
                className={inputClass}
                value={values.email}
                disabled={busy}
                onChange={(e) => patch('email', e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Name (Arabic)" error={fieldErrors.nameAr}>
              <input
                className={inputClass}
                value={values.nameAr}
                disabled={busy}
                onChange={(e) => patch('nameAr', e.target.value)}
                dir="rtl"
              />
            </Field>
            <Field label="Address" error={fieldErrors.address}>
              <input
                className={inputClass}
                value={values.address}
                disabled={busy}
                onChange={(e) => patch('address', e.target.value)}
              />
            </Field>
            <Field label="Time zone" error={fieldErrors.timeZone} hint="Optional. Defaults on the server.">
              <input
                className={inputClass}
                value={values.timeZone}
                disabled={busy}
                onChange={(e) => patch('timeZone', e.target.value)}
                placeholder="Africa/Cairo"
              />
            </Field>
          </div>
        ) : null}

        {step === 'owner' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius)] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Owner account is provisioned with an initial password. The Owner signs in with that
              password after creation.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Owner full name *" error={fieldErrors.ownerFullName}>
                <input
                  className={inputClass}
                  value={values.ownerFullName}
                  disabled={busy}
                  onChange={(e) => patch('ownerFullName', e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Owner email *" error={fieldErrors.ownerEmail}>
                <input
                  type="email"
                  className={inputClass}
                  value={values.ownerEmail}
                  disabled={busy}
                  onChange={(e) => patch('ownerEmail', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Initial password * (min 8)" error={fieldErrors.ownerPassword}>
                <input
                  type="password"
                  className={inputClass}
                  value={values.ownerPassword}
                  disabled={busy}
                  onChange={(e) => patch('ownerPassword', e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <div className="rounded-[var(--radius)] border border-dashed border-amber-300 bg-amber-50/80 px-3 py-3 text-sm">
              <div className="font-semibold text-amber-900">Owner Invitation — Coming Later</div>
              <p className="mt-1 text-amber-800">
                Invite tokens / email accept flow are not implemented. Do not expect a Send
                Invitation action after create.
              </p>
            </div>
          </div>
        ) : null}

        {step === 'plan' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">
              Select a plan tier. Prices are loaded from the live commercial plan configuration.
            </p>
            {plansQuery.isLoading ? (
              <p className="text-sm text-gray-500">Loading plans…</p>
            ) : plansQuery.isError ? (
              <p className="text-sm text-red-600">Failed to load plans. Close and retry.</p>
            ) : salesPlans.length === 0 ? (
              <p className="text-sm text-amber-800">No plans are currently active for new sales.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {salesPlans.map((p) => {
                  const selected = values.tier === p.tier
                  return (
                    <button
                      key={p.tier}
                      type="button"
                      disabled={busy}
                      onClick={() => patch('tier', p.tier)}
                      className={`rounded-[var(--radius-lg)] border p-3 text-left transition ${
                        selected
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-gray-900">{p.displayName}</div>
                      <div className="mt-1 font-[var(--mono)] text-sm tabular-nums text-gray-700">
                        {formatEgp(p.monthlyPriceEgp)}
                        <span className="text-xs font-normal text-gray-400"> / mo list</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Annual {formatEgp(p.annualPriceEgp)} · {formatCap(p.membersCap)} members
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {fieldErrors.tier ? <p className="text-xs text-red-600">{fieldErrors.tier}</p> : null}
          </div>
        ) : null}

        {step === 'trial' ? (
          <div className="flex flex-col gap-3">
            <Field
              label="Trial duration (days)"
              error={fieldErrors.trialDays}
              hint={`Default: ${PLATFORM_TRIAL_DAYS} days (platform config). Allowed: 1–90.`}
            >
              <input
                type="number"
                min={1}
                max={90}
                className={inputClass}
                value={values.trialDays}
                disabled={busy}
                onChange={(e) => patch('trialDays', e.target.value)}
              />
            </Field>
            <div className="cp-card p-4 text-sm">
              <p className="text-gray-600">
                Trial ends approximately:{' '}
                <strong className="text-gray-900">
                  {formatCairoDate(cairoDatePlusDays(Number(values.trialDays) || PLATFORM_TRIAL_DAYS))}
                </strong>
              </p>
              <p className="mt-2 text-gray-500">
                At trial end, a saved payment method can automatically convert the subscription to{' '}
                <strong>Active</strong>. Without a payment method, the subscription becomes{' '}
                <strong>Cancelled</strong>.
              </p>
            </div>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="cp-card divide-y divide-gray-100">
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <div className="font-semibold text-gray-500">Business</div>
                <div>
                  <div className="font-semibold text-gray-900">{values.name.trim()}</div>
                  <div className="text-gray-500">
                    {values.city.trim()} · {values.phoneNumber.trim()} · {values.email.trim()}
                  </div>
                  <div className="font-[var(--mono)] text-xs text-gray-400">
                    Code: {values.gymCode.trim() || '(auto)'}
                  </div>
                </div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <div className="font-semibold text-gray-500">Owner</div>
                <div>
                  <div className="font-semibold text-gray-900">{values.ownerFullName.trim()}</div>
                  <div className="text-gray-500">{values.ownerEmail.trim()}</div>
                  <div className="mt-1 text-xs text-blue-800">
                    Provisioned with the initial password you entered (not emailed).
                  </div>
                </div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <div className="font-semibold text-gray-500">Plan</div>
                <div className="capitalize">
                  {planDisplayLabel(values.tier, salesPlans)}
                  {selectedPlan ? (
                    <span className="text-gray-500"> · list {formatEgp(selectedPlan.monthlyPriceEgp)}/mo</span>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <div className="font-semibold text-gray-500">Trial</div>
                <div>
                  {values.trialDays || PLATFORM_TRIAL_DAYS}-day trial · ends approx.{' '}
                  {formatCairoDate(cairoDatePlusDays(Number(values.trialDays) || PLATFORM_TRIAL_DAYS))}
                </div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                <div className="font-semibold text-gray-500">Price (frozen at provision)</div>
                <div>
                  {selectedPlan ? formatEgp(selectedPlan.monthlyPriceEgp) : '—'}
                  <span className="text-gray-500"> / mo list price</span>
                </div>
              </div>
            </div>
            <p className="text-gray-500">
              Confirming calls the existing provision API. Owner invitation is not sent.
            </p>
          </div>
        ) : null}

        {step === 'created' && created ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-900">
              <div className="font-bold">Cloud gym created</div>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-emerald-700/80">Gym code</dt>
                  <dd className="font-[var(--mono)] font-semibold">{created.gymCode}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80">Owner</dt>
                  <dd>
                    {values.ownerFullName.trim()} ({values.ownerEmail.trim()})
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80">Plan</dt>
                  <dd className="capitalize">{planDisplayLabel(values.tier, salesPlans)}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80">Trial</dt>
                  <dd>
                    {created.trialStarted
                      ? `Trial started — ${values.trialDays.trim() || String(PLATFORM_TRIAL_DAYS)} days (see Cloud gym 360 for exact end).`
                      : `Did not start${created.trialError ? `: ${created.trialError}` : ''}`}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Owner invitation is not currently implemented. Share the initial password out of band.
            </div>
          </div>
        ) : null}

        {submitError ? (
          <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap justify-between gap-2">
          <div>
            {step !== 'business' && step !== 'created' ? (
              <button type="button" disabled={busy} onClick={goBack} className="cp-btn cp-btn-ghost">
                Back
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {step === 'created' && created ? (
              <>
                <button type="button" className="cp-btn cp-btn-secondary" onClick={onClose}>
                  Close
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  onClick={() => {
                    onClose()
                    navigate(`/oc/gyms/cloud/${created.tenantId}`)
                  }}
                >
                  Open Cloud gym
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={onClose} className="cp-btn cp-btn-secondary">
                  Cancel
                </button>
                {step === 'review' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreate}
                    className="cp-btn cp-btn-primary"
                  >
                    {busy ? 'Creating…' : 'Create Cloud gym'}
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={goNext} className="cp-btn cp-btn-primary">
                    Continue
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}
