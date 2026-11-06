import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertError, Button, Input, Select } from '@/components/ui/form'
import { getDisplayMessage, listMembers, type MemberListStatusFilter } from '@/lib/api'
import { tLabel } from '@/lib/i18n/bilingual'
import { useCan } from '@/hooks/useCan'
import { useUiStore } from '@/stores/ui-store'
import {
  formatDateOnly,
  memberDisplayName,
  membershipStatusLabel,
} from './member-format'

export function MembersListPage() {
  const locale = useUiStore((s) => s.locale)
  const canCreate = useCan('members.create')
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDeferredValue(searchInput.trim())
  const [status, setStatus] = useState<MemberListStatusFilter | ''>('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const query = useQuery({
    queryKey: ['members', deferredSearch, status, page, pageSize],
    queryFn: () =>
      listMembers({
        search: deferredSearch || undefined,
        status,
        page,
        pageSize,
      }),
  })

  const data = query.data

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--fd)] text-2xl font-bold text-[var(--ltp)]">
            {tLabel('Members', 'الأعضاء', locale)}
          </h1>
          <p className="mt-1 text-sm text-[var(--ltt)]">
            {tLabel(
              'Search, filter, and open member profiles.',
              'ابحث وصفِّ وافتح ملفات الأعضاء.',
              locale,
            )}
          </p>
        </div>
        {canCreate ? (
          <Link to="/app/members/new">
            <Button className="min-w-[140px]">
              {tLabel('Add member', 'إضافة عضو', locale)}
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          name="search"
          label={tLabel('Search', 'بحث', locale)}
          placeholder={tLabel('Name, phone, or member #', 'الاسم أو الهاتف أو رقم العضوية', locale)}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            setPage(1)
          }}
        />
        <Select
          name="status"
          label={tLabel('Status', 'الحالة', locale)}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MemberListStatusFilter | '')
            setPage(1)
          }}
        >
          <option value="">{tLabel('All', 'الكل', locale)}</option>
          <option value="active">{tLabel('Active membership', 'عضوية نشطة', locale)}</option>
          <option value="expired">{tLabel('No active membership', 'بدون عضوية نشطة', locale)}</option>
          <option value="frozen">{tLabel('Frozen', 'مجمّدة', locale)}</option>
          <option value="inactive">{tLabel('Deactivated', 'ملغى التفعيل', locale)}</option>
        </Select>
      </div>

      {query.isError ? (
        <AlertError>{getDisplayMessage(query.error, locale)}</AlertError>
      ) : null}

      <div className="overflow-hidden rounded-[var(--rmd)] border border-[var(--lbd)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="bg-[var(--ls2)] text-[12px] uppercase tracking-wide text-[var(--ltt)]">
              <tr>
                <th className="px-4 py-3 font-semibold">{tLabel('Member', 'العضو', locale)}</th>
                <th className="px-4 py-3 font-semibold">{tLabel('Phone', 'الهاتف', locale)}</th>
                <th className="px-4 py-3 font-semibold">{tLabel('Plan', 'الباقة', locale)}</th>
                <th className="px-4 py-3 font-semibold">{tLabel('Status', 'الحالة', locale)}</th>
                <th className="px-4 py-3 font-semibold">{tLabel('Expiry', 'الانتهاء', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--ltt)]">
                    {tLabel('Loading…', 'جارٍ التحميل…', locale)}
                  </td>
                </tr>
              ) : null}
              {!query.isLoading && data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--ltt)]">
                    {tLabel('No members found.', 'لا يوجد أعضاء.', locale)}
                  </td>
                </tr>
              ) : null}
              {data?.items.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-[var(--lbd)] transition-colors hover:bg-[var(--ls2)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/app/members/${m.id}`}
                      className="font-semibold text-[var(--ltp)] hover:text-[var(--l600)]"
                    >
                      {memberDisplayName(m.fullName, m.fullNameAr, locale)}
                    </Link>
                    <div className="text-xs text-[var(--ltt)]">{m.memberNumber}</div>
                    {!m.isActive ? (
                      <span className="mt-1 inline-block text-[11px] font-semibold text-[var(--dng600)]">
                        {tLabel('Deactivated', 'ملغى التفعيل', locale)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--lts)]" dir="ltr">
                    {m.phone}
                  </td>
                  <td className="px-4 py-3 text-[var(--lts)]">
                    {m.activePlan || m.activePlanAr
                      ? tLabel(m.activePlan ?? '', m.activePlanAr ?? '', locale) || '—'
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        m.membershipStatus === 'active'
                          ? 'bg-[rgba(160,224,64,0.18)] text-[var(--l600)]'
                          : m.membershipStatus === 'frozen'
                            ? 'bg-[var(--inf100)] text-[var(--inftxt)]'
                            : 'bg-[var(--ls3)] text-[var(--lts)]'
                      }`}
                    >
                      {membershipStatusLabel(m.membershipStatus, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--lts)]">
                    {formatDateOnly(m.expiryDate, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--lbd)] px-4 py-3">
            <p className="text-xs text-[var(--ltt)]">
              {tLabel(
                `Page ${data.page} of ${data.totalPages} · ${data.totalCount} total`,
                `صفحة ${data.page} من ${data.totalPages} · ${data.totalCount} إجمالي`,
                locale,
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!data.hasPrevious || query.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {tLabel('Previous', 'السابق', locale)}
              </Button>
              <Button
                variant="secondary"
                disabled={!data.hasNext || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {tLabel('Next', 'التالي', locale)}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
