import type { ProvisionTenantRequest } from '@/lib/api/types'

export const PROVISION_TIERS = ['starter', 'growth', 'pro', 'enterprise'] as const

export interface ProvisionFormValues {
  name: string
  nameAr: string
  city: string
  address: string
  phoneNumber: string
  email: string
  gymCode: string
  timeZone: string
  ownerFullName: string
  ownerEmail: string
  ownerPassword: string
  tier: string
  trialDays: string
}

export function emptyProvisionForm(): ProvisionFormValues {
  return {
    name: '',
    nameAr: '',
    city: '',
    address: '',
    phoneNumber: '',
    email: '',
    gymCode: '',
    timeZone: '',
    ownerFullName: '',
    ownerEmail: '',
    ownerPassword: '',
    tier: '',
    trialDays: '14',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ProvisionFormErrors = Partial<Record<keyof ProvisionFormValues, string>>

export type ProvisionValidationResult =
  | { ok: true; body: ProvisionTenantRequest }
  | { ok: false; errors: ProvisionFormErrors }

/** Client-side mirror of ProvisionTenantRequest attributes (required, email, password min 8). */
export function validateProvisionForm(values: ProvisionFormValues): ProvisionValidationResult {
  const errors: ProvisionFormErrors = {}
  const name = values.name.trim()
  const city = values.city.trim()
  const phoneNumber = values.phoneNumber.trim()
  const email = values.email.trim()
  const ownerFullName = values.ownerFullName.trim()
  const ownerEmail = values.ownerEmail.trim()
  const ownerPassword = values.ownerPassword
  const tier = (values.tier || 'growth').trim().toLowerCase()

  if (!name) errors.name = 'Gym name is required.'
  if (!city) errors.city = 'City is required.'
  if (!phoneNumber) errors.phoneNumber = 'Phone number is required.'
  if (!email) errors.email = 'Gym email is required.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid gym email.'
  if (!ownerFullName) errors.ownerFullName = 'Owner full name is required.'
  if (!ownerEmail) errors.ownerEmail = 'Owner email is required.'
  else if (!EMAIL_RE.test(ownerEmail)) errors.ownerEmail = 'Enter a valid owner email.'
  if (!ownerPassword) errors.ownerPassword = 'Owner password is required.'
  else if (ownerPassword.length < 8) errors.ownerPassword = 'Password must be at least 8 characters.'
  if (!PROVISION_TIERS.includes(tier as (typeof PROVISION_TIERS)[number])) {
    errors.tier = 'Choose a valid plan tier.'
  }

  const trialDaysRaw = values.trialDays.trim()
  const trialDaysNum = trialDaysRaw === '' ? 14 : Number(trialDaysRaw)
  if (!Number.isFinite(trialDaysNum) || trialDaysNum < 1 || trialDaysNum > 90) {
    errors.trialDays = 'Trial duration must be between 1 and 90 days.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const body: ProvisionTenantRequest = {
    name,
    city,
    phoneNumber,
    email,
    ownerFullName,
    ownerEmail,
    ownerPassword,
    tier,
    trialDays: trialDaysNum,
  }

  const nameAr = values.nameAr.trim()
  if (nameAr) body.nameAr = nameAr
  const address = values.address.trim()
  if (address) body.address = address
  const gymCode = values.gymCode.trim()
  if (gymCode) body.gymCode = gymCode
  const timeZone = values.timeZone.trim()
  if (timeZone) body.timeZone = timeZone

  return { ok: true, body }
}
