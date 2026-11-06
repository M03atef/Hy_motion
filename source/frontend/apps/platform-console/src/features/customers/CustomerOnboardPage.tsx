import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DsAlert, DsButton, DsCard, DsEmptyState, DsPageHeader, SelectField, TextAreaField, TextInput } from '@/design-system'
import {
  changeContractStatus,
  createContract,
  createCustomer,
  fetchCatalogProducts,
  fetchContract,
  fetchCustomer,
  fetchCustomerPayments,
  fetchCustomers,
  fetchIssuedSalesContracts,
  issueLocalLicense,
  issueSalesContract,
  previewSalesContract,
  recordCustomerPayment,
  reprintSalesContract,
  updateCustomer,
} from '@/lib/api'
import { ApiClientError } from '@/lib/api/errors'
import type {
  PlatformCatalogProductDto,
  PlatformContractDto,
  PlatformCustomerDetailDto,
  PlatformCustomerListItemDto,
} from '@/lib/api/types'
import { formatEgp } from '@/lib/format'
import { isOpsOrAbove, isSalesOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { openSalesContractPrint } from '@/features/operation-center/OcSalesContractPanel'
import { OcStatus } from '@/features/operation-center/OcStatus'

type Line = { productId: string; quantity: number; unitPrice: number; discountAmount: number }
type CustomerMode = 'existing' | 'new'

export function appendLicenseSkipNote(existing: string | null | undefined, skipNote: string): string {
  const line = `License skipped during onboard: ${skipNote.trim()}`
  const prior = existing?.trim()
  return prior ? `${prior}\n${line}` : line
}

export function onboardBackPath(_pathname: string): string {
  return '/oc/sales'
}

export function onboardFinishPath(_pathname: string, customerId: string): string {
  return `/oc/gyms/local/${customerId}`
}

export function normalizeCustomerMatch(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Soft duplicate hint only — no backend uniqueness. */
export function findSimilarCustomers(
  rows: PlatformCustomerListItemDto[],
  args: { businessName: string; phone?: string; email?: string },
): PlatformCustomerListItemDto[] {
  const biz = normalizeCustomerMatch(args.businessName)
  const phone = normalizeCustomerMatch(args.phone).replace(/\D/g, '')
  const email = normalizeCustomerMatch(args.email)
  if (!biz && !phone && !email) return []
  return rows.filter((row) => {
    const rowBiz = normalizeCustomerMatch(row.businessName)
    const rowPhone = normalizeCustomerMatch(row.phone).replace(/\D/g, '')
    const rowEmail = normalizeCustomerMatch(row.email)
    if (biz && rowBiz && rowBiz === biz) return true
    if (phone.length >= 8 && rowPhone && rowPhone === phone) return true
    if (email && rowEmail && rowEmail === email) return true
    return false
  })
}

function payStatusFromAmounts(total: number, paid: number): string {
  if (paid <= 0) return 'unpaid'
  if (paid >= total) return 'paid'
  return 'partial'
}

export function CustomerOnboardPage() {
  const t = useUiStore((s) => s.t)
  const showToast = useUiStore((s) => s.showToast)
  const navigate = useNavigate()
  const location = useLocation()
  const inOc = location.pathname.startsWith('/oc')
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = isSalesOrAbove(role)
  const canIssueLicense = isOpsOrAbove(role)
  const queryClient = useQueryClient()

  const catalogQuery = useQuery({ queryKey: ['catalog-products'], queryFn: () => fetchCatalogProducts(false) })
  const customersQuery = useQuery({ queryKey: ['platform-customers'], queryFn: () => fetchCustomers() })

  const [mode, setMode] = useState<CustomerMode>('new')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsApp, setWhatsApp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [leadSource, setLeadSource] = useState('Sales Team')
  const [lines, setLines] = useState<Line[]>([])
  const [headerDiscount, setHeaderDiscount] = useState(0)
  const [deviceLimit, setDeviceLimit] = useState(1)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('bank_transfer')
  const [ownerUsername, setOwnerUsername] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [customer, setCustomer] = useState<PlatformCustomerDetailDto | null>(null)
  const [contract, setContract] = useState<PlatformContractDto | null>(null)
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [licenseSkipped, setLicenseSkipped] = useState(false)
  const [skipNote, setSkipNote] = useState('')
  const [paperLang, setPaperLang] = useState<'en' | 'ar'>('en')
  const [paperSkipped, setPaperSkipped] = useState(false)
  const [dupAck, setDupAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  const products = catalogQuery.data ?? []
  const customerRows = customersQuery.data ?? []
  const selected = useMemo(() => new Set(lines.map((l) => l.productId)), [lines])
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discountAmount, 0)
  const draftTotal = Math.max(0, subtotal - headerDiscount)
  const liveTotal = contract?.total ?? draftTotal
  const livePaid = contract?.paidAmount ?? 0
  const liveOutstanding = contract?.outstandingAmount ?? Math.max(0, liveTotal - livePaid)
  const livePayStatus = contract?.paymentStatus ?? payStatusFromAmounts(liveTotal, livePaid)
  const saleLocked = Boolean(contract)

  const similar = useMemo(
    () =>
      mode === 'new' && !customer
        ? findSimilarCustomers(customerRows, { businessName, phone, email })
        : [],
    [mode, customer, customerRows, businessName, phone, email],
  )

  const paymentsQuery = useQuery({
    queryKey: ['customer-payments', customer?.id, contract?.id],
    queryFn: () => fetchCustomerPayments(customer!.id, contract!.id),
    enabled: Boolean(customer?.id && contract?.id),
  })
  const issuedPaperQuery = useQuery({
    queryKey: ['local-sales-contracts', customer?.id, contract?.id],
    queryFn: () => fetchIssuedSalesContracts(customer!.id, contract!.id),
    enabled: Boolean(customer?.id && contract?.id),
  })
  const issuedPaper = issuedPaperQuery.data?.[0] ?? null

  function toggleProduct(product: PlatformCatalogProductDto) {
    if (saleLocked) return
    setLines((current) => {
      if (current.some((l) => l.productId === product.id)) return current.filter((l) => l.productId !== product.id)
      return [...current, { productId: product.id, quantity: 1, unitPrice: product.defaultPrice, discountAmount: 0 }]
    })
  }

  async function refreshContract(id: string) {
    const next = await fetchContract(id)
    setContract(next)
    return next
  }

  const ensureCustomerMutation = useMutation({
    mutationFn: async () => {
      if (customer) return customer
      if (mode === 'existing') {
        if (!selectedCustomerId) throw new Error(t('workspace.pickCustomer'))
        const detail = await fetchCustomer(selectedCustomerId)
        setCustomer(detail)
        setOwnerEmail(detail.ownerEmail || detail.email || '')
        setOwnerUsername(detail.ownerUsername || '')
        return detail
      }
      if (!businessName.trim() || !ownerName.trim()) throw new Error(t('customers.required'))
      if (similar.length > 0 && !dupAck) throw new Error(t('workspace.dupAckRequired'))
      const created = await createCustomer({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || null,
        whatsApp: whatsApp.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        leadSource: leadSource.trim() || null,
        preferredContactMethod: whatsApp ? 'whatsapp' : email ? 'email' : 'phone',
        ownerEmail: email.trim() || null,
      })
      setCustomer(created)
      if (!ownerEmail.trim() && email.trim()) setOwnerEmail(email.trim())
      await queryClient.invalidateQueries({ queryKey: ['platform-customers'] })
      return created
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('errors.generic')),
  })

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const cust = await ensureCustomerMutation.mutateAsync()
      if (products.length === 0) throw new Error(t('onboard.emptyCatalog'))
      if (lines.length === 0) throw new Error(t('contracts.needItems'))
      if (contract) return contract
      const created = await createContract({
        customerId: cust.id,
        discount: headerDiscount,
        items: lines.map((line) => ({
          catalogProductId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount,
        })),
      })
      const pending = await changeContractStatus(created.id, { status: 'pending' })
      const active = await changeContractStatus(pending.id, { status: 'active' })
      setContract(active)
      showToast(t('workspace.saleCreated'), 'success')
      return active
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t('errors.generic')),
  })

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error(t('workspace.needSale'))
      const amount = Number(payAmount)
      if (!amount || amount <= 0) throw new Error(t('workspace.payPositive'))
      if (livePaid + amount > liveTotal + 0.001) {
        showToast(t('workspace.overpayWarn'), 'info')
      }
      await recordCustomerPayment({
        contractId: contract.id,
        amount,
        paymentMethod: payMethod,
      })
      setPayAmount('')
      await refreshContract(contract.id)
      await queryClient.invalidateQueries({ queryKey: ['customer-payments', customer?.id, contract.id] })
      showToast(t('workspace.payRecorded'), 'success')
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t('errors.generic')),
  })

  const licenseMutation = useMutation({
    mutationFn: async () => {
      if (!customer || !contract) throw new Error(t('workspace.needSale'))
      const issued = await issueLocalLicense({
        customerId: customer.id,
        contractId: contract.id,
        edition: 'Lifetime',
        deviceLimit: Math.max(1, deviceLimit || 1),
      })
      setLicenseKey(issued.licenseKey)
      setLicenseSkipped(false)
      showToast(t('licenses.issuedToast', { key: issued.licenseKey, name: customer.businessName }), 'success')
      return issued
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error(t('workspace.needCustomer'))
      if (skipNote.trim().length < 10) throw new Error(t('onboard.skipNoteRequired'))
      const updated = await updateCustomer(customer.id, {
        businessName: customer.businessName,
        ownerName: customer.ownerName,
        phone: customer.phone,
        whatsApp: customer.whatsApp,
        email: customer.email,
        address: customer.address,
        preferredContactMethod: customer.preferredContactMethod,
        notes: appendLicenseSkipNote(customer.notes, skipNote),
        status: customer.status,
        leadSource: customer.leadSource,
        ownerUsername: customer.ownerUsername,
        ownerEmail: customer.ownerEmail,
      })
      setCustomer(updated)
      setLicenseSkipped(true)
      showToast(t('onboard.skipped'), 'info')
      return updated
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t('errors.generic')),
  })

  const ownerMutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error(t('workspace.needCustomer'))
      const nextEmail = ownerEmail.trim() || customer.email
      if (!nextEmail) throw new Error(t('onboard.ownerEmailRequired'))
      const updated = await updateCustomer(customer.id, {
        businessName: customer.businessName,
        ownerName: customer.ownerName,
        phone: customer.phone,
        whatsApp: customer.whatsApp,
        email: customer.email,
        address: customer.address,
        preferredContactMethod: customer.preferredContactMethod,
        notes: customer.notes,
        status: customer.status,
        leadSource: customer.leadSource,
        ownerUsername: ownerUsername.trim() || null,
        ownerEmail: nextEmail,
      })
      setCustomer(updated)
      return updated
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const previewPaperMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error(t('workspace.needSale'))
      const html = await previewSalesContract(contract.id, paperLang)
      if (!openSalesContractPrint(html.html)) throw new Error(t('workspace.printBlocked'))
      showToast(t('workspace.previewOpened'), 'success')
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : t('errors.generic')),
  })

  const issuePaperMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error(t('workspace.needSale'))
      const html = await issueSalesContract(contract.id, paperLang)
      setPaperSkipped(false)
      await queryClient.invalidateQueries({ queryKey: ['local-sales-contracts', customer?.id, contract.id] })
      const opened = openSalesContractPrint(html.html)
      showToast(opened ? t('workspace.paperIssuedToast') : t('workspace.issuedNoPrint'), opened ? 'success' : 'info')
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const reprintPaperMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error(t('workspace.needSale'))
      const html = await reprintSalesContract(contract.id)
      await queryClient.invalidateQueries({ queryKey: ['local-sales-contracts', customer?.id, contract.id] })
      const opened = openSalesContractPrint(html.html)
      showToast(opened ? t('workspace.reprinted') : t('workspace.printBlocked'), opened ? 'success' : 'info')
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : t('errors.generic')),
  })

  const busy =
    ensureCustomerMutation.isPending ||
    createSaleMutation.isPending ||
    payMutation.isPending ||
    licenseMutation.isPending ||
    skipMutation.isPending ||
    ownerMutation.isPending ||
    previewPaperMutation.isPending ||
    issuePaperMutation.isPending ||
    reprintPaperMutation.isPending

  const licenseDone = Boolean(licenseKey) || licenseSkipped
  const canComplete = Boolean(customer && contract && licenseDone && !completed)

  async function completeSale() {
    setError(null)
    try {
      if (!customer || !contract) {
        setError(t('workspace.needSale'))
        return
      }
      if (!licenseDone) {
        setError(t('onboard.licenseRequired'))
        return
      }
      await ownerMutation.mutateAsync()
      setCompleted(true)
      showToast(t('workspace.completed'), 'success')
    } catch {
      /* mutation error */
    }
  }

  if (!canWrite) {
    return <DsAlert tone="warning">{t('errors.forbidden')}</DsAlert>
  }

  return (
    <div className="oc-stack" data-oc>
      <Link to={onboardBackPath(location.pathname)} className="text-sm text-[var(--ds-action)] hover:underline">
        ← {t('customers.back')}
      </Link>
      <DsPageHeader title={t('workspace.title')} subtitle={t('workspace.subtitle')} />
      {error ? <DsAlert tone="danger">{error}</DsAlert> : null}

      <div className="oc-sale-shell">
        <div className="oc-stack">
          <DsCard>
            <h2 className="oc-section-title">{t('workspace.sec.customer')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.customer')}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <DsButton
                type="button"
                variant={mode === 'existing' ? 'primary' : 'secondary'}
                disabled={Boolean(customer)}
                onClick={() => setMode('existing')}
              >
                {t('workspace.existing')}
              </DsButton>
              <DsButton
                type="button"
                variant={mode === 'new' ? 'primary' : 'secondary'}
                disabled={Boolean(customer)}
                onClick={() => setMode('new')}
              >
                {t('workspace.new')}
              </DsButton>
            </div>
            {customer ? (
              <DsAlert tone="success">
                {customer.businessName} · {customer.ownerName} · {customer.phone || customer.email || '—'}
              </DsAlert>
            ) : mode === 'existing' ? (
              <SelectField
                label={t('workspace.pickCustomer')}
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">—</option>
                {customerRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.businessName} · {row.ownerName}
                    {row.phone ? ` · ${row.phone}` : ''}
                  </option>
                ))}
              </SelectField>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label={t('customers.business')}
                  required
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value)
                    setDupAck(false)
                  }}
                />
                <TextInput label={t('customers.owner')} required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                <TextInput
                  label={t('customers.phone')}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setDupAck(false)
                  }}
                />
                <TextInput label={t('customers.whatsapp')} value={whatsApp} onChange={(e) => setWhatsApp(e.target.value)} />
                <TextInput
                  label={t('customers.email')}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setDupAck(false)
                  }}
                />
                <TextInput label={t('customers.leadSource')} value={leadSource} onChange={(e) => setLeadSource(e.target.value)} />
                <div className="sm:col-span-2">
                  <TextInput label={t('customers.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
            )}
            {similar.length > 0 && !customer ? (
              <div className="mt-3">
                <DsAlert tone="warning">
                  {t('workspace.dupWarn')}: {similar.slice(0, 3).map((s) => s.businessName).join(', ')}
                </DsAlert>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dupAck} onChange={(e) => setDupAck(e.target.checked)} />
                  {t('workspace.dupAck')}
                </label>
              </div>
            ) : null}
            {!customer ? (
              <div className="mt-3">
                <DsButton type="button" loading={ensureCustomerMutation.isPending} onClick={() => void ensureCustomerMutation.mutateAsync()}>
                  {mode === 'existing' ? t('workspace.useCustomer') : t('workspace.createCustomer')}
                </DsButton>
              </div>
            ) : null}
          </DsCard>

          <DsCard>
            <h2 className="oc-section-title">{t('workspace.sec.product')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.product')}</p>
            {products.length === 0 ? (
              <DsEmptyState title={t('onboard.emptyCatalog')} hint={inOc ? '/oc/settings/catalog' : '/settings/catalog'} />
            ) : (
              <div className="oc-stack">
                {products.map((product) => {
                  const line = lines.find((l) => l.productId === product.id)
                  return (
                    <label
                      key={product.id}
                      className="flex flex-wrap items-center gap-3 rounded border border-[var(--ds-border)] px-3 py-2 text-sm"
                    >
                      <input type="checkbox" checked={selected.has(product.id)} disabled={saleLocked} onChange={() => toggleProduct(product)} />
                      <span className="min-w-[12rem] font-medium">{product.name}</span>
                      <span className="text-[var(--ds-text-muted)]">{formatEgp(product.defaultPrice)}</span>
                      {line && !saleLocked ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((current) =>
                                current.map((l) => (l.productId === product.id ? { ...l, quantity: Number(e.target.value) || 1 } : l)),
                              )
                            }
                            className="ds-input w-20"
                          />
                          <input
                            type="number"
                            min={0}
                            value={line.unitPrice}
                            onChange={(e) =>
                              setLines((current) =>
                                current.map((l) => (l.productId === product.id ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)),
                              )
                            }
                            className="ds-input w-28"
                          />
                        </>
                      ) : null}
                    </label>
                  )
                })}
                {!saleLocked ? (
                  <TextInput
                    label={t('workspace.discount')}
                    type="number"
                    value={String(headerDiscount)}
                    onChange={(e) => setHeaderDiscount(Number(e.target.value) || 0)}
                  />
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label={t('workspace.edition')} value="Lifetime" onChange={() => undefined} disabled>
                    <option value="Lifetime">Lifetime</option>
                  </SelectField>
                  <TextInput
                    label={t('workspace.deviceLimit')}
                    type="number"
                    value={String(deviceLimit)}
                    disabled={Boolean(licenseKey)}
                    onChange={(e) => setDeviceLimit(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                {!saleLocked ? (
                  <DsButton type="button" loading={createSaleMutation.isPending} onClick={() => void createSaleMutation.mutateAsync()}>
                    {t('workspace.createSale')}
                  </DsButton>
                ) : (
                  <DsAlert tone="info">
                    {t('workspace.saleLive')}: <span className="ds-ltr-isolate font-semibold">{contract?.contractNumber}</span>
                  </DsAlert>
                )}
              </div>
            )}
          </DsCard>

          <DsCard className={!contract ? 'opacity-60' : ''}>
            <h2 className="oc-section-title">{t('workspace.sec.payment')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.payment')}</p>
            {!contract ? (
              <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t('workspace.needSale')}</p>
            ) : (
              <div className="oc-stack max-w-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <OcStatus value={livePayStatus} />
                  <span className="text-sm text-[var(--ds-text-muted)]">
                    {formatEgp(livePaid)} / {formatEgp(liveTotal)} · {t('workspace.outstanding')}: {formatEgp(liveOutstanding)}
                  </span>
                </div>
                <TextInput label={t('payments.amount')} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <SelectField label={t('payments.method')} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </SelectField>
                <p className="m-0 text-xs text-[var(--ds-text-muted)]">{t('payments.recordedOnly')}</p>
                <DsButton type="button" variant="secondary" loading={payMutation.isPending} onClick={() => void payMutation.mutateAsync()}>
                  {t('workspace.recordPay')}
                </DsButton>
                {(paymentsQuery.data?.length ?? 0) > 0 ? (
                  <ul className="m-0 list-none space-y-1 p-0 text-xs text-[var(--ds-text-muted)]">
                    {paymentsQuery.data!.map((p) => (
                      <li key={p.id}>
                        <span className="ds-ltr-isolate">{formatEgp(p.amount)}</span> · {p.paymentMethod}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </DsCard>

          <DsCard className={!contract ? 'opacity-60' : ''}>
            <h2 className="oc-section-title">{t('workspace.sec.license')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.license')}</p>
            {!contract ? (
              <p className="m-0 text-sm text-[var(--ds-text-muted)]">{t('workspace.needSale')}</p>
            ) : (
              <div className="oc-stack max-w-xl">
                {canIssueLicense ? (
                  <DsButton
                    type="button"
                    disabled={busy || Boolean(licenseKey) || licenseSkipped}
                    loading={licenseMutation.isPending}
                    onClick={() => void licenseMutation.mutateAsync()}
                  >
                    {licenseKey ? licenseKey : t('onboard.issueLicense')}
                  </DsButton>
                ) : (
                  <DsAlert tone="warning">{t('onboard.licenseSalesBlocked')}</DsAlert>
                )}
                <p className="m-0 text-xs text-[var(--ds-text-muted)]">{t('onboard.noFakeInstall')}</p>
                {!licenseKey ? (
                  <div className="oc-stack border-t border-[var(--ds-border)] pt-3">
                    <TextAreaField
                      label={t('onboard.skipNote')}
                      value={skipNote}
                      onChange={(e) => setSkipNote(e.target.value)}
                      rows={2}
                      disabled={licenseSkipped}
                    />
                    <DsButton
                      type="button"
                      variant="secondary"
                      disabled={busy || licenseSkipped || skipNote.trim().length < 10}
                      loading={skipMutation.isPending}
                      onClick={() => void skipMutation.mutateAsync()}
                    >
                      {licenseSkipped ? t('onboard.skipped') : t('onboard.skipLicense')}
                    </DsButton>
                  </div>
                ) : null}
              </div>
            )}
          </DsCard>

          <DsCard className={!contract ? 'opacity-60' : ''}>
            <h2 className="oc-section-title">{t('workspace.sec.paper')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.paper')}</p>
            <DsAlert tone="info">{t('workspace.paperOptional')}</DsAlert>
            {!contract ? (
              <p className="m-0 mt-3 text-sm text-[var(--ds-text-muted)]">{t('workspace.needSale')}</p>
            ) : (
              <div className="oc-stack max-w-xl mt-3">
                <SelectField
                  label={t('workspace.paperLang')}
                  value={paperLang}
                  onChange={(e) => setPaperLang(e.target.value === 'ar' ? 'ar' : 'en')}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </SelectField>
                <div className="flex flex-wrap gap-2">
                  <DsButton
                    type="button"
                    variant="secondary"
                    loading={previewPaperMutation.isPending}
                    onClick={() => void previewPaperMutation.mutateAsync()}
                  >
                    {t('workspace.previewPaper')}
                  </DsButton>
                  {issuedPaper ? (
                    <DsButton type="button" loading={reprintPaperMutation.isPending} onClick={() => void reprintPaperMutation.mutateAsync()}>
                      {t('workspace.printPaper')}
                    </DsButton>
                  ) : (
                    <DsButton type="button" loading={issuePaperMutation.isPending} onClick={() => void issuePaperMutation.mutateAsync()}>
                      {t('workspace.issuePaper')}
                    </DsButton>
                  )}
                  {!issuedPaper ? (
                    <DsButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setPaperSkipped(true)
                        showToast(t('workspace.paperSkipped'), 'info')
                      }}
                    >
                      {t('workspace.skipPaper')}
                    </DsButton>
                  ) : null}
                </div>
                {issuedPaper ? (
                  <p className="m-0 text-xs text-[var(--ds-text-muted)]">
                    {t('workspace.paperIssued')} · {t('workspace.prints')}: {issuedPaper.printCount}
                  </p>
                ) : paperSkipped ? (
                  <p className="m-0 text-xs text-[var(--ds-text-muted)]">{t('workspace.paperSkipped')}</p>
                ) : null}
              </div>
            )}
          </DsCard>

          <DsCard>
            <h2 className="oc-section-title">{t('workspace.sec.complete')}</h2>
            <p className="oc-section-body mb-3">{t('workspace.hint.complete')}</p>
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <TextInput label={t('customers.ownerUsername')} value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value)} />
              <TextInput
                label={t('customers.ownerEmail')}
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
              <p className="sm:col-span-2 m-0 text-xs text-[var(--ds-text-muted)]">{t('customers.noPasswordStored')}</p>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-[var(--ds-text-muted)]">
              <li>{customer ? `✓ ${t('workspace.check.customer')}` : `○ ${t('workspace.check.customer')}`}</li>
              <li>{contract ? `✓ ${t('workspace.check.sale')}` : `○ ${t('workspace.check.sale')}`}</li>
              <li>{licenseDone ? `✓ ${t('workspace.check.license')}` : `○ ${t('workspace.check.license')}`}</li>
              <li>✓ {t('workspace.check.paper')}</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <DsButton
                type="button"
                disabled={!canComplete || busy}
                loading={ownerMutation.isPending}
                onClick={() => void completeSale()}
              >
                {t('workspace.complete')}
              </DsButton>
              {completed && customer ? (
                <DsButton type="button" variant="secondary" onClick={() => navigate(onboardFinishPath(location.pathname, customer.id))}>
                  {t('onboard.openProfile')}
                </DsButton>
              ) : null}
            </div>
            {completed ? <div className="mt-3"><DsAlert tone="success">{t('workspace.completed')}</DsAlert></div> : null}
          </DsCard>
        </div>

        <aside className="oc-sale-rail" aria-label={t('workspace.rail')}>
          <DsCard>
            <h2 className="oc-section-title">{t('workspace.rail')}</h2>
            <div className="mb-2">
              <OcStatus value={livePayStatus} />
            </div>
            <dl className="oc-dl">
              <div>
                <dt>{t('workspace.subtotal')}</dt>
                <dd className="ds-ltr-isolate">{formatEgp(contract ? (contract.subtotal ?? liveTotal) : subtotal)}</dd>
              </div>
              <div>
                <dt>{t('workspace.discount')}</dt>
                <dd className="ds-ltr-isolate">{formatEgp(contract?.discount ?? headerDiscount)}</dd>
              </div>
              <div>
                <dt>{t('contracts.total')}</dt>
                <dd className="ds-ltr-isolate font-semibold">{formatEgp(liveTotal)}</dd>
              </div>
              <div>
                <dt>{t('workspace.paid')}</dt>
                <dd className="ds-ltr-isolate">{formatEgp(livePaid)}</dd>
              </div>
              <div>
                <dt>{t('workspace.outstanding')}</dt>
                <dd className="ds-ltr-isolate">{formatEgp(liveOutstanding)}</dd>
              </div>
            </dl>
            <p className="mt-3 m-0 text-xs text-[var(--ds-text-muted)]">{customer?.businessName || t('workspace.noCustomer')}</p>
            <p className="m-0 text-xs text-[var(--ds-text-muted)]">
              {contract?.contractNumber ? <span className="ds-ltr-isolate">{contract.contractNumber}</span> : t('workspace.noSale')}
            </p>
            <p className="m-0 text-xs text-[var(--ds-text-muted)]">
              {licenseKey ? t('workspace.licenseIssued') : licenseSkipped ? t('onboard.skipped') : t('workspace.noLicense')}
            </p>
            <p className="m-0 text-xs text-[var(--ds-text-muted)]">
              {issuedPaper ? t('workspace.paperIssued') : paperSkipped ? t('workspace.paperSkipped') : t('workspace.noPaper')}
            </p>
          </DsCard>
        </aside>
      </div>
    </div>
  )
}
