import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCatalogProduct, fetchCatalogProducts, updateCatalogProduct } from '@/lib/api'
import { formatEgp } from '@/lib/format'
import { isOpsOrAbove } from '@/lib/platform-roles'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { PageHeader } from '@/components/PageHeader'
import { StatusChip } from './status'

export function CatalogProductsPage() {
  const t = useUiStore((s) => s.t)
  const showToast = useUiStore((s) => s.showToast)
  const canWrite = isOpsOrAbove(useAuthStore((s) => s.user?.role))
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['catalog-products', true], queryFn: () => fetchCatalogProducts(true) })
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('service')
  const [price, setPrice] = useState('0')

  const createMutation = useMutation({
    mutationFn: () =>
      createCatalogProduct({
        sku: sku.trim(),
        name: name.trim(),
        productType: type,
        defaultPrice: Number(price) || 0,
        isActive: true,
      }),
    onSuccess: async () => {
      showToast(t('catalog.created'), 'success')
      setSku('')
      setName('')
      await queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle')} />
      {canWrite ? (
        <section className="grid gap-2 rounded-[var(--radius)] border border-gray-200 bg-white p-4 sm:grid-cols-5">
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t('catalog.sku')} className="cp-input" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('catalog.name')} className="cp-input" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="cp-input">
            <option value="software">{t('catalog.software')}</option>
            <option value="hardware">{t('catalog.hardware')}</option>
            <option value="service">{t('catalog.service')}</option>
            <option value="consumable">{t('catalog.consumable')}</option>
            <option value="support">{t('catalog.support')}</option>
          </select>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="cp-input" />
          <button
            type="button"
            disabled={!sku.trim() || !name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="cp-btn cp-btn-primary disabled:opacity-50"
          >
            {t('catalog.add')}
          </button>
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t('catalog.sku')}</th>
              <th className="px-3 py-2 font-medium">{t('catalog.name')}</th>
              <th className="px-3 py-2 font-medium">{t('catalog.type')}</th>
              <th className="px-3 py-2 font-medium">{t('catalog.price')}</th>
              <th className="px-3 py-2 font-medium">{t('customers.status')}</th>
              {canWrite ? <th className="px-3 py-2 font-medium">{t('common.actions')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--text-muted)]">
                  {t('common.loading')}
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-red-700">
                  {t('errors.generic')}
                </td>
              </tr>
            ) : null}
            {!query.isLoading && !query.isError && (query.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--text-muted)]">
                  {t('common.noResults')}
                </td>
              </tr>
            ) : null}
            {(query.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-gray-200">
                <td className="px-3 py-2 font-[var(--mono)] text-xs">{row.sku}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.productType}</td>
                <td className="px-3 py-2">{formatEgp(row.defaultPrice)}</td>
                <td className="px-3 py-2">
                  <StatusChip value={row.isActive ? 'active' : 'inactive'} />
                </td>
                {canWrite ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:underline"
                      onClick={() =>
                        updateCatalogProduct(row.id, {
                          sku: row.sku,
                          name: row.name,
                          description: row.description,
                          productType: row.productType,
                          defaultPrice: row.defaultPrice,
                          isActive: !row.isActive,
                        }).then(() => queryClient.invalidateQueries({ queryKey: ['catalog-products'] }))
                      }
                    >
                      {row.isActive ? t('catalog.deactivate') : t('catalog.activate')}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
