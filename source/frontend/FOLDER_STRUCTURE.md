# HyMotion — Frontend Folder Structure

> **Platform:** Web (React/Vue/Next) + Flutter | **Theme:** Deep Charcoal & Electric Lime
> **Bilingual:** English + Arabic (RTL) | **Auth:** JWT + OTP

---

## Overview

```
HyMotion-frontend/
|
├── apps/
│   ├── web/                          # Web Frontend (React/Next.js/Vue)
│   └── mobile/                       # Flutter Mobile App
│
├── packages/
│   ├── design-tokens/                # Shared design tokens (JSON/SCSS/Dart)
│   ├── ui-components/                # Shared UI primitives (Storybook)
│   └── api-client/                   # Auto-generated API client (OpenAPI)
│
├── assets/
│   ├── icons/                        # SVG icon library
│   ├── illustrations/                # Brand illustrations
│   ├── animations/                   # Lottie/JSON animations
│   └── fonts/                        # Space Grotesk + IBM Plex Sans (+ Arabic)
│
└── tools/
    ├── figma-sync/                   # Token sync from Figma
    └── icon-build/                   # SVG sprite/icon font builder
```

---

## 1. Web Application (`apps/web/`)

```
apps/web/
|
├── public/
│   ├── favicon.ico
│   ├── manifest.json
│   ├── robots.txt
│   ├── qr-posters/                 # Gym QR code posters per tenant
│   └── uploads/                    # Member photos, gym logos
│
├── src/
│   ├── app/                        # App Router (Next.js) / Main App
│   │   ├── layout.tsx              # Root layout with ThemeProvider
│   │   ├── page.tsx                # Landing / Login page
│   │   ├── loading.tsx             # Global loading (skeleton)
│   │   └── error.tsx               # Global error boundary
│   │
│   ├── app/(dashboard)/            # Dashboard layout group
│   │   ├── layout.tsx              # Dashboard shell (sidebar + header)
│   │   ├── page.tsx                # Dashboard overview (KPIs)
│   │   │
│   │   ├── members/
│   │   │   ├── page.tsx            # Members list with search/filter
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx        # Member detail view
│   │   │   │   └── edit/page.tsx   # Edit member form
│   │   │   └── create/page.tsx     # Add new member form
│   │   │
│   │   ├── memberships/
│   │   │   ├── page.tsx            # Active memberships list
│   │   │   └── [memberId]/
│   │   │       ├── page.tsx        # Membership details
│   │   │       ├── assign/page.tsx # Assign new membership
│   │   │       ├── renew/page.tsx  # Renew membership
│   │   │       └── freeze/page.tsx # Freeze/unfreeze membership
│   │   │
│   │   ├── plans/
│   │   │   ├── page.tsx            # Membership plans list
│   │   │   ├── [id]/page.tsx       # Plan detail
│   │   │   └── create/page.tsx     # Create plan (Owner only)
│   │   │
│   │   ├── attendance/
│   │   │   ├── page.tsx            # Today's attendance live view
│   │   │   ├── manual-checkin/     # Staff manual check-in UI
│   │   │   └── history/
│   │   │       └── page.tsx        # Attendance history
│   │   │
│   │   ├── staff/
│   │   │   ├── page.tsx            # Staff management (Owner only)
│   │   │   ├── [id]/page.tsx       # Staff detail
│   │   │   └── create/page.tsx     # Create staff user
│   │   │
│   │   ├── reports/
│   │   │   ├── page.tsx            # Reports landing
│   │   │   ├── revenue/page.tsx    # Revenue detail report
│   │   │   ├── attendance/page.tsx # Attendance summary report
│   │   │   └── peak-hours/page.tsx # Peak hours analysis
│   │   │
│   │   ├── analytics/
│   │   │   ├── page.tsx            # Analytics dashboard (charts)
│   │   │   └── heatmap/page.tsx    # Attendance heatmap (7x24)
│   │   │
│   │   ├── notifications/
│   │   │   ├── page.tsx            # Notification inbox
│   │   │   └── send-bulk/page.tsx  # Bulk notification sender
│   │   │
│   │   ├── invitations/
│   │   │   └── page.tsx            # Invitation history (Member view)
│   │   │
│   │   └── settings/
│   │       ├── page.tsx            # Tenant/Gym settings
│   │       ├── profile/page.tsx    # User profile
│   │       └── qr-poster/page.tsx  # QR poster download
│   │
│   ├── app/auth/
│   │   ├── login/page.tsx          # Staff login (email+password)
│   │   └── member/
│   │       ├── otp/page.tsx        # Member OTP request
│   │       └── verify/page.tsx     # OTP verification
│   │
│   ├── components/
│   │   ├── ui/                     # Primitive UI Components (shadcn/radix)
│   │   │   ├── button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── Button.stories.tsx
│   │   │   ├── input/
│   │   │   ├── select/
│   │   │   ├── dialog/
│   │   │   ├── dropdown-menu/
│   │   │   ├── table/
│   │   │   ├── tabs/
│   │   │   ├── card/
│   │   │   ├── badge/
│   │   │   ├── avatar/
│   │   │   ├── toast/
│   │   │   ├── skeleton/
│   │   │   ├── progress/
│   │   │   ├── tooltip/
│   │   │   ├── popover/
│   │   │   └── form/
│   │   │
│   │   ├── composite/              # Domain-specific composite components
│   │   │   ├── stat-card/
│   │   │   │   └── StatCard.tsx    # KPI stat card (active members, revenue)
│   │   │   ├── member-card/
│   │   │   │   └── MemberCard.tsx  # Member info card with avatar + badge
│   │   │   ├── membership-card/
│   │   │   │   └── MembershipCard.tsx  # Plan + progress + remaining days
│   │   │   ├── attendance-row/
│   │   │   ├── member-search/
│   │   │   ├── checkin-status/
│   │   │   ├── revenue-chart/
│   │   │   ├── status-pie-chart/
│   │   │   ├── invitation-funnel/
│   │   │   └── plan-list-item/
│   │   │
│   │   └── layout/                 # Layout-level components
│   │       ├── sidebar/
│   │       │   ├── Sidebar.tsx     # Web sidebar navigation
│   │       │   ├── SidebarItem.tsx
│   │       │   └── SidebarFooter.tsx
│   │       ├── topbar/
│   │       │   └── Topbar.tsx      # Top bar with gym name, lang toggle
│   │       ├── mobile-nav/
│   │       │   └── MobileNav.tsx   # Bottom tab bar (mobile web)
│   │       ├── theme-toggle/
│   │       └── lang-switcher/
│   │           └── LangSwitcher.tsx # EN/AR toggle with RTL
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── use-auth.ts             # Auth state + JWT refresh
│   │   ├── use-members.ts          # Member CRUD operations
│   │   ├── use-memberships.ts      # Membership assign/renew/freeze
│   │   ├── use-attendance.ts       # Attendance real-time + history
│   │   ├── use-analytics.ts        # Dashboard KPIs + charts
│   │   ├── use-plans.ts            # Membership plan CRUD
│   │   ├── use-staff.ts            # Staff management (Owner)
│   │   ├── use-notifications.ts    # Notifications + bulk send
│   │   ├── use-invitations.ts      # Guest invitation flow
│   │   ├── use-tenant.ts           # Tenant/gym settings
│   │   ├── use-localization.ts     # i18n + RTL direction
│   │   ├── use-theme.ts            # Light/dark mode
│   │   ├── use-media-query.ts      # Responsive breakpoints
│   │   └── use-signalr.ts          # Real-time attendance hub
│   │
│   ├── providers/                  # Context/Provider components
│   │   ├── theme-provider.tsx      # Light/Dark mode context
│   │   ├── auth-provider.tsx       # JWT + refresh token flow
│   │   ├── locale-provider.tsx     # i18n (EN/AR) + RTL
│   │   ├── query-provider.tsx      # TanStack Query / SWR
│   │   └── toast-provider.tsx      # Toast notification system
│   │
│   ├── lib/                        # Utilities & configurations
│   │   ├── api-client.ts           # Axios/fetch instance with interceptors
│   │   ├── signalr-client.ts       # SignalR hub connection manager
│   │   ├── i18n/
│   │   │   ├── config.ts           # i18next initialization
│   │   │   ├── en.json             # English translations
│   │   │   └── ar.json             # Arabic translations
│   │   ├── utils/
│   │   │   ├── cn.ts               # clsx + tailwind-merge
│   │   │   ├── date.ts             # DateOnly / TimeOnly formatters
│   │   │   ├── currency.ts         # EGP formatting
│   │   │   ├── localization.ts     # getLocalizedField(name, nameAr)
│   │   │   └── validation.ts       # Form validation schemas (zod/yup)
│   │   └── constants/
│   │       ├── roles.ts            # Role enum values
│   │       ├── membership-status.ts
│   │       ├── plan-types.ts
│   │       ├── payment-methods.ts
│   │       └── manual-checkin-reasons.ts
│   │
│   ├── styles/
│   │   ├── globals.css             # Global styles + font imports
│   │   ├── theme.css               # CSS custom properties (light/dark)
│   │   └── animations.css          # Keyframes (slide, shimmer, fade)
│   │
│   └── types/                      # TypeScript type definitions
│       ├── auth.ts                 # LoginRequest, LoginResponse, UserInfo
│       ├── member.ts               # MemberDetailDto, MemberListItemDto
│       ├── membership.ts           # MembershipDto, AssignRequest
│       ├── plan.ts                 # PlanDetailDto, PlanListItemDto
│       ├── attendance.ts           # TodayAttendanceDto, QrCheckinResponse
│       ├── staff.ts                # StaffDetailDto, StaffListItemDto
│       ├── analytics.ts            # DashboardOverviewDto, RevenueChartDto
│       ├── notification.ts         # NotificationDto
│       ├── invitation.ts           # SendInvitationResponse
│       ├── tenant.ts               # TenantSettingsDto
│       └── enums.ts                # All API enum values
│
├── tests/
│   ├── e2e/                        # Playwright/Cypress tests
│   │   ├── auth.spec.ts
│   │   ├── members.spec.ts
│   │   └── checkin.spec.ts
│   └── fixtures/
│
├── .env.local
├── .env.production
├── next.config.js                  # or vite.config.ts / vue.config.js
├── tailwind.config.ts              # Uses design tokens
├── tsconfig.json
└── package.json
```

---

## 2. Flutter Application (`apps/mobile/`)

```
apps/mobile/
|
├── android/                        # Android-specific config
│   └── app/
│       └── src/
│           └── main/
│               └── AndroidManifest.xml
│
├── ios/                            # iOS-specific config
│   └── Runner/
│       └── Info.plist
│
├── lib/
│   ├── main.dart                   # App entry point
│   ├── app.dart                    # MaterialApp with theme + locale
│   ├── config/
│   │   ├── router.dart             # GoRouter / AutoRoute configuration
│   │   ├── di.dart                 # GetIt dependency injection
│   │   └── env.dart                # Environment variables (dev/prod)
│   │
│   ├── core/                       # Core utilities & base classes
│   │   ├── theme/
│   │   │   ├── app_theme.dart      # ThemeData for light + dark
│   │   │   ├── app_colors.dart     # Charcoal + Lime + Teal + Semantic
│   │   │   ├── app_typography.dart # Space Grotesk + IBM Plex Sans
│   │   │   ├── app_shadows.dart    # 5 elevation levels + glow
│   │   │   └── app_spacing.dart    # 4px base spacing scale
│   │   │
│   │   ├── network/
│   │   │   ├── dio_client.dart     # Dio instance with interceptors
│   │   │   ├── auth_interceptor.dart
│   │   │   ├── refresh_interceptor.dart
│   │   │   ├── error_interceptor.dart
│   │   │   └── signalr_service.dart # Real-time attendance hub
│   │   │
│   │   ├── storage/
│   │   │   ├── secure_storage.dart # flutter_secure_storage wrapper
│   │   │   └── local_storage.dart  # SharedPreferences wrapper
│   │   │
│   │   ├── localization/
│   │   │   ├── app_localizations.dart
│   │   │   ├── l10n/
│   │   │   │   ├── app_en.arb      # English translations
│   │   │   │   └── app_ar.arb      # Arabic translations
│   │   │   └── locale_helper.dart  # getLocalizedField(), RTL
│   │   │
│   │   ├── widgets/
│   │   │   ├── app_button.dart     # Primary / Secondary / Ghost / Danger
│   │   │   ├── app_input.dart      # TextField with validation + RTL
│   │   │   ├── app_card.dart       # Stat card / Member card / Plan card
│   │   │   ├── app_badge.dart      # Status badges (active/expired/frozen)
│   │   │   ├── app_avatar.dart     # Initials fallback + role dot
│   │   │   ├── app_skeleton.dart   # Shimmer loading skeletons
│   │   │   ├── app_toast.dart      # Success/Warning/Danger/Info toasts
│   │   │   └── app_bottom_nav.dart # Mobile bottom navigation
│   │   │
│   │   └── utils/
│   │       ├── date_formatter.dart
│   │       ├── currency_formatter.dart
│   │       ├── validators.dart
│   │       └── extensions/
│   │           ├── context_ext.dart
│   │           ├── string_ext.dart
│   │           └── date_ext.dart
│   │
│   ├── features/                   # Feature-first architecture
│   │   │
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── login_request.dart
│   │   │   │   │   ├── login_response.dart
│   │   │   │   │   ├── member_otp_request.dart
│   │   │   │   │   └── member_otp_verify_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository.dart
│   │   │   ├── domain/
│   │   │   │   └── entities/
│   │   │   │       └── user_info.dart
│   │   │   └── presentation/
│   │   │       ├── bloc/
│   │   │       │   ├── auth_bloc.dart
│   │   │       │   ├── auth_event.dart
│   │   │       │   └── auth_state.dart
│   │   │       ├── screens/
│   │   │       │   ├── staff_login_screen.dart
│   │   │       │   ├── member_otp_screen.dart
│   │   │       │   └── member_verify_screen.dart
│   │   │       └── widgets/
│   │   │
│   │   ├── dashboard/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   └── dashboard_overview_dto.dart
│   │   │   │   └── repositories/
│   │   │   │       └── analytics_repository.dart
│   │   │   ├── domain/
│   │   │   │   └── entities/
│   │   │   │       └── dashboard_kpi.dart
│   │   │   └── presentation/
│   │   │       ├── bloc/
│   │   │       │   └── dashboard_bloc.dart
│   │   │       ├── screens/
│   │   │       │   └── dashboard_screen.dart
│   │   │       └── widgets/
│   │   │           ├── kpi_grid.dart
│   │   │           ├── revenue_chart.dart
│   │   │           ├── status_pie_chart.dart
│   │   │           ├── attendance_heatmap.dart
│   │   │           └── invitation_funnel.dart
│   │   │
│   │   ├── members/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── member_detail_dto.dart
│   │   │   │   │   ├── member_list_item_dto.dart
│   │   │   │   │   ├── create_member_request.dart
│   │   │   │   │   └── update_member_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── members_repository.dart
│   │   │   ├── domain/
│   │   │   │   └── entities/
│   │   │   │       └── member.dart
│   │   │   └── presentation/
│   │   │       ├── bloc/
│   │   │       ├── screens/
│   │   │       │   ├── members_list_screen.dart
│   │   │       │   ├── member_detail_screen.dart
│   │   │       │   ├── create_member_screen.dart
│   │   │       │   └── edit_member_screen.dart
│   │   │       └── widgets/
│   │   │           ├── member_list_tile.dart
│   │   │           ├── member_search_bar.dart
│   │   │           ├── member_status_filter.dart
│   │   │           └── member_info_card.dart
│   │   │
│   │   ├── memberships/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── membership_dto.dart
│   │   │   │   │   ├── assign_membership_request.dart
│   │   │   │   │   ├── renew_membership_request.dart
│   │   │   │   │   └── freeze_membership_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── memberships_repository.dart
│   │   │   └── presentation/
│   │   │       ├── bloc/
│   │   │       ├── screens/
│   │   │       │   ├── membership_detail_screen.dart
│   │   │       │   ├── assign_membership_screen.dart
│   │   │       │   ├── renew_membership_screen.dart
│   │   │       │   └── freeze_membership_screen.dart
│   │   │       └── widgets/
│   │   │           ├── membership_card.dart
│   │   │           ├── plan_selector.dart
│   │   │           ├── payment_method_selector.dart
│   │   │           └── days_remaining_bar.dart
│   │   │
│   │   ├── attendance/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── qr_checkin_request.dart
│   │   │   │   │   ├── qr_checkin_response.dart
│   │   │   │   │   ├── manual_checkin_request.dart
│   │   │   │   │   ├── today_attendance_dto.dart
│   │   │   │   │   └── member_search_result.dart
│   │   │   │   └── repositories/
│   │   │   │       └── attendance_repository.dart
│   │   │   └── presentation/
│   │   │       ├── bloc/
│   │   │       ├── screens/
│   │   │       │   ├── qr_checkin_screen.dart        # Member QR scan
│   │   │       │   ├── manual_checkin_screen.dart     # Staff manual checkin
│   │   │       │   ├── checkin_success_screen.dart
│   │   │       │   └── today_attendance_screen.dart   # Live dashboard
│   │   │       └── widgets/
│   │   │           ├── qr_scanner_view.dart
│   │   │           ├── checkin_success_animation.dart
│   │   │           ├── attendance_list_tile.dart
│   │   │           └── member_search_delegate.dart
│   │   │
│   │   ├── plans/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── plan_detail_dto.dart
│   │   │   │   │   ├── plan_list_item_dto.dart
│   │   │   │   │   ├── create_plan_request.dart
│   │   │   │   │   └── update_plan_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── plans_repository.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── plans_list_screen.dart
│   │   │       │   ├── plan_detail_screen.dart
│   │   │       │   └── create_plan_screen.dart
│   │   │       └── widgets/
│   │   │           ├── plan_list_tile.dart
│   │   │           └── plan_type_badge.dart
│   │   │
│   │   ├── notifications/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── notification_dto.dart
│   │   │   │   │   └── send_bulk_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── notifications_repository.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── notifications_screen.dart
│   │   │       │   └── send_bulk_screen.dart
│   │   │       └── widgets/
│   │   │           ├── notification_tile.dart
│   │   │           └── unread_badge.dart
│   │   │
│   │   ├── invitations/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── send_invitation_request.dart
│   │   │   │   │   └── invitation_history_response.dart
│   │   │   │   └── repositories/
│   │   │   │       └── invitations_repository.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── send_invitation_screen.dart
│   │   │       │   └── invitation_history_screen.dart
│   │   │       └── widgets/
│   │   │           ├── quota_indicator.dart
│   │   │           └── invitation_list_tile.dart
│   │   │
│   │   ├── staff/
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── staff_detail_dto.dart
│   │   │   │   │   ├── create_staff_request.dart
│   │   │   │   │   └── update_staff_request.dart
│   │   │   │   └── repositories/
│   │   │   │       └── staff_repository.dart
│   │   │   └── presentation/
│   │   │       ├── screens/
│   │   │       │   ├── staff_list_screen.dart
│   │   │       │   ├── staff_detail_screen.dart
│   │   │       │   └── create_staff_screen.dart
│   │   │       └── widgets/
│   │   │           └── staff_list_tile.dart
│   │   │
│   │   └── settings/
│   │       ├── data/
│   │       │   ├── models/
│   │       │   │   ├── tenant_settings_dto.dart
│   │       │   │   └── update_settings_request.dart
│   │       │   └── repositories/
│   │       │       └── settings_repository.dart
│   │       └── presentation/
│   │           ├── screens/
│   │           │   └── settings_screen.dart
│   │           └── widgets/
│   │               ├── gym_info_card.dart
│   │               └── qr_poster_card.dart
│   │
│   └── shared/                     # Shared across features
│       ├── enums/
│       │   ├── membership_status.dart   # active, pending, expired, frozen, cancelled
│       │   ├── plan_type.dart           # monthly_unlimited, session_pack, etc.
│       │   ├── payment_method.dart      # cash, paymob, fawry, vodafone_cash
│       │   ├── entry_method.dart        # qr, manual
│       │   ├── role.dart                # Owner, Manager, Trainer, Member
│       │   ├── manual_checkin_reason.dart
│       │   ├── invitation_status.dart   # sent, visited, converted, expired
│       │   └── notification_channel.dart
│       │
│       ├── models/
│       │   └── pagination.dart          # PaginatedList<T> wrapper
│       │
│       └── widgets/
│           ├── responsive_layout.dart   # Adaptive mobile/tablet/desktop
│           ├── empty_state.dart
│           ├── error_state.dart
│           ├── loading_state.dart
│           └── pull_to_refresh.dart
│
├── assets/
│   ├── images/
│   │   ├── logo.png
│   │   ├── logo_dark.png
│   │   └── qr_poster_placeholder.png
│   ├── fonts/
│   │   ├── SpaceGrotesk-Regular.ttf
│   │   ├── SpaceGrotesk-Medium.ttf
│   │   ├── SpaceGrotesk-SemiBold.ttf
│   │   ├── SpaceGrotesk-Bold.ttf
│   │   ├── IBMPlexSans-Regular.ttf
│   │   ├── IBMPlexSans-Medium.ttf
│   │   ├── IBMPlexSans-SemiBold.ttf
│   │   ├── IBMPlexSans-Bold.ttf
│   │   ├── IBMPlexSansArabic-Regular.ttf
│   │   ├── IBMPlexSansArabic-Medium.ttf
│   │   ├── IBMPlexSansArabic-SemiBold.ttf
│   │   └── IBMPlexSansArabic-Bold.ttf
│   └── animations/
│       └── checkin_success.json     # Lottie animation
│
├── test/
│   ├── unit/
│   │   ├── auth_bloc_test.dart
│   │   ├── validators_test.dart
│   │   └── localization_test.dart
│   ├── widget/
│   │   ├── login_screen_test.dart
│   │   ├── member_list_test.dart
│   │   └── checkin_flow_test.dart
│   └── integration/
│       └── full_flow_test.dart
│
├── pubspec.yaml
├── analysis_options.yaml
└── android/build.gradle
```

---

## 3. Shared Packages (`packages/`)

```
packages/
|
├── design-tokens/
│   ├── src/
│   │   ├── tokens/
│   │   │   └── tokens.json         # Source of truth (from design-tokens.json)
│   │   ├── css/
│   │   │   ├── variables.css       # CSS custom properties
│   │   │   └── dark-mode.css       # Dark theme overrides
│   │   ├── scss/
│   │   │   ├── _colors.scss
│   │   │   ├── _typography.scss
│   │   │   ├── _spacing.scss
│   │   │   ├── _shadows.scss
│   │   │   ├── _radius.scss
│   │   │   └── _transitions.scss
│   │   └── dart/
│   │       └── design_tokens.dart   # Dart constants for Flutter
│   ├── build.js                    # Token transformer (Style Dictionary)
│   └── package.json
│
├── ui-components/                  # Optional: shared web UI lib
│   ├── src/
│   │   ├── button/
│   │   ├── input/
│   │   ├── card/
│   │   ├── badge/
│   │   ├── avatar/
│   │   ├── toast/
│   │   └── skeleton/
│   ├── storybook/
│   └── package.json
│
└── api-client/                     # Auto-generated from Swagger/OpenAPI
    ├── src/
    │   ├── web/                    # Generated TypeScript client
    │   │   └── index.ts
    │   └── dart/                   # Generated Dart client
    │       └── api_client.dart
    └── openapi.yaml                # API spec for generation
```

---

## 4. Assets (`assets/`)

```
assets/
├── icons/
│   ├── outline/                    # 24px stroke icons
│   ├── solid/                      # Filled icons
│   └── brand/                      # Logo variants
├── illustrations/
│   ├── empty-state.svg
│   ├── no-members.svg
│   ├── no-results.svg
│   └── checkin-success.svg
├── animations/
│   ├── loading-skeleton.json       # Lottie skeleton
│   ├── checkin-success.json        # Check-in confetti
│   └── notification-bell.json      # Notification pulse
└── fonts/
    ├── SpaceGrotesk/
    │   ├── SpaceGrotesk-Regular.woff2
    │   ├── SpaceGrotesk-Medium.woff2
    │   ├── SpaceGrotesk-SemiBold.woff2
    │   └── SpaceGrotesk-Bold.woff2
    ├── IBMPlexSans/
    │   ├── IBMPlexSans-Regular.woff2
    │   ├── IBMPlexSans-Medium.woff2
    │   ├── IBMPlexSans-SemiBold.woff2
    │   └── IBMPlexSans-Bold.woff2
    └── IBMPlexSansArabic/
        ├── IBMPlexSansArabic-Regular.woff2
        ├── IBMPlexSansArabic-Medium.woff2
        ├── IBMPlexSansArabic-SemiBold.woff2
        └── IBMPlexSansArabic-Bold.woff2
```

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Monorepo** (`apps/` + `packages/`) | Shared tokens, types, and logic across Web + Flutter |
| **Feature-first (Flutter)** | Each domain (members, attendance...) is self-contained with its own data/domain/presentation layers |
| **App Router file-based routing (Web)** | Matches the API domain structure (dashboard, members, plans...) |
| **Clean Architecture layers** | Clear separation: data → domain → presentation with repositories and BLoC |
| **Shared design tokens package** | Single source of truth for colors, spacing, radius, shadows, typography |
| **Auto-generated API client** | Sync API changes automatically from Swagger/OpenAPI spec |
| **Bilingual first** | Every screen, DTO, and component handles EN/AR from the start |
| **RTL built-in** | Layout direction adapts automatically based on locale |
| **Theme toggle** | Light/dark mode at the provider level with CSS variables / Flutter ThemeData |
| **SignalR for real-time** | Live attendance dashboard updates without polling |
| **JWT interceptor pattern** | Automatic token refresh on 401, seamless retry |

---

## Mapping: API Domains → Frontend Features

| API Domain | Web Route | Flutter Feature | Key Screens |
|---|---|---|---|
| `Auth` | `/auth/*` | `features/auth/` | Login, OTP, Verify |
| `Members` | `/members/*` | `features/members/` | List, Detail, Create, Edit |
| `Memberships` | `/memberships/*` | `features/memberships/` | Assign, Renew, Freeze, Detail |
| `Membership Plans` | `/plans/*` | `features/plans/` | List, Detail, Create (Owner) |
| `Attendance` | `/attendance/*` | `features/attendance/` | QR Check-in, Manual, Today |
| `Admin / Staff` | `/staff/*` | `features/staff/` | List, Detail, Create (Owner) |
| `Tenant Settings` | `/settings/*` | `features/settings/` | Gym info, QR poster |
| `Notifications` | `/notifications/*` | `features/notifications/` | Inbox, Bulk send |
| `Invitations` | `/invitations` | `features/invitations/` | Send, History (Member) |
| `Analytics` | `/analytics/*` | `features/dashboard/` | KPIs, Charts, Heatmap |
| `Reports` | `/reports/*` | (Part of dashboard) | Revenue, Attendance, Peak hours |
