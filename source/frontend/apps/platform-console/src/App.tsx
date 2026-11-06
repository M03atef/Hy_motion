import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { RequireAuth, RequireGuest } from '@/components/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { MfaSetupPage } from '@/features/auth/MfaSetupPage'
import { MfaChallengePage } from '@/features/auth/MfaChallengePage'
import { TenantDetailPage } from '@/features/tenants/TenantDetailPage'
import { MetricsPage } from '@/features/metrics/MetricsPage'
import { AuditLogPage } from '@/features/audit/AuditLogPage'
import { PlatformUsersPage } from '@/features/platform-users/PlatformUsersPage'
import { LocalLicensesPage } from '@/features/local-licenses/LocalLicensesPage'
import { CustomerOnboardPage } from '@/features/customers/CustomerOnboardPage'
import { CatalogProductsPage } from '@/features/customers/CatalogProductsPage'
import { GymsPage } from '@/features/gyms/GymsPage'
import { PlansPage } from '@/features/plans/PlansPage'
import { isAdmin, isOpsOrAbove, isSalesOrAbove, isSupportOrAbove } from '@/lib/platform-roles'
import { OcShell } from '@/features/operation-center/OcShell'
import { OcRequireRole } from '@/features/operation-center/OcRequireRole'
import { OverviewPage } from '@/features/operation-center/pages/OverviewPage'
// Phase 4–5 mount-reuse: legacy GymsPage + TenantDetailPage under OC routes.
// Former OC-native gym list / cloud detail pages stay in tree for later cleanup.
import { LocalGymDetailPage } from '@/features/operation-center/pages/LocalGymDetailPage'
import { UnlinkedLicensePage } from '@/features/operation-center/pages/UnlinkedLicensePage'
import { LocalLicenseRedirect } from '@/features/operation-center/pages/LocalLicenseRedirect'
import { SalesPage } from '@/features/operation-center/pages/SalesPage'
import { FeedbackInboxPage, PlaybookDetailPage, PlaybooksPage, RiskPage, SupportPage } from '@/features/operation-center/pages/SupportPage'
import { TicketDetailPage } from '@/features/operation-center/pages/TicketDetailPage'
import {
  SalesContractTermsPage,
  SettingsPage as OcSettingsPage,
} from '@/features/operation-center/pages/SettingsPage'
import { IssueLicensePage } from '@/features/operation-center/pages/IssueLicensePage'

function RedirectToLocalGym() {
  const { id = '' } = useParams()
  return <Navigate to={`/oc/gyms/local/${id}`} replace />
}

function RedirectToCloudGym() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const qs = params.toString()
  return <Navigate to={`/oc/gyms/cloud/${id}${qs ? `?${qs}` : ''}`} replace />
}

function RedirectToOcPlaybook() {
  const { id = '' } = useParams()
  return <Navigate to={`/oc/support/playbooks/${id}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route path="/mfa-setup" element={<MfaSetupPage />} />
      <Route path="/mfa-challenge" element={<MfaChallengePage />} />

      <Route
        path="/oc"
        element={
          <RequireAuth>
            <OcShell />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        {/* Phase 4: mount-reuse GymsPage (legacy) for attention tiles + Cloud filters */}
        <Route path="gyms" element={<GymsPage />} />
        <Route path="gyms/local/:id" element={<LocalGymDetailPage />} />
        <Route path="gyms/licenses/:id" element={<UnlinkedLicensePage />} />
        <Route
          path="gyms/cloud/:id"
          element={
            <OcRequireRole allow={isSupportOrAbove}>
              {/* Phase 5: mount-reuse TenantDetailPage for full Cloud Gym360 panels */}
              <TenantDetailPage />
            </OcRequireRole>
          }
        />
        <Route
          path="sales"
          element={
            <OcRequireRole allow={isSalesOrAbove}>
              <SalesPage />
            </OcRequireRole>
          }
        />
        <Route
          path="sales/onboard"
          element={
            <OcRequireRole allow={isSalesOrAbove}>
              <CustomerOnboardPage />
            </OcRequireRole>
          }
        />
        <Route path="support" element={<SupportPage />} />
        <Route
          path="support/feedback"
          element={
            <OcRequireRole allow={isSupportOrAbove}>
              <FeedbackInboxPage />
            </OcRequireRole>
          }
        />
        <Route
          path="support/risk"
          element={
            <OcRequireRole allow={isSupportOrAbove}>
              <RiskPage />
            </OcRequireRole>
          }
        />
        <Route path="support/playbooks" element={<PlaybooksPage />} />
        <Route path="support/playbooks/:id" element={<PlaybookDetailPage />} />
        <Route path="support/tickets/:id" element={<TicketDetailPage />} />
        <Route path="settings" element={<OcSettingsPage />} />
        <Route
          path="settings/users"
          element={
            <OcRequireRole allow={isAdmin}>
              <PlatformUsersPage />
            </OcRequireRole>
          }
        />
        <Route path="settings/plans" element={<PlansPage />} />
        <Route path="settings/catalog" element={<CatalogProductsPage />} />
        <Route
          path="settings/sales-contract-terms"
          element={
            <OcRequireRole allow={isAdmin}>
              <SalesContractTermsPage />
            </OcRequireRole>
          }
        />
        <Route path="settings/metrics" element={<MetricsPage />} />
        <Route
          path="settings/audit"
          element={
            <OcRequireRole allow={isSupportOrAbove}>
              <AuditLogPage />
            </OcRequireRole>
          }
        />
        <Route
          path="settings/licenses"
          element={
            <OcRequireRole allow={isOpsOrAbove}>
              <IssueLicensePage />
            </OcRequireRole>
          }
        />
        <Route
          path="settings/licenses/manage"
          element={
            <OcRequireRole allow={isOpsOrAbove}>
              <LocalLicensesPage />
            </OcRequireRole>
          }
        />
      </Route>

      {/* Phase 3–5 cutover redirects — standalone Navigate routes (no legacy shell chrome) */}
      <Route path="/gyms" element={<Navigate to="/oc/gyms" replace />} />
      <Route path="/settings" element={<Navigate to="/oc/settings" replace />} />
      <Route path="/settings/users" element={<Navigate to="/oc/settings/users" replace />} />
      <Route path="/settings/plans" element={<Navigate to="/oc/settings/plans" replace />} />
      <Route path="/settings/catalog" element={<Navigate to="/oc/settings/catalog" replace />} />
      <Route path="/settings/metrics" element={<Navigate to="/oc/settings/metrics" replace />} />
      <Route path="/settings/audit" element={<Navigate to="/oc/settings/audit" replace />} />
      <Route path="/settings/licenses" element={<Navigate to="/oc/settings/licenses/manage" replace />} />
      <Route
        path="/tenants/:id"
        element={
          <RequireAuth>
            <RedirectToCloudGym />
          </RequireAuth>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <RequireAuth>
            <RedirectToLocalGym />
          </RequireAuth>
        }
      />
      <Route
        path="/local-licenses/:id"
        element={
          <RequireAuth>
            <LocalLicenseRedirect />
          </RequireAuth>
        }
      />
      <Route path="/sales/onboard" element={<Navigate to="/oc/sales/onboard" replace />} />
      <Route path="/support" element={<Navigate to="/oc/support" replace />} />
      <Route path="/support-tickets" element={<Navigate to="/oc/support" replace />} />
      <Route path="/ops-playbooks" element={<Navigate to="/oc/support/playbooks" replace />} />
      <Route
        path="/ops-playbooks/:id"
        element={
          <RequireAuth>
            <RedirectToOcPlaybook />
          </RequireAuth>
        }
      />
      <Route path="/overview" element={<Navigate to="/oc" replace />} />
      <Route path="/sales" element={<Navigate to="/oc/sales" replace />} />
      <Route path="/tenants" element={<Navigate to="/oc/gyms?mode=cloud" replace />} />
      <Route path="/trials" element={<Navigate to="/oc/gyms?mode=cloud&status=trialing" replace />} />
      <Route path="/subscriptions" element={<Navigate to="/oc/gyms?mode=cloud" replace />} />
      <Route path="/risk-queue" element={<Navigate to="/oc/support/risk" replace />} />
      <Route path="/metrics" element={<Navigate to="/oc/settings/metrics" replace />} />
      <Route path="/usage" element={<Navigate to="/oc/gyms" replace />} />
      <Route path="/plans" element={<Navigate to="/oc/settings/plans" replace />} />
      <Route path="/customers" element={<Navigate to="/oc/gyms" replace />} />
      <Route path="/customers/onboard" element={<Navigate to="/oc/sales/onboard" replace />} />
      <Route path="/contracts" element={<Navigate to="/oc/gyms" replace />} />
      <Route path="/payments" element={<Navigate to="/oc/gyms" replace />} />
      <Route path="/catalog-products" element={<Navigate to="/oc/settings/catalog" replace />} />
      <Route path="/audit" element={<Navigate to="/oc/settings/audit" replace />} />
      <Route path="/platform-users" element={<Navigate to="/oc/settings/users" replace />} />
      <Route path="/local-licenses" element={<Navigate to="/oc/gyms?filter=unlinked" replace />} />

      <Route path="/" element={<Navigate to="/oc" replace />} />
      <Route path="*" element={<Navigate to="/oc" replace />} />
    </Routes>
  )
}
