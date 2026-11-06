import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { DsButton } from '../components/Button'
import { ActionMenu, ConfirmDialog, Drawer } from '../components/overlays'
import { usePreview } from '../preview-context'
import { LogoMark } from '../components/Logo'

export function OverlaysSection({
  onToast,
}: {
  onToast: (message: string, tone?: 'success' | 'danger') => void
}) {
  const { t } = usePreview()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <section id="overlays" className="ds-section">
      <p className="ds-section-kicker">G</p>
      <h2 className="ds-section-title">{t('overlaysTitle')}</h2>
      <p className="ds-section-lead">{t('overlaysLead')}</p>

      <div className="ds-card mb-4 flex flex-wrap gap-2">
        <DsButton onClick={() => setConfirmOpen(true)}>{t('confirm')}</DsButton>
        <DsButton variant="danger" onClick={() => setDestroyOpen(true)}>
          {t('destroy')}
        </DsButton>
        <DsButton variant="secondary" onClick={() => setDrawerOpen(true)}>
          {t('drawer')}
        </DsButton>
        <div className="relative">
          <DsButton variant="ghost" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-haspopup="menu">
            {t('menu')}
          </DsButton>
          <ActionMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onToast(t('clicked')) }}>
              {t('menuEdit')}
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onToast(t('clicked')) }}>
              {t('menuExport')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenuOpen(false)
                setDestroyOpen(true)
              }}
            >
              {t('menuRevoke')}
            </button>
          </ActionMenu>
        </div>
        <DsButton variant="secondary" onClick={() => onToast(t('toastOkMsg'), 'success')}>
          {t('toastSuccess')}
        </DsButton>
        <DsButton variant="secondary" onClick={() => onToast(t('toastErrMsg'), 'danger')}>
          {t('toastError')}
        </DsButton>
      </div>

      <div className="ds-card ds-denied">
        <ShieldOff className="mx-auto mb-3 text-[var(--ds-text-faint)]" size={28} aria-hidden />
        <h3 className="m-0 text-base">{t('deniedTitle')}</h3>
        <p className="mt-2 mb-0 text-[13px] text-[var(--ds-text-muted)]">{t('deniedBody')}</p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('confirmTitle')}
        body={t('confirmBody')}
        confirmLabel={t('confirmGo')}
        cancelLabel={t('close')}
        onConfirm={() => {
          setConfirmOpen(false)
          onToast(t('toastOkMsg'), 'success')
        }}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={destroyOpen}
        title={t('destroyTitle')}
        body={t('destroyBody')}
        confirmLabel={t('destroyGo')}
        cancelLabel={t('close')}
        tone="danger"
        onConfirm={() => {
          setDestroyOpen(false)
          onToast(t('toastErrMsg'), 'danger')
        }}
        onClose={() => setDestroyOpen(false)}
      />
      <Drawer open={drawerOpen} title={t('drawerTitle')} closeLabel={t('close')} onClose={() => setDrawerOpen(false)}>
        <div className="flex items-center gap-3 mb-3">
          <LogoMark />
          <div>
            <div className="font-bold">{t('sampleGymArName')}</div>
            <div className="text-[12px] text-[var(--ds-text-muted)]">{t('sampleGym')}</div>
          </div>
        </div>
        <p className="text-[13.5px] text-[var(--ds-text-muted)]">{t('drawerBody')}</p>
      </Drawer>
    </section>
  )
}
