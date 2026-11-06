import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertError, Button, Input, TextArea } from '@/components/ui/form'
import {
  createMember,
  getDisplayMessage,
  getMember,
  updateMember,
  type CreateMemberRequest,
} from '@/lib/api'
import { tLabel } from '@/lib/i18n/bilingual'
import { useUiStore } from '@/stores/ui-store'

type FormState = {
  fullName: string
  fullNameAr: string
  phone: string
  dateOfBirth: string
  email: string
  nationalId: string
  emergencyContact: string
  notes: string
}

const empty: FormState = {
  fullName: '',
  fullNameAr: '',
  phone: '',
  dateOfBirth: '',
  email: '',
  nationalId: '',
  emergencyContact: '',
  notes: '',
}

export function MemberFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = useUiStore((s) => s.locale)
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(empty)
  const [error, setError] = useState<string | null>(null)

  const existing = useQuery({
    queryKey: ['member', id],
    queryFn: () => getMember(id!),
    enabled: mode === 'edit' && Boolean(id),
  })

  useEffect(() => {
    if (!existing.data) return
    const m = existing.data
    setForm({
      fullName: m.fullName ?? '',
      fullNameAr: m.fullNameAr ?? '',
      phone: m.phone ?? '',
      dateOfBirth: (m.dateOfBirth ?? '').slice(0, 10),
      email: m.email ?? '',
      nationalId: '',
      emergencyContact: '',
      notes: m.notes ?? '',
    })
  }, [existing.data])

  const createMut = useMutation({
    mutationFn: (body: CreateMemberRequest) => createMember(body),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['members'] })
      navigate(`/app/members/${created.id}`, { replace: true })
    },
  })

  const updateMut = useMutation({
    mutationFn: (body: CreateMemberRequest) => updateMember(id!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] })
      void qc.invalidateQueries({ queryKey: ['member', id] })
      navigate(`/app/members/${id}`, { replace: true })
    },
  })

  const loading = createMut.isPending || updateMut.isPending

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.fullName.trim() || !form.fullNameAr.trim() || !form.phone.trim() || !form.dateOfBirth) {
      setError(
        tLabel(
          'Full name (EN/AR), phone, and date of birth are required.',
          'الاسم (إنجليزي/عربي) والهاتف وتاريخ الميلاد مطلوبة.',
          locale,
        ),
      )
      return
    }

    const body: CreateMemberRequest = {
      fullName: form.fullName.trim(),
      fullNameAr: form.fullNameAr.trim(),
      phone: form.phone.trim(),
      dateOfBirth: form.dateOfBirth,
      email: form.email.trim() || null,
      nationalId: form.nationalId.trim() || null,
      emergencyContact: form.emergencyContact.trim() || null,
      notes: form.notes.trim() || null,
    }

    try {
      if (mode === 'create') await createMut.mutateAsync(body)
      else await updateMut.mutateAsync(body)
    } catch (err) {
      setError(getDisplayMessage(err, locale))
    }
  }

  if (mode === 'edit' && existing.isLoading) {
    return <p className="text-sm text-[var(--ltt)]">{tLabel('Loading…', 'جارٍ التحميل…', locale)}</p>
  }

  if (mode === 'edit' && existing.isError) {
    return <AlertError>{getDisplayMessage(existing.error, locale)}</AlertError>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link to={mode === 'edit' && id ? `/app/members/${id}` : '/app/members'} className="text-sm text-[var(--l600)]">
          ← {tLabel('Back', 'رجوع', locale)}
        </Link>
        <h1 className="mt-3 font-[family-name:var(--fd)] text-2xl font-bold text-[var(--ltp)]">
          {mode === 'create'
            ? tLabel('Add member', 'إضافة عضو', locale)
            : tLabel('Edit member', 'تعديل عضو', locale)}
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-[var(--rmd)] border border-[var(--lbd)] bg-white p-6"
      >
        <AlertError>{error}</AlertError>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
          <Input
            name="fullName"
            label={tLabel('Full name (EN)', 'الاسم بالكامل (إنجليزي)', locale)}
            required
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
          />
          <Input
            name="fullNameAr"
            label={tLabel('Full name (AR)', 'الاسم بالكامل (عربي)', locale)}
            required
            value={form.fullNameAr}
            onChange={(e) => setField('fullNameAr', e.target.value)}
          />
        </div>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
          <Input
            name="phone"
            label={tLabel('Phone', 'الهاتف', locale)}
            required
            dir="ltr"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
          />
          <Input
            name="dateOfBirth"
            type="date"
            label={tLabel('Date of birth', 'تاريخ الميلاد', locale)}
            required
            value={form.dateOfBirth}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
          />
        </div>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
          <Input
            name="email"
            type="email"
            label={tLabel('Email', 'البريد', locale)}
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
          />
          <Input
            name="nationalId"
            label={tLabel('National ID', 'الرقم القومي', locale)}
            value={form.nationalId}
            onChange={(e) => setField('nationalId', e.target.value)}
          />
        </div>
        <Input
          name="emergencyContact"
          label={tLabel('Emergency contact', 'جهة اتصال للطوارئ', locale)}
          value={form.emergencyContact}
          onChange={(e) => setField('emergencyContact', e.target.value)}
        />
        <TextArea
          name="notes"
          label={tLabel('Notes', 'ملاحظات', locale)}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full sm:w-auto sm:min-w-[160px]">
          {mode === 'create'
            ? tLabel('Create member', 'إنشاء العضو', locale)
            : tLabel('Save changes', 'حفظ التعديلات', locale)}
        </Button>
      </form>
    </div>
  )
}
