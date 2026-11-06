# GMS Frontend — Comprehensive Project Analysis

## Executive Summary

**HyMotion** is a comprehensive gym management system with a modern tech stack spanning web (React/Next.js) and mobile (Flutter) platforms. The project is a monorepo containing documentation, design system specifications, shared packages, and architectural blueprints. Currently, the project is in the **design & architecture phase** with complete documentation but minimal implementation code.

---

## 1. PROJECT OVERVIEW

### Project Goals
- **Multi-platform gym management:** Web dashboard for staff/owners, mobile app for members and staff
- **Real-time attendance tracking:** QR code check-ins with live dashboard updates
- **Membership lifecycle management:** Plans, assignments, renewals, freezes
- **Revenue & analytics:** Dashboard KPIs, detailed reports, peak-hours analysis
- **Bilingual support:** Full English/Arabic UI with RTL layout adaptation
- **Secure multi-tenant architecture:** Separate gym instances with JWT-based auth

### Target Users
| User Type | Platform | Features |
|---|---|---|
| **Owner** | Web Dashboard | Staff management, plan creation, full analytics, settings |
| **Manager** | Web Dashboard | Member CRUD, membership assignment, attendance, reports |
| **Trainer** | Web + Mobile | Manual check-in, member information, attendance |
| **Member** | Mobile App + Web | Check-in via QR, membership status, invitations, profile |

---

## 2. TECHNOLOGY STACK

### Web Application
```
Framework:        Next.js 13+ with App Router (file-based routing)
Language:         TypeScript
UI Framework:     React 18+
Styling:          Tailwind CSS + CSS Custom Properties
Component Lib:    shadcn/ui (Radix UI primitives)
State Mgmt:       TanStack Query (React Query) for server state
Context:          Custom providers (Auth, Theme, Locale, Toast)
Internationalization: i18next (JSON-based translations)
Real-time:        SignalR Hub for live updates
HTTP Client:      Axios/Fetch with automatic token refresh
API Client:       Auto-generated from OpenAPI/Swagger spec
Testing:          Playwright (e2e), Jest (unit)
Build Tool:       Next.js built-in (Webpack)
```

### Mobile Application (Flutter)
```
Framework:        Flutter (latest stable)
Language:         Dart
UI Paradigm:      Material Design 3
Routing:          GoRouter or AutoRoute
State Management: BLoC (Business Logic Component) pattern
HTTP Client:      Dio with custom interceptors
Local Storage:    flutter_secure_storage (tokens) + SharedPreferences
Internationalization: Flutter localization (.arb files) + custom RTL handling
Real-time:        SignalR Hub connection
QR Scanning:      qr_flutter or mobile_scanner package
Testing:          Mockito, bloc_test, integration_test
Build System:     Flutter CLI, Gradle (Android), Xcode (iOS)
```

### Shared Packages
```
design-tokens/    → Master design tokens (colors, spacing, typography)
                     Outputs: CSS, SCSS, Dart constants
ui-components/    → Optional shared web UI library (storybook-based)
api-client/       → Auto-generated TypeScript (web) + Dart (mobile) clients
                     Generated from OpenAPI/Swagger spec
```

### Design System & Assets
```
Fonts:            Space Grotesk (display) + IBM Plex Sans (body)
                  IBM Plex Sans Arabic (Arabic text)
Icons:            SVG icons library (outline, solid, brand variants)
Illustrations:    SVG illustrations (empty states, mascots)
Animations:       Lottie JSON files (skeleton loaders, success states)
```

---

## 3. ARCHITECTURE & PATTERNS

### Web Architecture (Next.js)

#### File-Based Routing
```
apps/web/src/app/
├── page.tsx                          # Root / Landing page
├── layout.tsx                        # Root layout with providers
├── auth/                             # Authentication routes
│   ├── login/page.tsx               # Staff login
│   └── member/                      # Member auth
│       ├── otp/page.tsx            # OTP request
│       └── verify/page.tsx         # OTP verification
└── (dashboard)/                     # Private routes group
    ├── layout.tsx                  # Dashboard shell (sidebar + topbar)
    ├── page.tsx                    # Dashboard overview
    ├── members/                    # Member management
    ├── memberships/                # Membership operations
    ├── attendance/                 # Check-in tracking
    ├── plans/                      # Membership plans
    ├── analytics/                  # KPIs and charts
    ├── reports/                    # Detailed reports
    ├── notifications/              # Message inbox
    ├── staff/                      # Staff management (Owner)
    ├── settings/                   # Tenant/gym settings
    └── invitations/                # Invitation tracking
```

#### Layered Component Architecture
```
Presentation Layer (React Components)
        ↓
Custom Hooks (use-auth, use-members, etc.)
        ↓
Context Providers (Auth, Theme, Query, Toast)
        ↓
API Client Layer (Axios with interceptors)
        ↓
Backend API
```

#### Key Patterns
- **Custom Hooks:** Encapsulate feature logic (fetching, mutations, caching)
  ```typescript
  const { members, loading, search, create } = useMembers();
  const { auth, login, logout, refreshToken } = useAuth();
  ```

- **Provider Pattern:** Global state (theme, auth, locale, notifications)
  ```typescript
  <AuthProvider>
    <ThemeProvider>
      <LocaleProvider>
        <QueryProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </QueryProvider>
      </LocaleProvider>
    </ThemeProvider>
  </AuthProvider>
  ```

- **Error Boundaries:** Global + per-route error handling
  ```typescript
  // apps/web/src/app/error.tsx
  // apps/web/src/app/(dashboard)/members/error.tsx
  ```

- **Loading States:** Skeleton components + Suspense boundaries

- **Form Validation:** Zod/Yup schemas, both client & server-side validation

### Mobile Architecture (Flutter)

#### Clean Architecture + BLoC Pattern
```
Feature Folder Structure:
├── data/
│   ├── models/             # API response DTOs (auto-generated)
│   ├── repositories/       # API calls, caching, transformation
│   └── datasources/        # HTTP, local storage access
├── domain/
│   ├── entities/           # Pure business models (independent of API)
│   ├── repositories/       # Abstract repository interfaces
│   └── usecases/          # Feature-specific business logic
└── presentation/
    ├── bloc/              # State management (events → states)
    ├── screens/           # Full-page widgets (routes)
    ├── widgets/           # Reusable UI components
    └── pages/             # Page containers
```

**Example: Attendance Feature**
```
features/attendance/
├── data/
│   ├── models/
│   │   ├── qr_checkin_request.dart
│   │   ├── qr_checkin_response.dart
│   │   └── today_attendance_dto.dart
│   └── repositories/
│       └── attendance_repository.dart
├── domain/
│   ├── entities/
│   │   └── attendance_record.dart
│   └── repositories/
│       └── attendance_repository_interface.dart
└── presentation/
    ├── bloc/
    │   ├── attendance_bloc.dart
    │   ├── attendance_event.dart
    │   └── attendance_state.dart
    ├── screens/
    │   ├── qr_checkin_screen.dart
    │   ├── manual_checkin_screen.dart
    │   └── today_attendance_screen.dart
    └── widgets/
        ├── qr_scanner_view.dart
        └── attendance_list_tile.dart
```

#### State Management: BLoC Pattern
```
User Interaction (Button tap)
        ↓
BLoC.add(Event)
        ↓
BLoC processes event (calls repository)
        ↓
BLoC.emit(State)
        ↓
Widget rebuilds (via BlocBuilder/BlocListener)
```

Example flow:
```dart
// User taps check-in button
context.read<AttendanceBloC>().add(QrCheckinEvent(qrCode: code));

// BLoC processes:
// → Calls attendanceRepository.qrCheckin(code)
// → Emits AttendanceLoading()
// → On success: emit AttendanceCheckinSuccess(response)
// → On error: emit AttendanceError(message)

// Widget listens:
BlocBuilder<AttendanceBloC, AttendanceState>(
  builder: (context, state) {
    if (state is AttendanceLoading) return LoadingWidget();
    if (state is AttendanceCheckinSuccess) return SuccessScreen(state.response);
    if (state is AttendanceError) return ErrorScreen(state.message);
  },
);
```

#### Dependency Injection (GetIt)
```dart
// config/di.dart
final getIt = GetIt.instance;

void setupServiceLocator() {
  // Register singletons (HttpClient, StorageService, etc.)
  getIt.registerSingleton<DioClient>(DioClient());
  
  // Register repositories
  getIt.registerSingleton<AuthRepository>(
    AuthRepository(getIt<DioClient>()),
  );
  
  // Register BLoCs
  getIt.registerSingleton<AuthBloC>(
    AuthBloC(getIt<AuthRepository>()),
  );
}

// Usage in main.dart
void main() {
  setupServiceLocator();
  runApp(const MyApp());
}
```

---

## 4. DESIGN SYSTEM

### Color Palette

**Primary Colors:**
- **Charcoal (Primary Background):** #0D0D0D – #F0F0F0 (10-level shade scale)
- **Electric Lime (Accent):** #5EAF00 – #EDFCD8 (highlight, CTAs, active states)
- **Teal (Secondary):** #0A4D4D – #D9F2F2 (status indicators, links)

**Semantic Colors:**
| Status | Color | Use Case |
|---|---|---|
| Success | #22C55E | Active memberships, successful check-ins |
| Warning | #F59E0B | Expiring memberships, pending actions |
| Danger | #EF4444 | Errors, expired memberships, cancelled |
| Info | #3B82F6 | Informational messages |
| Frozen | #22D3EE | Frozen memberships |
| Pending | #FBBF24 | Pending payments, invitations |

**Surfaces:**
```
Light Mode:
  Background: #FAFAFA
  Surface L1: #FFFFFF
  Surface L2: #F5F5F5
  Surface L3: #EBEBEB

Dark Mode:
  Background: #0D0D0D
  Surface D1: #1A1A1A
  Surface D2: #2A2A2A
  Surface D3: #3A3A3A
```

### Typography

**Font Families:**
- **Display:** Space Grotesk (headings, CTAs, large text)
- **Body:** IBM Plex Sans (body text)
- **Arabic:** IBM Plex Sans Arabic (Arabic content with RTL support)

**Type Scale:**
| Level | Size | Weight | Use |
|---|---|---|---|
| h1 | 36px | 700 | Page titles |
| h2 | 28px | 700 | Section headers |
| h3 | 22px | 600 | Subsection headers |
| h4 | 18px | 600 | Card titles |
| h5 | 15px | 600 | Emphasis text |
| h6 | 13px | 700 | Labels (uppercase) |
| body | 14px | 400 | Standard text |
| caption | 12px | 400 | Helper text |
| label | 13px | 600 | Form labels |
| kpi | 36px | 700 | Dashboard metrics |

### Spacing System
- **Base Unit:** 4px
- **Scale:** 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 7 (28px), 8 (32px), 10 (40px), 12 (48px), 16 (64px), 20 (80px)
- **Usage:** Padding, margins, gaps follow this scale

### Component System
- **Border Radius:** 6px (sm), 10px (md), 16px (lg), 24px (xl), 9999px (pill)
- **Shadows:** 4 elevation levels + lime glow effect (0 0 20px rgba(160, 224, 64, 0.25))
- **Transitions:** 150ms fast, 250ms base, 400ms slow (ease timing function)

---

## 5. KEY FEATURES & DOMAINS

### Authentication & Authorization

**Auth Flows:**

1. **Staff Login (Email + Password)**
   ```
   POST /api/auth/login
   Request: { email, password, gymCode }
   Response: { accessToken, refreshToken, expiresAtUtc, user }
   ```
   - JWT access token valid for 15 minutes
   - Refresh token valid for 30 days (sliding rotation)
   - Token stored securely (httpOnly cookie or secure storage)

2. **Member Login (OTP via SMS)**
   ```
   POST /api/auth/member-otp
   Request: { phoneNumber, gymCode }
   → SMS sent with 6-digit OTP (5 min validity)
   
   POST /api/auth/member-verify
   Request: { phoneNumber, gymCode, otp }
   Response: { accessToken, refreshToken, user (role: Member) }
   ```
   - Auto-provisions Identity user if new
   - MFA via SMS OTP

**JWT Claims:**
```json
{
  "sub": "user-id-uuid",
  "email": "user@gym.com",
  "role": "Owner|Manager|Trainer|Member",
  "tenant_id": "gym-id-uuid",
  "member_id": "member-id-uuid (Members only)",
  "gym_code": "GYM-CAIRO-01"
}
```

**Authorization Policies:**
| Policy | Roles | Purpose |
|---|---|---|
| `OwnerOnly` | Owner | Highest privilege (staff mgmt, plan creation, analytics) |
| `ManagerOrAbove` | Owner, Manager | Management operations (member CRUD, assignments) |
| `AnyStaff` | Owner, Manager, Trainer | Staff-level access (view members, check-in) |
| `AuthenticatedMember` | Member | Member-specific operations (check-in, profile) |
| `AnyAuthenticated` | Any | Authenticated user operations |

### Members Management

**Operations:**
- **List/Search:** By name, phone, member #, status (active/expired/frozen/cancelled)
- **Create:** Auto-generates member number (MEM-001, etc.)
- **View Details:** Full profile + current membership + recent 5 attendance records
- **Update:** Partial updates (name, contact info, notes)
- **Deactivate:** Soft delete (sets IsActive = false)
- **Freeze/Unfreeze:** Suspend membership without losing progress

**Data Model:**
```typescript
interface Member {
  id: UUID;
  memberNumber: string;           // "MEM-001"
  fullName: string;
  fullNameAr: string;
  phone: string;
  email: string;
  dateOfBirth: Date;
  nationalId: string;
  profilePhotoUrl: string;
  notes: string;
  isActive: boolean;
  invitationQuotaRemaining: number;
  currentMembership: Membership;
  recentAttendance: Attendance[];
  createdAtUtc: DateTime;
}
```

### Memberships

**Plan Types:**

| Type | Duration | Use Case | Special Fields |
|---|---|---|---|
| **Monthly Unlimited** | 30 days | Full gym access for month | — |
| **Session Pack** | 90 days | Fixed number of visits | SessionCount (10, 20, 50) |
| **Time Limited** | Variable | Peak/off-peak restrictions | TimeStart, TimeEnd |
| **PT Credits** | Variable | Personal training sessions | CreditAmount |
| **Family** | 30+ days | Multi-user + guest invites | InvitationQuota (3–5) |

**Membership Lifecycle:**
```
1. ASSIGN
   ├─ Choose plan
   ├─ Select payment method (cash/card/mobile)
   └─ Status: active (cash) or pending (online payment)

2. Active Usage
   ├─ QR check-ins tracked
   ├─ Sessions decremented (if session-based)
   ├─ Expiry countdown displayed

3. Actions During Active
   ├─ RENEW: Continue with same/new plan
   ├─ FREEZE: Pause temporarily, extend end date
   ├─ CANCEL: Stop membership

4. Post-Expiry
   ├─ Expired status
   ├─ Can renew
   └─ No check-in access
```

**Payment Methods:**
- **Cash:** Instant activation
- **Paymob/Fawry:** Webhook-based activation on payment confirmation
- **Vodafone Cash:** USSD-based payment

### Attendance & Check-in

**QR Check-in Flow:**
```
Member scans static gym QR code
    ↓
POST /api/attendance/qr-checkin
    ↓
Validation:
  ✓ Member exists
  ✓ Has active membership
  ✓ Membership not frozen
  ✓ Not time-restricted (or within allowed time)
  ✓ Sessions remaining (if session-based)
    ↓
Success Response:
  {
    attendanceId, memberName, checkInAtUtc,
    planName, sessionsRemaining, message
  }
    ↓
Member sees confirmation + remaining days/sessions
```

**Manual Check-in (Staff):**
- Trainer searches member database
- Confirms check-in with reason (normal, makeup, guest, etc.)
- Used for members without phones or QR issues

**Real-time Dashboard:**
- SignalR Hub streams today's check-ins
- Live attendance list with member photos
- Heatmap: 7-day × 24-hour grid showing busiest times
- Rate limit: 30 check-ins/minute per IP

### Notifications & Invitations

**Notifications:**
- System-generated (membership expiring in 7 days, invitation accepted)
- Bulk send (renewal reminders, announcements)
- Channels: in-app (required), SMS (planned)

**Invitations (Family Plan Feature):**
- Member receives quota (e.g., 3 guest invites)
- Creates shareable link/QR code
- Tracking: sent → visited → converted → expired
- Analytics on conversion funnel

### Analytics & Reports

**Dashboard KPIs:**
```
├─ Active Members: Count + trend
├─ Revenue: This month + YTD + growth %
├─ Check-ins: Today + 7-day + 30-day
├─ Membership Distribution: Pie chart (active/expired/frozen)
├─ Peak Hours: Heatmap showing busiest times
└─ Invitations: Conversion funnel (sent → visited → converted)
```

**Reports (Drill-down):**
1. **Revenue Report:** By plan type, payment method, date range
2. **Attendance Report:** By member, time period, frequency analysis
3. **Peak Hours:** Hour-by-hour breakdown + day-of-week patterns
4. **Retention:** Member churn rate, avg membership duration
5. **Invitations:** Funnel analysis, conversion rate

### Admin & Staff Management (Owner Only)
- Create staff users (email-based invitation)
- Assign roles (Manager, Trainer)
- View staff activity logs
- Set permissions

### Tenant/Gym Settings
- Gym name, address, phone, logo
- Subscription plan / feature enablement
- QR poster generation (A4 printable)
- Invoice/receipt customization

---

## 6. API INTEGRATION

### Base Configuration
```
Base URL:     https://your-domain.com/api  (production)
              http://localhost:5000/api      (local dev)
Auth:         JWT Bearer token in Authorization header
Content-Type: application/json
Swagger UI:   /swagger/index.html (development)
```

### HTTP Interceptors (Both Web & Mobile)

**1. Auth Interceptor:**
- Adds `Authorization: Bearer {accessToken}` to all requests
- Retrieves token from secure storage

**2. Refresh Interceptor (401 Handling):**
- Detects 401 response (token expired)
- Calls `POST /api/auth/refresh` with refresh token
- Updates token pair (sliding rotation)
- Retries original request automatically

**3. Error Interceptor:**
- Parses error response
- Maps to user-friendly messages
- Bilingual error messages (EN/AR)
- Routes to login on auth failure

### API Domains

| Domain | Base Route | Key Endpoints | Auth Policy |
|---|---|---|---|
| **Auth** | `/auth` | login, refresh, member-otp, member-verify | None (AllowAnonymous) |
| **Members** | `/members` | list, get, create, update, delete, freeze, unfreeze | ManagerOrAbove |
| **Memberships** | `/memberships` | current, history, assign, renew, freeze | ManagerOrAbove |
| **Plans** | `/membership-plans` | list, get, create, update, delete | AnyStaff (write: OwnerOnly) |
| **Attendance** | `/attendance` | qr-checkin, manual-checkin, today, history | AuthenticatedMember / AnyStaff |
| **Staff** | `/staff` | list, get, create, update | OwnerOnly |
| **Settings** | `/tenant-settings` | get, update | ManagerOrAbove |
| **Notifications** | `/notifications` | list, mark-read, send-bulk | AnyAuthenticated |
| **Invitations** | `/invitations` | list, send, track | AuthenticatedMember / AnyStaff |
| **Analytics** | `/analytics` | dashboard-kpis, chart-data | AnyStaff |
| **Reports** | `/reports` | revenue, attendance, peak-hours | AnyStaff |
| **Payments** | `/payments` | (webhooks only) | None (signature verification) |
| **Health** | `/health` | status | None |

### Auto-Generated API Clients

**Web (TypeScript):**
```typescript
// Generated from OpenAPI spec
import { MembersApi, MembersApiFactory } from '@/lib/api-client';

const api = MembersApiFactory(apiConfiguration);
const members = await api.listMembers({ search: 'Ahmed' });
```

**Flutter (Dart):**
```dart
// Generated from OpenAPI spec
import 'package:api_client/api_client.dart';

final apiClient = ApiClient();
final response = await apiClient.membersApi.listMembers(search: 'Ahmed');
```

---

## 7. INTERNATIONALIZATION (i18n)

### Bilingual Architecture

**Web (i18next):**
```
src/lib/i18n/
├── config.ts              # i18next initialization
├── en.json                # English translations
└── ar.json                # Arabic translations

// Usage:
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <h1>{t('dashboard.welcome')}</h1>
    </div>
  );
}
```

**Mobile (Flutter):**
```
lib/core/localization/l10n/
├── app_en.arb              # English strings (ARB format)
└── app_ar.arb              # Arabic strings

// Usage:
AppLocalizations.of(context)!.dashboardWelcome
```

### RTL Layout Adaptation

**Web (CSS):**
```css
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

[dir="rtl"] .sidebar {
  left: auto;
  right: 0;
}

[dir="rtl"] .icon {
  transform: scaleX(-1);  /* Flip icons */
}
```

**Mobile (Flutter):**
```dart
Directionality(
  textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr,
  child: Scaffold(...),
)
```

### Bilingual API Response Handling

Most DTOs include localized fields:
```json
{
  "id": "member-123",
  "fullName": "Ahmed Ali",
  "fullNameAr": "أحمد علي",
  "planName": "Monthly Unlimited",
  "planNameAr": "شهري غير محدود"
}
```

**Helper Function:**
```typescript
// Web
const localizedName = i18n.language === 'ar' ? dto.fullNameAr : dto.fullName;

// Mobile
String getLocalizedField(BuildContext context, String en, String ar) {
  return Localizations.localeOf(context).languageCode == 'ar' ? ar : en;
}
```

---

## 8. KEY CONFIGURATION FILES

### Expected Files (Not yet created)

**Web (`apps/web/`):**
```
next.config.js              # Next.js build configuration
tsconfig.json              # TypeScript strict mode, path aliases
tailwind.config.ts         # Tailwind config using design tokens
postcss.config.js          # PostCSS for Tailwind
jest.config.js             # Jest testing config
.env.local                 # Local development env vars
.env.production            # Production env vars
package.json               # Dependencies (React, Next, Tailwind, etc.)
package-lock.json          # Lock file
```

**Mobile (`apps/mobile/`):**
```
pubspec.yaml               # Flutter dependencies
analysis_options.yaml      # Lint rules for Dart
android/build.gradle       # Android Gradle config
ios/Podfile               # iOS CocoaPods config
.env                      # Environment variables
```

**Shared:**
```
design-tokens.json         # Master design system tokens
packages/api-client/openapi.yaml  # OpenAPI spec for client generation
packages/design-tokens/build.js   # Style Dictionary config
```

---

## 9. BUILD & DEPLOYMENT WORKFLOW

### Web Development & Build

```bash
# Development
cd apps/web
npm install
npm run dev                    # Starts Next.js dev server on localhost:3000

# Production Build
npm run build                  # Optimized production build
npm run start                  # Serves production build

# Testing
npm run test:unit             # Jest unit tests
npm run test:e2e              # Playwright e2e tests
npm run lint                  # ESLint + Prettier

# Deployment
# → Build artifact: .next/ folder
# → Deploy to Vercel / AWS / custom server
# → Environment variables configured for production API URL
```

### Mobile Development & Build

```bash
# Setup
flutter pub get               # Install Dart dependencies

# Development
flutter run                   # Run on emulator/connected device
flutter run -d web           # Web version (debug)

# Testing
flutter test                  # Unit + widget tests
flutter test integration_test/ # Integration tests

# Production Build
flutter build apk             # Android APK (~/build/app/release/app-release.apk)
flutter build ios             # iOS IPA (./build/ios/ipa/)
flutter build web             # Web bundle (./build/web/)

# Deployment
# → Upload to Google Play Store / App Store
# → Configure signing certificates
# → Set production API URL
```

---

## 10. DEVELOPMENT PATTERNS & CONVENTIONS

### Code Organization

| Aspect | Convention |
|---|---|
| **Component Names** | PascalCase: `MemberCard.tsx`, `AttendanceList.dart` |
| **Function Names** | camelCase: `getMemberById()`, `formatCurrency()` |
| **File Names** | kebab-case: `member-card.tsx`, `attendance-bloc.dart` |
| **Constants** | UPPER_SNAKE_CASE: `MAX_PAGE_SIZE`, `APP_NAME` |
| **Interfaces/Types** | PascalCase with suffix: `MemberDTO`, `CheckinResponse` |

### Error Handling

**Web:**
```typescript
try {
  const data = await api.members.list();
} catch (error) {
  const message = error?.response?.data?.message || 'An error occurred';
  toast.error(t('error.' + error?.code, message));
}
```

**Mobile:**
```dart
try {
  final response = await repository.getMembers();
  emit(MembersLoaded(response));
} catch (error) {
  final message = _mapErrorToMessage(error);
  emit(MembersError(message));
}
```

### Form Validation

```typescript
// Shared Zod schema
const createMemberSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+\d{11,}/),
  email: z.string().email().optional(),
  dateOfBirth: z.date(),
});

// Web: React Hook Form + Zod
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(createMemberSchema),
});

// Mobile: Manual validation
final errors = <String, String>{};
if (fullName.isEmpty) errors['fullName'] = 'Name required';
if (!phoneRegex.hasMatch(phone)) errors['phone'] = 'Invalid phone';
```

### State Management Patterns

**Web (React Query):**
```typescript
// hooks/use-members.ts
export function useMembers() {
  const queryClient = useQueryClient();

  // Fetch
  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.members.list(),
  });

  // Mutate
  const { mutate: create } = useMutation({
    mutationFn: (member) => api.members.create(member),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  return { members: data, isLoading, create };
}
```

**Mobile (BLoC):**
```dart
// Features expose repository → BLoC → Emits State
class MembersBloc extends Bloc<MembersEvent, MembersState> {
  MembersBloc(this._repository) : super(MembersInitial()) {
    on<FetchMembersEvent>(_onFetchMembers);
  }

  Future<void> _onFetchMembers(
    FetchMembersEvent event,
    Emitter<MembersState> emit,
  ) async {
    emit(MembersLoading());
    try {
      final members = await _repository.getMembers();
      emit(MembersLoaded(members));
    } catch (error) {
      emit(MembersError(error.toString()));
    }
  }
}
```

---

## 11. IMPORTANT CONSIDERATIONS

### Security
- **JWT Tokens:** Never store in localStorage alone; prefer httpOnly cookies + secure storage
- **Token Refresh:** Implement sliding window rotation to minimize token theft window
- **API Security:** CORS configured per domain, rate limiting (30 req/min per endpoint)
- **Data Privacy:** Phone numbers, national IDs encrypted at rest

### Performance
- **Pagination:** Default 20 items per page (configurable)
- **Lazy Loading:** Images, charts, reports load on-demand
- **Caching:** React Query on web, local storage on mobile for membership data
- **Real-time Optimization:** SignalR Hub connection only when viewing live dashboards

### Accessibility
- **ARIA Labels:** All buttons, links have descriptive labels
- **Color Contrast:** WCAG AA standard (4.5:1 for text)
- **Keyboard Navigation:** Full keyboard access on web
- **RTL Support:** Built-in, no special setup required

### Scalability
- **Multi-tenancy:** Separate gym instances via tenant_id
- **Database:** Likely relational (SQL Server / PostgreSQL)
- **Caching Layer:** Redis for token blacklist, session management
- **Search:** ElasticSearch for member search optimization (future)

---

## 12. NEXT STEPS FOR DEVELOPMENT

### Phase 1: Setup (Week 1-2)
- [ ] Create `apps/web/package.json` with core dependencies
- [ ] Create `apps/mobile/pubspec.yaml` with Flutter packages
- [ ] Setup design-tokens build pipeline (Style Dictionary)
- [ ] Generate API clients from OpenAPI spec

### Phase 2: Web Foundation (Week 3-4)
- [ ] Implement Next.js app structure with layouts
- [ ] Setup auth flow (login, token refresh, protected routes)
- [ ] Create theme provider (light/dark, CSS variables)
- [ ] Build core components (button, input, card)

### Phase 3: Mobile Foundation (Week 5-6)
- [ ] Setup Flutter project structure with features
- [ ] Implement BLoC for auth
- [ ] Create core widgets (app button, input, card)
- [ ] Setup navigation with GoRouter

### Phase 4: Feature Development (Week 7+)
- [ ] Members: list, create, detail, edit screens
- [ ] Attendance: QR scanner, check-in flow
- [ ] Dashboard: KPIs, charts, real-time updates
- [ ] Memberships: assign, renew, freeze flows

---

## Summary Table: Tech Stack Quick Reference

| Component | Web | Mobile | Notes |
|---|---|---|---|
| **Language** | TypeScript | Dart | Type-safe both platforms |
| **Framework** | Next.js 13+ | Flutter | SSR + routes on web; native-like on mobile |
| **UI System** | Tailwind + shadcn/ui | Material Design 3 | Consistent design system |
| **State Mgmt** | React Query + Context | BLoC | Separation of concerns |
| **HTTP Client** | Axios | Dio | Auto-token refresh on both |
| **Real-time** | SignalR Hub | SignalR Hub | Live dashboards |
| **Auth** | JWT (httpOnly) | JWT (secure storage) | Standard Bearer token flow |
| **i18n** | i18next | Flutter L10n | English + Arabic RTL |
| **Testing** | Playwright, Jest | Mockito, bloc_test | Comprehensive coverage |
| **Build** | Next.js | Flutter CLI | Optimized for each platform |

---

**Project Status:** Fully documented architecture & design system ready for implementation. All configuration and structure defined; awaiting code generation and feature development.

