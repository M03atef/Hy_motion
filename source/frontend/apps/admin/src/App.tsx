import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAccess } from '@/components/RequireAccess'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { MemberOtpStubPage } from '@/features/auth/MemberOtpStubPage'
import { StaffLoginPage } from '@/features/auth/StaffLoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MembersListPage } from '@/features/members/MembersListPage'
import { MemberDetailPage } from '@/features/members/MemberDetailPage'
import { MemberFormPage } from '@/features/members/MemberFormPage'
import { AppShell } from '@/layout/AppShell'
import { useAuthStore } from '@/stores/auth-store'

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<StaffLoginPage />} />
      <Route path="/member-otp" element={<MemberOtpStubPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route
          path="members"
          element={
            <RequireAccess permission="members.view">
              <MembersListPage />
            </RequireAccess>
          }
        />
        <Route
          path="members/new"
          element={
            <RequireAccess permission="members.create">
              <MemberFormPage mode="create" />
            </RequireAccess>
          }
        />
        <Route
          path="members/:id"
          element={
            <RequireAccess permission="members.view">
              <MemberDetailPage />
            </RequireAccess>
          }
        />
        <Route
          path="members/:id/edit"
          element={
            <RequireAccess permission="members.edit">
              <MemberFormPage mode="edit" />
            </RequireAccess>
          }
        />
        <Route
          path="attendance"
          element={
            <RequireAccess permission={['checkin.manual', 'members.view']}>
              <PlaceholderPage titleEn="Attendance" titleAr="الحضور" />
            </RequireAccess>
          }
        />
        <Route
          path="sales"
          element={
            <RequireAccess permission="sales.sell" featureModule="sales">
              <PlaceholderPage titleEn="Sell" titleAr="بيع" />
            </RequireAccess>
          }
        />
        <Route
          path="member-orders"
          element={
            <RequireAccess permission="sales.sell">
              <PlaceholderPage
                titleEn="Member Orders"
                titleAr="طلبات الأعضاء"
                hintEn="Staff fulfillment inbox lives in the web console (/dashboard/member-orders/). Admin shell is a stub until the React port ships."
                hintAr="شاشة تنفيذ طلبات الأعضاء موجودة في واجهة الويب (/dashboard/member-orders/)."
              />
            </RequireAccess>
          }
        />
        <Route path="debtors" element={<Navigate to="/app" replace />} />
        <Route path="refunds" element={<Navigate to="/app/invoices" replace />} />
        <Route
          path="call-sheet"
          element={
            <RequireAccess permission="sales.sell">
              <PlaceholderPage
                titleEn="Call Sheet"
                titleAr="ورقة المتابعة"
                hintEn="Not feature-flagged — always available when sales.sell is granted."
                hintAr="غير خاضع لعلم الميزة — متاح دائماً مع صلاحية sales.sell."
              />
            </RequireAccess>
          }
        />
        <Route
          path="shifts"
          element={
            <RequireAccess permission={['shift.open', 'shift.close']} featureModule="shifts">
              <PlaceholderPage titleEn="Shifts" titleAr="الورديات" />
            </RequireAccess>
          }
        />
        <Route
          path="plans"
          element={
            <RequireAccess permission="plans.manage">
              <PlaceholderPage titleEn="Plans" titleAr="الباقات" />
            </RequireAccess>
          }
        />
        <Route
          path="promo-codes"
          element={
            <RequireAccess permission={['sales.sell', 'plans.manage']} featureModule="sales">
              <PlaceholderPage titleEn="Promo Codes" titleAr="أكواد الخصم" />
            </RequireAccess>
          }
        />
        <Route
          path="invoices"
          element={
            <RequireAccess permission="reports.financial.view">
              <PlaceholderPage titleEn="Invoices" titleAr="الفواتير" />
            </RequireAccess>
          }
        />
        <Route
          path="reports"
          element={
            <RequireAccess permission={['reports.financial.view', 'members.view']}>
              <PlaceholderPage titleEn="Reports" titleAr="التقارير" />
            </RequireAccess>
          }
        />
        <Route
          path="imports"
          element={
            <RequireAccess permission="settings.manage" featureModule="imports">
              <PlaceholderPage titleEn="Import" titleAr="الاستيراد" />
            </RequireAccess>
          }
        />
        <Route
          path="staff"
          element={
            <RequireAccess role="OwnerOnly">
              <PlaceholderPage titleEn="Staff" titleAr="الموظفون" />
            </RequireAccess>
          }
        />
        <Route
          path="roles"
          element={
            <RequireAccess role="OwnerOnly">
              <PlaceholderPage titleEn="Roles" titleAr="الأدوار" />
            </RequireAccess>
          }
        />
        <Route
          path="settings"
          element={
            <RequireAccess role="OwnerOnly">
              <PlaceholderPage titleEn="Settings" titleAr="الإعدادات" />
            </RequireAccess>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
