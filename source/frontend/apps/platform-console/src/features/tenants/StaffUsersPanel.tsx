import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  changeTenantStaffRole,
  createTenantStaff,
  disableTenantStaff,
  fetchTenantStaff,
  reactivateTenantStaff,
  resetTenantStaffPassword,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { TENANT_STAFF_ROLES, type TenantStaffDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { isOpsOrAbove, MIN_REASON_LENGTH, validateReason } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

/** Sorted role-then-name so Owner/Manager surface before Trainer/Receptionist alphabetical noise. */
const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  manager: 1,
  trainer: 2,
  receptionist: 3,
}

export function sortStaffUsers<T extends { role?: string | null; fullName: string }>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const ra = ROLE_ORDER[(a.role ?? '').toLowerCase()] ?? 99
    const rb = ROLE_ORDER[(b.role ?? '').toLowerCase()] ?? 99
    if (ra !== rb) return ra - rb
    return a.fullName.localeCompare(b.fullName)
  })
}

export function staffStatusLabel(isActive: boolean): 'Active' | 'Disabled' {
  return isActive ? 'Active' : 'Disabled'
}

function isOwnerRole(role: string | null | undefined): boolean {
  return (role ?? '').toLowerCase() === 'owner'
}

type ModalKind = 'create' | 'disable' | 'reactivate' | 'role' | 'reset' | null

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return 'Forbidden — requires Platform Ops or above.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

function ReasonField({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  id: string
}) {
  return (
    <label className="mt-2 block text-sm" htmlFor={id}>
      <span className="text-gray-500">
        Reason <span className="text-red-600">(required, min {MIN_REASON_LENGTH} chars — audit log)</span>
      </span>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60"
        placeholder="Explain why this action is being taken…"
      />
    </label>
  )
}

interface StaffUsersPanelProps {
  tenantId: string
  tenantName: string
}

export function StaffUsersPanel({ tenantId, tenantName }: StaffUsersPanelProps) {
  const role = useAuthStore((s) => s.user?.role)
  const canManage = isOpsOrAbove(role)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tenant-staff', tenantId],
    queryFn: () => fetchTenantStaff(tenantId),
    enabled: Boolean(tenantId),
  })

  const [modal, setModal] = useState<ModalKind>(null)
  const [target, setTarget] = useState<TenantStaffDto | null>(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<string>(TENANT_STAFF_ROLES[0])
  const [roleValue, setRoleValue] = useState<string>(TENANT_STAFF_ROLES[0])

  function openModal(kind: ModalKind, row?: TenantStaffDto) {
    setModal(kind)
    setTarget(row ?? null)
    setReason('')
    setFormError(null)
    if (kind === 'create') {
      setNewFullName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole(TENANT_STAFF_ROLES[0])
    }
    if (kind === 'role' && row) {
      setRoleValue(TENANT_STAFF_ROLES.includes(row.role as (typeof TENANT_STAFF_ROLES)[number]) ? row.role : TENANT_STAFF_ROLES[0])
    }
    if (kind === 'reset') {
      setNewPassword('')
    }
  }

  function closeModal() {
    if (busy) return
    setModal(null)
    setTarget(null)
    setReason('')
    setFormError(null)
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-staff', tenantId] })

  const createMutation = useMutation({
    mutationFn: () => {
      if (newPassword.length < 10) {
        return Promise.reject(new Error('Password must be at least 10 characters.'))
      }
      return createTenantStaff(tenantId, {
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      })
    },
    onSuccess: async (staff) => {
      showToast(`${staff.fullName} added as ${staff.role}.`, 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const disableMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No staff member selected.'))
      return disableTenantStaff(tenantId, target.id, { reason: reason.trim() })
    },
    onSuccess: async () => {
      showToast(`${target?.fullName} disabled.`, 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No staff member selected.'))
      return reactivateTenantStaff(tenantId, target.id, { reason: reason.trim() })
    },
    onSuccess: async () => {
      showToast(`${target?.fullName} reactivated.`, 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const roleMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No staff member selected.'))
      return changeTenantStaffRole(tenantId, target.id, { role: roleValue, reason: reason.trim() })
    },
    onSuccess: async () => {
      showToast(`${target?.fullName} is now ${roleValue}.`, 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const resetMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No staff member selected.'))
      if (newPassword.length < 10) {
        return Promise.reject(new Error('Password must be at least 10 characters.'))
      }
      return resetTenantStaffPassword(tenantId, target.id, { newPassword, reason: reason.trim() })
    },
    onSuccess: async () => {
      showToast(`${target?.fullName} password updated.`, 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const busy =
    createMutation.isPending ||
    disableMutation.isPending ||
    reactivateMutation.isPending ||
    roleMutation.isPending ||
    resetMutation.isPending

  const reasonOk = validateReason(reason) === null
  const runWithReason = (fn: () => void) => {
    const err = validateReason(reason)
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    fn()
  }

  const rows = sortStaffUsers(query.data ?? [])
  const colCount = 6

  return (
    <section className="rounded-[var(--radius)] border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Staff Users</h2>
          <p className="mt-1 text-xs text-gray-500">
            Login accounts for this tenant. Gym members are tracked separately under Usage.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => openModal('create')}
            className="rounded-[var(--radius)] bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Staff
          </button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="mt-3 rounded border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          Read-only — changing staff requires Platform Ops or above.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last Login</th>
              {canManage ? <th className="px-3 py-2 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {query.isError ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-red-600">
                  Failed to load staff.{' '}
                  <button type="button" className="underline" onClick={() => query.refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-gray-500">
                  No staff members on file.
                </td>
              </tr>
            ) : null}
            {rows.map((u) => {
              const owner = isOwnerRole(u.role)
              return (
                <tr key={u.id} className="border-t border-gray-200">
                  <td className="px-3 py-2 font-medium text-gray-900">{u.fullName}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{u.email}</td>
                  <td className="px-3 py-2 capitalize text-gray-700">{u.role || '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        u.isActive
                          ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200'
                          : 'inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200'
                      }
                    >
                      {staffStatusLabel(u.isActive)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(u.lastLoginAt)}</td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openModal('reset', u)}
                          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-900 hover:bg-gray-200"
                        >
                          Reset password
                        </button>
                        {owner ? (
                          <span className="self-center text-xs text-gray-500" title="The owner account is protected — role changes, disabling, and ownership transfer are not available here.">
                            Protected
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openModal('role', u)}
                              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-900 hover:bg-gray-200"
                            >
                              Change Role
                            </button>
                            {u.isActive ? (
                              <button
                                type="button"
                                onClick={() => openModal('disable', u)}
                                className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openModal('reactivate', u)}
                                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-900 hover:bg-gray-200"
                              >
                                Reactivate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={modal === 'create'}
        title="Add Staff"
        description={<>Adds a new login account for <strong>{tenantName}</strong>. They can sign in immediately with the password set here.</>}
        confirmLabel="Add Staff"
        busy={busy}
        error={formError}
        confirmDisabled={!newFullName.trim() || !newEmail.trim() || newPassword.length < 10}
        onClose={closeModal}
        onConfirm={() => createMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Full name</span>
          <input
            value={newFullName}
            disabled={busy}
            onChange={(e) => setNewFullName(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Email</span>
          <input
            type="email"
            value={newEmail}
            disabled={busy}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Role</span>
          <select
            value={newRole}
            disabled={busy}
            onChange={(e) => setNewRole(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            {TENANT_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">Temporary password (min 10 characters)</span>
          <input
            type="password"
            value={newPassword}
            disabled={busy}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'disable'}
        title="Disable Staff"
        description={
          target ? (
            <>
              Disable <strong>{target.fullName}</strong>&apos;s ({target.email}) access to {tenantName}. They
              will no longer be able to sign in until reactivated.
            </>
          ) : null
        }
        confirmLabel="Disable"
        confirmTone="danger"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => disableMutation.mutate())}
      >
        <ReasonField id="disable-reason" value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'reactivate'}
        title="Reactivate Staff"
        description={
          target ? (
            <>
              Restore <strong>{target.fullName}</strong>&apos;s access to {tenantName}. They will be able to
              sign in again immediately.
            </>
          ) : null
        }
        confirmLabel="Reactivate"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => reactivateMutation.mutate())}
      >
        <ReasonField id="reactivate-reason" value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'role'}
        title="Change Role"
        description={
          target ? (
            <>
              Change <strong>{target.fullName}</strong>&apos;s role from{' '}
              <strong className="capitalize">{target.role}</strong> to{' '}
              <strong className="capitalize">{roleValue}</strong>.
            </>
          ) : null
        }
        confirmLabel="Change Role"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk || target?.role === roleValue}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => roleMutation.mutate())}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">New role</span>
          <select
            value={roleValue}
            disabled={busy}
            onChange={(e) => setRoleValue(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            {TENANT_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <ReasonField id="role-reason" value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>

      <ConfirmDialog
        open={modal === 'reset'}
        title="Reset password"
        description={
          target ? (
            <>
              Sets a new Cloud login password for <strong>{target.fullName}</strong> ({target.email}) on {tenantName}.
              Owner is allowed here. The password is never stored or shown again.
            </>
          ) : null
        }
        confirmLabel="Reset password"
        busy={busy}
        error={formError}
        confirmDisabled={!reasonOk || newPassword.length < 10}
        onClose={closeModal}
        onConfirm={() => runWithReason(() => resetMutation.mutate())}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">New password (min 10 characters)</span>
          <input
            type="password"
            value={newPassword}
            disabled={busy}
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <ReasonField id="reset-reason" value={reason} onChange={setReason} disabled={busy} />
      </ConfirmDialog>
    </section>
  )
}
