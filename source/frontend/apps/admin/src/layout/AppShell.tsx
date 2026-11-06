import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/layout/Sidebar'
import { TopBar } from '@/layout/TopBar'
import { useFeatureFlagsStore } from '@/stores/feature-flags-store'
import { useUiStore } from '@/stores/ui-store'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'

export function AppShell() {
  const ensureProbed = useFeatureFlagsStore((s) => s.ensureProbed)
  const applyDocumentDirection = useUiStore((s) => s.applyDocumentDirection)

  useEffect(() => {
    applyDocumentDirection()
    void ensureProbed()
  }, [applyDocumentDirection, ensureProbed])

  return (
    <div className="flex min-h-screen bg-[var(--lbg)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
