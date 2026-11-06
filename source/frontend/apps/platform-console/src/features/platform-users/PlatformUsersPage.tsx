import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { StatusChip } from '@/components/Status'
import {
  changePlatformUserRole,
  createPlatformUser,
  disablePlatformUser,
  fetchPlatformUsers,
  reactivatePlatformUser,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import { PLATFORM_USER_ROLES, type PlatformUserDto } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { isAdmin } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

type ModalKind = 'create' | 'disable' | 'reactivate' | 'role' | null

function roleLabel(role: string, t: (key: string) => string): string {
  return t(`users.role.${role}`)
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return 'Forbidden — Requires Platform Admin (403).'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function PlatformUsersPage() {
  const t = useUiStore((s) => s.t)
  const currentUser = useAuthStore((s) => s.user)
  const admin = isAdmin(currentUser?.role)

  if (!admin) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          {t('users.forbidden', { role: currentUser?.role ?? t('customers.unknown') })}
        </div>
      </div>
    )
  }

  return <PlatformUsersAdminView currentUserId={currentUser?.id ?? null} />
}

function PlatformUsersAdminView({ currentUserId }: { currentUserId: string | null }) {
  const t = useUiStore((s) => s.t)
  const showToast = useUiStore((s) => s.showToast)
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ['platform-users'], queryFn: fetchPlatformUsers })

  const [modal, setModal] = useState<ModalKind>(null)
  const [target, setTarget] = useState<PlatformUserDto | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<string>(PLATFORM_USER_ROLES[0])
  const [newPassword, setNewPassword] = useState('')
  const [roleValue, setRoleValue] = useState<string>(PLATFORM_USER_ROLES[0])

  function openModal(kind: ModalKind, row?: PlatformUserDto) {
    setModal(kind)
    setTarget(row ?? null)
    setFormError(null)
    if (kind === 'create') {
      setNewEmail('')
      setNewFullName('')
      setNewRole(PLATFORM_USER_ROLES[0])
      setNewPassword('')
    }
    if (kind === 'role' && row) {
      setRoleValue(row.role)
    }
  }

  function closeModal() {
    if (busy) return
    setModal(null)
    setTarget(null)
    setFormError(null)
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform-users'] })

  const createMutation = useMutation({
    mutationFn: () => {
      if (newPassword.length < 10) {
        return Promise.reject(new Error(t('users.passwordMin')))
      }
      return createPlatformUser({
        email: newEmail.trim(),
        fullName: newFullName.trim(),
        role: newRole,
        password: newPassword,
      })
    },
    onSuccess: async (user) => {
      showToast(t('users.createdToast', { name: user.fullName, role: roleLabel(user.role, t) }), 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const disableMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No user selected.'))
      return disablePlatformUser(target.id)
    },
    onSuccess: async () => {
      showToast(t('users.disabledToast', { name: target?.fullName ?? '' }), 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No user selected.'))
      return reactivatePlatformUser(target.id)
    },
    onSuccess: async () => {
      showToast(t('users.reactivatedToast', { name: target?.fullName ?? '' }), 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const roleMutation = useMutation({
    mutationFn: () => {
      if (!target) return Promise.reject(new Error('No user selected.'))
      return changePlatformUserRole(target.id, { role: roleValue })
    },
    onSuccess: async () => {
      showToast(t('users.roleToast', { name: target?.fullName ?? '', role: roleLabel(roleValue, t) }), 'success')
      await invalidate()
      closeModal()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const busy =
    createMutation.isPending || disableMutation.isPending || reactivateMutation.isPending || roleMutation.isPending

  const users = query.data ?? []
  const colCount = 7

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <button type="button" onClick={() => openModal('create')} className="cp-btn cp-btn-primary">
            {t('users.create')}
          </button>
        }
      />

      <div
        role="status"
        className="rounded-[var(--radius)] border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700"
      >
        {t('users.hint')}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
        <table className="cp-table min-w-full text-left text-sm">
          <thead>
            <tr>
              <th>{t('users.name')}</th>
              <th>{t('users.email')}</th>
              <th>{t('users.role')}</th>
              <th>{t('users.status')}</th>
              <th>{t('users.lastLogin')}</th>
              <th>{t('users.created')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
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
                  {query.error instanceof ApiClientError ? query.error.message : t('users.failedLoad')}{' '}
                  <button type="button" className="underline" onClick={() => query.refetch()}>
                    {t('common.retry')}
                  </button>
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && users.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-gray-500">
                  {t('users.empty')}
                </td>
              </tr>
            ) : null}
            {users.map((u) => {
              const isSelf = currentUserId != null && u.id === currentUserId
              return (
                <tr key={u.id} className="border-t border-gray-200">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {u.fullName}
                    {isSelf ? <span className="ml-2 text-xs text-gray-500">{t('users.you')}</span> : null}
                  </td>
                  <td className="px-3 py-2 font-[var(--mono)] text-xs text-gray-700">{u.email}</td>
                  <td className="px-3 py-2">{roleLabel(u.role, t)}</td>
                  <td className="px-3 py-2">
                    <StatusChip value={u.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(u.lastLoginAtUtc)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatCairoDateTime(u.createdAtUtc)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span title={isSelf ? t('users.cannotChangeOwnRole') : undefined}>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => openModal('role', u)}
                          className="cp-btn cp-btn-secondary disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {t('users.changeRole')}
                        </button>
                      </span>
                      {u.isActive ? (
                        <span title={isSelf ? t('users.cannotDisableSelf') : undefined}>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => openModal('disable', u)}
                            className="cp-btn cp-btn-danger disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {t('users.disable')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModal('reactivate', u)}
                          className="cp-btn cp-btn-secondary"
                        >
                          {t('users.reactivate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={modal === 'create'}
        title={t('users.createTitle')}
        description={t('users.createDesc')}
        confirmLabel={t('users.createConfirm')}
        busy={busy}
        error={formError}
        confirmDisabled={!newEmail.trim() || !newFullName.trim() || newPassword.length < 10}
        onClose={closeModal}
        onConfirm={() => createMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('users.fullName')}</span>
          <input
            value={newFullName}
            disabled={busy}
            onChange={(e) => setNewFullName(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('users.email')}</span>
          <input
            type="email"
            value={newEmail}
            disabled={busy}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('users.role')}</span>
          <select
            value={newRole}
            disabled={busy}
            onChange={(e) => setNewRole(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            {PLATFORM_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r, t)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('users.tempPassword')}</span>
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
        title={t('users.disableTitle')}
        description={target ? t('users.disableDesc', { name: target.fullName }) : null}
        confirmLabel={t('users.disable')}
        confirmTone="danger"
        busy={busy}
        error={formError}
        onClose={closeModal}
        onConfirm={() => disableMutation.mutate()}
      />

      <ConfirmDialog
        open={modal === 'reactivate'}
        title={t('users.reactivateTitle')}
        description={target ? t('users.reactivateDesc', { name: target.fullName }) : null}
        confirmLabel={t('users.reactivate')}
        busy={busy}
        error={formError}
        onClose={closeModal}
        onConfirm={() => reactivateMutation.mutate()}
      />

      <ConfirmDialog
        open={modal === 'role'}
        title={t('users.roleTitle')}
        description={target ? t('users.roleDesc', { name: target.fullName }) : null}
        confirmLabel={t('users.changeRole')}
        busy={busy}
        error={formError}
        confirmDisabled={target?.role === roleValue}
        onClose={closeModal}
        onConfirm={() => roleMutation.mutate()}
      >
        <label className="mt-2 block text-sm">
          <span className="text-gray-500">{t('users.newRole')}</span>
          <select
            value={roleValue}
            disabled={busy}
            onChange={(e) => setRoleValue(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-gray-300 bg-white px-3 py-2"
          >
            {PLATFORM_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r, t)}
              </option>
            ))}
          </select>
        </label>
      </ConfirmDialog>
    </div>
  )
}
