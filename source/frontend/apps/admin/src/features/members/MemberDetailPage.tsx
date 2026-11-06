import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertError,
  AlertSuccess,
  Button,
  Input,
  TextArea,
} from '@/components/ui/form'
import {
  deactivateMember,
  freezeMembership,
  getDisplayMessage,
  getMember,
  unfreezeMembership,
} from '@/lib/api'
import { displayBilingualText, tLabel } from '@/lib/i18n/bilingual'
import { useCan, useCanRole } from '@/hooks/useCan'
import { useUiStore } from '@/stores/ui-store'
import {
  formatDateOnly,
  formatDateTimeUtc,
  formatMoney,
  memberDisplayName,
  membershipStatusLabel,
} from './member-format'

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = useUiStore((s) => s.locale)
  const qc = useQueryClient()
  const canEdit = useCan('members.edit')
  const canFreeze = useCan('memberships.freeze')
  const isOwner = useCanRole('OwnerOnly')

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)
  const [showFreeze, setShowFreeze] = useState(false)
  const [frozenUntil, setFrozenUntil] = useState('')
  const [freezeReason, setFreezeReason] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const memberQuery = useQuery({
    queryKey: ['member', id],
    queryFn: () => getMember(id!),
    enabled: Boolean(id),
  })

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['member', id] }),
      qc.invalidateQueries({ queryKey: ['members'] }),
    ])
  }

  const freezeMut = useMutation({
    mutationFn: () =>
      freezeMembership(id!, {
        frozenUntil: new Date(`${frozenUntil}T23:59:59`).toISOString(),
        reason: freezeReason.trim() || null,
      }),
    onSuccess: async (res) => {
      setShowFreeze(false)
      setFrozenUntil('')
      setFreezeReason('')
      setActionOk(displayBilingualText(res.message, locale) || tLabel('Frozen.', 'تم التجميد.', locale))
      await invalidate()
    },
  })

  const unfreezeMut = useMutation({
    mutationFn: () => unfreezeMembership(id!),
    onSuccess: async (res) => {
      setActionOk(
        displayBilingualText(res.message, locale) || tLabel('Unfrozen.', 'تم إلغاء التجميد.', locale),
      )
      await invalidate()
    },
  })

  const deactivateMut = useMutation({
    mutationFn: () => deactivateMember(id!),
    onSuccess: async (res) => {
      setConfirmDeactivate(false)
      setActionOk(
        displayBilingualText(res.message, locale) ||
          tLabel('Member deactivated.', 'تم إلغاء تفعيل العضو.', locale),
      )
      await invalidate()
    },
  })

  const member = memberQuery.data
  const membership = member?.currentMembership ?? null

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null)
    setActionOk(null)
    try {
      await fn()
    } catch (err) {
      setActionError(getDisplayMessage(err, locale))
    }
  }

  if (memberQuery.isLoading) {
    return <p className="text-sm text-[var(--ltt)]">{tLabel('Loading…', 'جارٍ التحميل…', locale)}</p>
  }

  if (memberQuery.isError || !member) {
    return (
      <div>
        <AlertError>{getDisplayMessage(memberQuery.error, locale)}</AlertError>
        <Button variant="secondary" onClick={() => navigate('/app/members')}>
          {tLabel('Back to list', 'العودة للقائمة', locale)}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/members" className="text-sm text-[var(--l600)]">
            ← {tLabel('Members', 'الأعضاء', locale)}
          </Link>
          <h1 className="mt-2 font-[family-name:var(--fd)] text-2xl font-bold text-[var(--ltp)]">
            {memberDisplayName(member.fullName, member.fullNameAr, locale)}
          </h1>
          <p className="mt-1 text-sm text-[var(--ltt)]">
            {member.memberNumber}
            {!member.isActive
              ? ` · ${tLabel('Deactivated', 'ملغى التفعيل', locale)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link to={`/app/members/${member.id}/edit`}>
              <Button variant="secondary">{tLabel('Edit', 'تعديل', locale)}</Button>
            </Link>
          ) : null}
          {canFreeze && membership?.status === 'active' ? (
            <Button variant="secondary" onClick={() => setShowFreeze(true)}>
              {tLabel('Freeze', 'تجميد', locale)}
            </Button>
          ) : null}
          {canFreeze && membership?.status === 'frozen' ? (
            <Button
              variant="secondary"
              loading={unfreezeMut.isPending}
              onClick={() => void runAction(() => unfreezeMut.mutateAsync())}
            >
              {tLabel('Unfreeze', 'إلغاء التجميد', locale)}
            </Button>
          ) : null}
          {isOwner && member.isActive ? (
            <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>
              {tLabel('Deactivate', 'إلغاء التفعيل', locale)}
            </Button>
          ) : null}
        </div>
      </div>

      <AlertError>{actionError}</AlertError>
      <AlertSuccess>{actionOk}</AlertSuccess>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--rmd)] border border-[var(--lbd)] bg-white p-5">
          <h2 className="mb-4 font-[family-name:var(--fd)] text-lg font-semibold">
            {tLabel('Profile', 'الملف', locale)}
          </h2>
          <dl className="grid gap-3 text-sm">
            <Row label={tLabel('Phone', 'الهاتف', locale)} value={member.phone} ltr />
            <Row label={tLabel('Email', 'البريد', locale)} value={member.email || '—'} />
            <Row
              label={tLabel('Date of birth', 'تاريخ الميلاد', locale)}
              value={formatDateOnly(member.dateOfBirth, locale)}
            />
            <Row
              label={tLabel('Invitation quota', 'حصة الدعوات', locale)}
              value={String(member.invitationQuotaRemaining)}
            />
            <Row
              label={tLabel('Joined', 'الانضمام', locale)}
              value={formatDateTimeUtc(member.createdAtUtc, locale)}
            />
            {member.notes ? (
              <Row label={tLabel('Notes', 'ملاحظات', locale)} value={member.notes} />
            ) : null}
          </dl>
        </section>

        <section className="rounded-[var(--rmd)] border border-[var(--lbd)] bg-white p-5">
          <h2 className="mb-4 font-[family-name:var(--fd)] text-lg font-semibold">
            {tLabel('Current membership', 'العضوية الحالية', locale)}
          </h2>
          {membership == null ? (
            <p className="text-sm text-[var(--ltt)]">
              {tLabel(
                'No current membership — this is a valid state.',
                'لا توجد عضوية حالية — وهذه حالة صحيحة.',
                locale,
              )}
            </p>
          ) : (
            <dl className="grid gap-3 text-sm">
              <Row
                label={tLabel('Plan', 'الباقة', locale)}
                value={tLabel(membership.planName, membership.planNameAr, locale)}
              />
              <Row
                label={tLabel('Status', 'الحالة', locale)}
                value={membershipStatusLabel(membership.status, locale)}
              />
              <Row
                label={tLabel('Period', 'الفترة', locale)}
                value={`${formatDateOnly(membership.startDate, locale)} → ${formatDateOnly(membership.endDate, locale)}`}
              />
              {membership.sessionsRemaining != null ? (
                <Row
                  label={tLabel('Sessions left', 'جلسات متبقية', locale)}
                  value={String(membership.sessionsRemaining)}
                />
              ) : null}
              {membership.status === 'frozen' ? (
                <Row
                  label={tLabel('Frozen until', 'مجمّدة حتى', locale)}
                  value={formatDateOnly(membership.frozenUntilDate, locale)}
                />
              ) : null}
              <Row
                label={tLabel('Amount paid', 'المبلغ المدفوع', locale)}
                value={formatMoney(membership.amountPaid, locale)}
              />
              <Row
                label={tLabel('Payment method', 'طريقة الدفع', locale)}
                value={membership.paymentMethod}
              />
            </dl>
          )}
        </section>

        <section className="rounded-[var(--rmd)] border border-[var(--lbd)] bg-white p-5">
          <h2 className="mb-4 font-[family-name:var(--fd)] text-lg font-semibold">
            {tLabel('Recent attendance', 'آخر الحضور', locale)}
          </h2>
          {member.recentAttendance.length === 0 ? (
            <p className="text-sm text-[var(--ltt)]">
              {tLabel('No recent check-ins.', 'لا يوجد حضور حديث.', locale)}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {member.recentAttendance.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-t border-[var(--lbd)] pt-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{formatDateTimeUtc(a.checkInAtUtc, locale)}</div>
                    <div className="text-xs text-[var(--ltt)]">{a.entryMethod}</div>
                  </div>
                  <div className="text-xs text-[var(--ltt)]">
                    {a.checkOutAtUtc
                      ? formatDateTimeUtc(a.checkOutAtUtc, locale)
                      : tLabel('Open', 'مفتوح', locale)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showFreeze ? (
        <Modal
          title={tLabel('Freeze membership', 'تجميد العضوية', locale)}
          onClose={() => setShowFreeze(false)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (!frozenUntil) {
                setActionError(
                  tLabel('Choose a freeze-until date.', 'اختر تاريخ انتهاء التجميد.', locale),
                )
                return
              }
              void runAction(() => freezeMut.mutateAsync())
            }}
          >
            <Input
              name="frozenUntil"
              type="date"
              required
              label={tLabel('Frozen until', 'مجمّدة حتى', locale)}
              value={frozenUntil}
              onChange={(e) => setFrozenUntil(e.target.value)}
            />
            <TextArea
              name="reason"
              label={tLabel('Reason (optional)', 'السبب (اختياري)', locale)}
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowFreeze(false)}>
                {tLabel('Cancel', 'إلغاء', locale)}
              </Button>
              <Button type="submit" loading={freezeMut.isPending}>
                {tLabel('Confirm freeze', 'تأكيد التجميد', locale)}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {confirmDeactivate ? (
        <Modal
          title={tLabel('Deactivate member?', 'إلغاء تفعيل العضو؟', locale)}
          onClose={() => setConfirmDeactivate(false)}
        >
          <p className="mb-5 text-sm text-[var(--lts)]">
            {tLabel(
              'Only Owners can deactivate. The member will be marked inactive (OwnerOnly policy — not a members.* permission).',
              'المالك فقط يمكنه الإلغاء. سيُعلَّم العضو كغير نشط (سياسة OwnerOnly — وليست صلاحية members.*).',
              locale,
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeactivate(false)}>
              {tLabel('Cancel', 'إلغاء', locale)}
            </Button>
            <Button
              variant="danger"
              loading={deactivateMut.isPending}
              onClick={() => void runAction(() => deactivateMut.mutateAsync())}
            >
              {tLabel('Deactivate', 'إلغاء التفعيل', locale)}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string
  value: string
  ltr?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--ls3)] pb-2 last:border-0">
      <dt className="shrink-0 text-[var(--ltt)]">{label}</dt>
      <dd className="text-end font-medium text-[var(--ltp)]" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-[var(--rmd)] border border-[var(--lbd)] bg-white p-5 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-[family-name:var(--fd)] text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--ltt)] hover:text-[var(--ltp)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
