# HyMotion — Flutter Member App Developer Prompt Pack

> **SUPERSEDED for auth + identity:** use [`FLUTTER_MEMBER_APP_PROMPT.md`](./FLUTTER_MEMBER_APP_PROMPT.md).  
> This pack still documents OTP + a `member_id` JWT claim — both are **obsolete / incorrect** vs production  
> (`POST /api/auth/member-activate`, JWT `sub` only). Keep for historical sprint structure only.
>
> All API routes, JWT claim names, request/response shapes, and error codes  
> are taken directly from the **production codebase** — do not invent endpoints.
>
> **Design source of truth:** `Frontend/design-system.html` (same tokens as `apps/web`).  
> Do **not** invent a navy/red “gym dark” theme — use HyMotion lime + charcoal below.

---

## How to Use

1. Paste **PROMPT 0 (Master Context)** at the start of every new AI session.
2. Run prompts **in order** — each builds on the previous sprint's code.
3. One prompt ≈ one feature branch / PR.
4. After each prompt: run `flutter analyze`, fix all warnings, test on both iOS + Android simulators.

**Prompt → Sprint Map:**

| Sprint | Prompts | Focus |
|---|---|---|
| S1 | P1, P2 | Project setup + Auth |
| S2 | P3, P4 | Home dashboard + QR check-in |
| S3 | P5, P6 | Membership + Attendance history |
| S4 | P7, P8 | Notifications + Guest invitations |
| S5 | P9, P10 | Profile + Polish & testing |

---

## PROMPT 0 — Master Context (paste first, every session)

```
You are a senior Flutter developer building the HyMotion Member Mobile Application — a consumer-facing gym companion app for Egyptian/MENA members.

PRODUCTION API BASE URL: https://api.gymflowpro.com (dev: http://10.0.2.2:5000 for Android emulator, http://localhost:5000 for iOS)

--- AUTHENTICATION ---
Auth flow: Phone-number OTP (no email/password for members).
Step 1: POST /api/auth/member-otp   { gymCode: string, phoneNumber: string }
        → 200 { message: string } | 400 { error: string }
Step 2: POST /api/auth/member-verify { gymCode: string, phoneNumber: string, otp: string }
        → 200 LoginResponse | 401 { error: string }
Token refresh: POST /api/auth/refresh { refreshToken: string }
        → 200 LoginResponse | 401 { error: string }

LoginResponse shape:
{
  accessToken: string,       // JWT, 15-min expiry
  refreshToken: string,      // opaque string, 30-day expiry
  expiresAtUtc: string,      // ISO8601 UTC
  user: {
    id: string,              // ApplicationUser.Id (Guid) — NOT the GymMember.Id
    email: string,
    fullName: string,
    role: string,            // "Member"
    tenantId: string,        // Guid
    gymCode: string
  }
}

JWT Claims (decode from accessToken):
- sub         → ApplicationUser.Id (Guid string)
- tenant_id   → Gym tenant Guid
- gym_code    → Gym short code e.g. "GYM-CAIRO-01"
- role        → "Member"
- member_id   → GymMember.Id (Guid) — USE THIS for member-facing API calls
- first_name, last_name, email
- exp         → Unix timestamp

IMPORTANT: GymMember.Id ≠ ApplicationUser.Id. Member-facing API calls use the member_id claim, not sub.

--- KEY ENDPOINTS ---

# Member profile
GET  /api/members/{memberId}                        → MemberDetailDto
PUT  /api/members/{memberId}                        → MemberDetailDto

# Current membership
GET  /api/members/{memberId}/membership             → MembershipSummaryDto

# Membership history
GET  /api/memberships/{memberId}/history?page=&pageSize=  → PagedResult<MembershipHistoryItemDto>

# Attendance history
GET  /api/members/{memberId}/attendance?page=&pageSize=   → PagedResult<AttendanceHistoryItemDto>

# QR Check-in (POST — member scans gym's static QR, sends gymCode in body)
POST /api/attendance/qr-checkin                     → QrCheckinResponse
     Body: { gymCode: string }
     Auth: Bearer token with role=Member

# Notifications
GET  /api/notifications?page=&pageSize=             → PagedResult<NotificationDto>
POST /api/notifications/{id}/read                   → { message: string }

# Guest invitations
POST /api/invitation/send   { guestName: string, guestPhone: string, visitDate: string (YYYY-MM-DD) }
GET  /api/invitation/history

# Account credits
GET  /api/members/{memberId}/credits                → { balance: decimal, entries: [...] }

--- RESPONSE SHAPE CONVENTIONS ---
Success: HTTP 2xx, data directly in body OR { data: ..., message: ... }
Error: { error: string } (existing code) or ProblemDetails { title, detail, status, extensions.code }
Paginated: { items: [], totalCount: int, page: int, pageSize: int }
Always handle BOTH error formats since the API has two patterns.

--- JWT TOKEN MANAGEMENT ---
- Store accessToken + refreshToken in flutter_secure_storage (NOT SharedPreferences).
- Access token expires in 15 minutes (check expiresAtUtc field).
- On 401 response: attempt ONE silent refresh via /api/auth/refresh. If refresh also fails (401) → force logout → show OTP login screen.
- Use Dio interceptor for automatic token injection and refresh.

--- TENANT RESOLUTION ---
The GymCode is required for all auth calls and stored locally after first login. Members may belong to only one gym at a time. Store gymCode in secure storage alongside tokens.

--- TECH STACK (required — do not change) ---
- Flutter 3.22+ / Dart 3.4+
- State management: flutter_bloc (Cubit flavor preferred for simplicity)
- HTTP: dio + dio_interceptors for auth
- Secure storage: flutter_secure_storage
- Navigation: go_router
- QR scanning: mobile_scanner
- QR generation (display gym code QR): qr_flutter
- Local notifications: flutter_local_notifications (for push from FCM)
- Push notifications: firebase_messaging
- Image picking: image_picker
- Localization: flutter_localizations + arb files (Arabic RTL + English LTR)
- Charts: fl_chart
- Lottie animations: lottie
- Env config: flutter_dotenv
- Fonts: google_fonts → Space Grotesk + IBM Plex Sans + IBM Plex Sans Arabic

--- DESIGN SYSTEM (match Frontend/design-system.html — DO NOT invent alternate themes) ---

BRAND / NEUTRALS (Charcoal):
  c900 #0D0D0D  c800 #1A1A1A  c700 #2A2A2A  c600 #3A3A3A  c500 #4A4A4A
  c400 #6B6B6B  c300 #8C8C8C  c200 #B0B0B0  c100 #D4D4D4  c50  #F0F0F0

PRIMARY LIME (brand — CTAs, active nav, focus, highlights):
  l600 #5EAF00  l500 #7ACC00  l400 #A0E040  l300 #BEEC73
  l200 #D8F5A6  l100 #EDFCD8  lglow rgba(160,224,64,0.25)

SECONDARY TEAL (supporting actions):
  t700 #0A4D4D  t600 #0D6B6B  t500 #148F8F  t400 #3DB5B5  t300 #70CECE

SEMANTIC:
  Success  #22C55E / #DCFCE7 / text #166534
  Warning  #F59E0B / #FEF3C7 / text #92400E
  Danger   #EF4444 / #FEE2E2 / text #991B1B
  Info     #3B82F6 / #DBEAFE / text #1E40AF
  Frozen   #22D3EE / #CFFAFE / text #155E75
  Pending  #FBBF24 / #FEF3C7 / text #92400E

LIGHT SURFACES (default first paint — matches staff web):
  bg #FAFAFA | surface #FFFFFF | surface2 #F5F5F5 | border #EBEBEB / #D4D4D4
  text #1A1A1A / #4A4A4A / #8C8C8C

DARK SURFACES (ThemeMode.dark — same lime brand):
  bg #0D0D0D | surface #1A1A1A | surface2 #2A2A2A | border #3A3A3A / #4A4A4A
  text #F0F0F0 / #B0B0B0 / #6B6B6B

TYPOGRAPHY (Google Fonts — never Inter / Cairo / Roboto as brand fonts):
  Display/headings: Space Grotesk 400–700
  Body Latin: IBM Plex Sans 300–700
  Body Arabic/RTL: IBM Plex Sans Arabic 300–700
  Scale: Display 28–36 · Title 18–20 · Body 14–16 · Caption 11–12 · Label 10–13

RADIUS: 6 / 10 / 16 / 24 / pill 9999
SHADOWS: soft elevation only; lime glow only on primary CTA hover/focus
MOTION: 150ms / 250ms / 400ms ease
ICONS: Tabler-style outline (or Lucide). Active nav = lime l400/l500

UI RULES:
- Support ThemeMode.light AND ThemeMode.dark. Default ThemeMode.system (or light).
- FORBIDDEN: navy (#1A1A2E), gym-red (#E94560), Inter, Cairo, purple marketing gradients, cream+terracotta AI defaults.
- Primary CTA: solid l500 + text c900 (not red/pink gradients). Hover → l400 + optional lglow.
- Secondary: teal t500 OR outline ghost (border → lime on hover).
- Cards: surface + 1px border + radius lg. Status badges: Active=success, Expired=danger, Frozen=frz, Pending=pending, Cancelled=neutral.
- Arabic primary, English secondary; RTL when ar. Bottom nav 5 tabs; active = lime.
- Map API errors to friendly AR/EN — never raw strings. Shimmer uses surface2 / c600.

--- PROJECT STRUCTURE ---
lib/
  app/
    app.dart               # MaterialApp + GoRouter setup
    theme/                 # ThemeData, colors, text styles
  core/
    api/                   # Dio client, interceptors, base repository
    constants/             # api_constants.dart, app_constants.dart
    errors/                # failure models, error mappers
    extensions/            # string, date, context extensions
    utils/                 # validators, phone normalizer (+20 format)
  features/
    auth/                  # login, OTP flows, cubit, models
    home/                  # dashboard cubit, widgets
    checkin/               # QR scanner, checkin cubit
    membership/            # membership card, history cubit
    attendance/            # attendance log cubit
    notifications/         # notifications cubit
    invitations/           # invitation flow cubit
    profile/               # profile edit cubit
  l10n/                    # app_ar.arb, app_en.arb
  main.dart

DONE SO FAR (append after each merged PR):
[updated after each sprint]

Wait for my task prompt. Do not scaffold anything yet.
```

---

## SPRINT 1

### PROMPT 1 — Project Scaffold + Core Infrastructure

```
TASK: Create the complete Flutter project scaffold and core infrastructure. No feature screens yet — only the skeleton that all features will plug into.

1. PROJECT INIT:
   flutter create gymflow_member --org com.HyMotion --platforms android,ios
   Add all required pubspec.yaml dependencies (versions pinned to latest stable as of Flutter 3.22):
   flutter_bloc, go_router, dio, flutter_secure_storage, mobile_scanner, qr_flutter,
   flutter_local_notifications, firebase_messaging, image_picker, fl_chart, lottie,
   flutter_dotenv, google_fonts, flutter_localizations, shimmer, cached_network_image,
   intl, equatable, dartz (for Either<Failure, T>).

2. ENVIRONMENT CONFIG (.env files):
   .env.development:  API_BASE_URL=http://10.0.2.2:5000
   .env.production:   API_BASE_URL=https://api.gymflowpro.com
   Load via flutter_dotenv in main.dart. main() calls dotenv.load(fileName: .env.development) based on flavor.

3. THEME (lib/app/theme/) — copy tokens from Prompt 0 / design-system.html:
   app_colors.dart: Charcoal (c*), Lime (l*), Teal (t*), semantic (suc/wrn/dng/inf/frz/pnd), light+dark surfaces.
   app_text_styles.dart: Space Grotesk for headings; IBM Plex Sans (Latin) + IBM Plex Sans Arabic (RTL) for body. Display/title/body/caption/label.
   app_theme.dart:
     - ThemeData light + ThemeData dark (NOT dark-only).
     - colorScheme: primary=l500, onPrimary=c900, secondary=t500, error=dng500, surface/background from light|dark tokens.
     - elevatedButtonTheme: filled lime, pill or radius md/lg, height ~44.
     - inputDecorationTheme: radius md, border lbd/dbd, focus border l500 + lglow.
     - cardTheme: surface + 1px border, radius lg, soft shadow.
     - bottomNavigationBarTheme: active icon/label = l400/l500; inactive = c400/dtt.
     - MaterialApp.themeMode: ThemeMode.system (user can override in Profile settings).

4. LOCALIZATION (lib/l10n/):
   app_ar.arb: Arabic translations for all keys. Minimum 60 keys covering: auth flow messages, membership statuses (active/expired/frozen/cancelled), error codes, navigation labels, button labels, empty states.
   app_en.arb: English equivalents.
   Keys list (must implement ALL of these — no placeholders):
   - app_name, app_tagline
   - nav_home, nav_qr, nav_history, nav_notifications, nav_profile
   - auth_enter_phone, auth_enter_gym_code, auth_send_otp, auth_enter_otp, auth_verify, auth_resend, auth_resend_seconds
   - auth_error_phone_invalid, auth_error_gym_not_found, auth_error_otp_invalid, auth_error_account_inactive
   - membership_status_active, membership_status_expired, membership_status_frozen, membership_status_cancelled
   - membership_expires_in, membership_expired_days_ago, membership_sessions_remaining
   - checkin_success, checkin_already_today, checkin_no_membership, checkin_frozen, checkin_expired, checkin_time_restricted
   - invite_send, invite_quota_remaining, invite_history, invite_success
   - notification_mark_read, notification_empty
   - profile_edit, profile_save, profile_photo
   - error_generic, error_network, error_session_expired
   - loading, retry, cancel, done, save, close

5. DIO API CLIENT (lib/core/api/):
   api_client.dart: Dio instance with BaseOptions (baseUrl from dotenv, connectTimeout 10s, receiveTimeout 15s).
   
   auth_interceptor.dart (Dio Interceptor):
   - onRequest: read accessToken from SecureStorage → add Authorization: Bearer {token} header.
   - onError: if 401 and path != /api/auth/refresh and not already retrying:
     a. Attempt POST /api/auth/refresh with stored refreshToken.
     b. If success: store new tokens → retry original request.
     c. If fail: clear all stored tokens → emit AuthLogoutEvent to a global AuthCubit → do NOT retry.
   
   api_constants.dart: all endpoint paths as static const strings.
   
   response_handler.dart: helper that converts Dio response → Either<Failure, T>. Handles BOTH error formats: { error: string } and ProblemDetails { title, detail, extensions.code }. Maps HTTP status to Failure types.

6. SECURE STORAGE SERVICE (lib/core/):
   secure_storage_service.dart:
   - saveTokens(accessToken, refreshToken, expiresAtUtc, gymCode, memberIdFromJwt, fullName)
   - getAccessToken() → String?
   - getRefreshToken() → String?
   - getGymCode() → String?
   - getMemberId() → String?
   - clearAll() → void
   Decodes JWT WITHOUT a library (base64 decode the payload segment) to extract member_id, exp, first_name, last_name, gym_code claims immediately on login.

7. GLOBAL AUTH CUBIT (lib/features/auth/):
   AuthState: AuthInitial, AuthAuthenticated { memberInfo }, AuthUnauthenticated.
   AuthCubit: on app start → check secure storage → emit Authenticated or Unauthenticated.
   Stream-listened by GoRouter redirect to push /login or /home.

8. GO_ROUTER setup (lib/app/app.dart):
   Routes:
   - /login → GymCodeScreen (first time) or PhoneScreen (returning)
   - /otp → OtpScreen
   - / → ShellRoute with BottomNavBar containing: /home, /qr, /history, /notifications, /profile
   - /membership/:id → MembershipDetailScreen
   - /invite → InvitationScreen
   Redirect: if AuthUnauthenticated → /login. If AuthAuthenticated and on /login → /home.

9. BOTTOM NAVIGATION SHELL:
   Persistent BottomNavigationBar with 5 tabs. Icons: dashboard, qr_code_scanner, history, notifications_outlined, person_outline. Active tab uses lime (l400/l500). Notification badge on bell icon (badge count from NotificationCubit unread count) — badge fill dng500.

10. SHIMMER LOADING COMPONENT (lib/core/):
    AppShimmer widget: animated shimmer skeleton card. Used as placeholder before API data arrives.

11. ERROR WIDGET + EMPTY STATE:
    AppErrorWidget(message, onRetry): centered sad icon, bilingual message, retry button.
    AppEmptyState(message, icon): centered icon, bilingual message.

12. PHONE NUMBER UTILITY (lib/core/utils/phone_normalizer.dart):
    Normalizes Egyptian phone numbers to +20XXXXXXXXXX format.
    Accepts: 010XXXXXXXX, 011XXXXXXXX, 012XXXXXXXX, 015XXXXXXXX, +20..., 0020..., with spaces/dashes.
    Returns null for invalid numbers.
    Unit test: 12 format variants all normalize correctly.

Deliver: complete project structure with all files listed above. Every file must compile cleanly. flutter analyze must return 0 issues.
```

---

### PROMPT 2 — Authentication Flow (OTP Phone Login)

```
CONTEXT: Project scaffold from P1 exists. ApiClient, SecureStorageService, AuthCubit are ready.

TASK: Full OTP authentication flow. Three screens: GymCode → Phone → OTP.

API calls (exact routes from production code):
  POST /api/auth/member-otp    body: { gymCode, phoneNumber }  → { message: string }
  POST /api/auth/member-verify body: { gymCode, phoneNumber, otp } → LoginResponse

1. AuthRepository (lib/features/auth/data/):
   sendOtpAsync(gymCode, phoneNumber) → Either<Failure, String> (message)
   verifyOtpAsync(gymCode, phoneNumber, otp) → Either<Failure, LoginResponse>
   refreshTokenAsync(refreshToken) → Either<Failure, LoginResponse>
   signOut() → void (calls secureStorage.clearAll())
   
   Error mapping:
   - 400 { error: "Phone number not found..." } → Failure.memberNotFound (ar: "رقم الهاتف غير مسجل في هذا النادي")
   - 400 { error: "Invalid gym code..." } → Failure.gymNotFound (ar: "كود النادي غير صحيح")
   - 401 { error: "Invalid OTP..." } → Failure.otpInvalid (ar: "رمز التحقق غير صحيح أو منتهي الصلاحية")
   - 400 { error: "disabled" } → Failure.accountInactive (ar: "حسابك موقوف. تواصل مع النادي")

2. AuthCubit (lib/features/auth/cubit/):
   States: AuthInitial, AuthCheckingStorage, AuthAuthenticated{memberInfo}, AuthUnauthenticated, OtpSent{phoneNumber, gymCode}, OtpVerifying, AuthLoggingIn, AuthError{message}.
   
   Methods:
   - checkAuthStatus(): read storage → emit Authenticated or Unauthenticated
   - sendOtp(gymCode, phone): normalize phone → call repo → emit OtpSent or AuthError
   - verifyOtp(otp): call repo → save tokens → update AuthCubit.state → emit Authenticated
   - signOut(): clear storage → emit Unauthenticated

3. GymCodeScreen (lib/features/auth/presentation/):
   - Premium welcome screen. Background: light surface (#FAFAFA) or dark c900 with subtle charcoal gradient — NOT navy/red. Optional Lottie accent in lime tones only.
   - HyMotion mark: lime rounded square logo + Space Grotesk wordmark in l400/l600. Tagline bilingual: "ادارة النادي بذكاء / Smart Gym Management".
   - Single text field: "كود النادي / Gym Code" with gym icon prefix. Auto-uppercase. Max 20 chars. Focus ring = lime.
   - "Continue / متابعة" button — full width, solid l500 + c900 text, radius lg (16). No red/pink gradient.
   - If user has previously logged in (gymCode in storage) → skip this screen → go to PhoneScreen with stored gymCode pre-filled.
   - Validation: not empty, letters/numbers/dashes only, show snackbar on error.

4. PhoneScreen (lib/features/auth/presentation/):
   - Header: gym logo placeholder (🏋️ emoji until gym logo API is added), gym code displayed.
   - Body: "أدخل رقم هاتفك / Enter your phone number".
   - Phone field with +20 country code prefix (locked). User enters 10 digits (01X XXXX XXXX). Keyboard: number.
   - Auto-format as user types: XXXX XXXX XX.
   - "Send OTP / إرسال الرمز" button. On tap: normalize phone → call sendOtp.
   - Loading state: button shows CircularProgressIndicator, disabled.
   - Error: inline error below field (no snackbar for auth errors — show them in the UI).

5. OtpScreen (lib/features/auth/presentation/):
   - Display masked phone number at top: +20 *** *** 4567.
   - 6 individual OTP digit boxes — surface background, border dbd/lbd, focus border lime l500 + lglow. Auto-advance focus on each digit entry. Auto-submit when 6th digit entered.
   - 60-second resend countdown timer (animated ring in lime). After countdown → "Resend / إعادة الإرسال" button.
   - Success animation: on correct OTP → full-screen Lottie success (suc500 checkmark) → navigate to /home after 1.2 seconds.
   - Error: shake animation on the OTP boxes (AnimationController, offset tween). Clear fields. Show error message (dng500).
   - "تغيير الرقم / Change number" text button → pop back to PhoneScreen.

6. Splash / App startup:
   SplashScreen (lib/features/auth/presentation/): HyMotion lime logo centered on light bg or c900. Subtle lime pulse. On init: AuthCubit.checkAuthStatus(). Duration: minimum 1.5s then navigate.

7. Input validation (shared):
   - GymCode: non-empty, alphanumeric + dash, trimmed.
   - Phone: after normalization must match ^+20(010|011|012|015)[0-9]{8}$.
   - OTP: exactly 6 digits.

8. Widget tests:
   - GymCodeScreen shows error on empty submission
   - PhoneScreen disables button during loading state
   - OtpScreen auto-advances focus on digit entry
   - OtpScreen shakes on wrong OTP (mock AuthCubit returning OtpInvalid)
   - Returning user: stored gymCode → GymCodeScreen redirected to PhoneScreen

Deliver: AuthRepository, AuthCubit, GymCodeScreen, PhoneScreen, OtpScreen, SplashScreen. All screens animated, bilingual, light+dark themed per AppColors.
```

---

## SPRINT 2

### PROMPT 3 — Home Dashboard

```
CONTEXT: Auth works. User lands at /home after login. member_id Guid is in SecureStorage from JWT decode.

TASK: Home dashboard screen showing membership status card, quick stats, and motivational content.

APIs used:
  GET /api/members/{memberId}            → MemberDetailDto
  GET /api/members/{memberId}/membership → MembershipSummaryDto
  GET /api/members/{memberId}/credits    → { balance: decimal, entries: [...] }

MemberDetailDto shape (based on entity):
{
  id: string, memberNumber: string, fullName: string, fullNameAr: string,
  phoneNumber: string, email: string?, profilePhotoUrl: string?,
  isActive: bool, invitationQuotaRemaining: int,
  currentMembership: MembershipSummaryDto?
}

MembershipSummaryDto shape:
{
  id: string, planName: string, planNameAr: string, planType: string,
  startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD),
  status: string (active|expired|frozen|cancelled),
  sessionsRemaining: int?, amountPaid: decimal, paymentMethod: string,
  frozenFromDate: string?, frozenUntilDate: string?, autoRenew: bool
}

1. HomeRepository: fetchHomeData(memberId) — parallel calls via Future.wait([fetchMember, fetchMembership, fetchCredits]) → HomeData model.

2. HomeCubit: states HomeInitial, HomeLoading, HomeLoaded{homeData}, HomeError{message}. loadHome(memberId) method. Pull-to-refresh: refreshHome().

3. HomeScreen layout (scrollable, SingleChildScrollView with RefreshIndicator):

   a. HEADER SECTION (top of screen, no AppBar — flat surface header, lime accents only):
      - Greeting: "مرحباً, {firstName}! 👋" (time-aware: صباح الخير / مساء الخير) — Space Grotesk / IBM Plex
      - Member number: #{memberNumber} — caption tertiary text
      - Notification bell icon (top-right) → navigate to /notifications with badge count (dng500 badge)

   b. MEMBERSHIP CARD (main hero element — large, full-width card):
      Design-system card: surface + 1px border + radius lg + soft shadow. Optional top accent bar (4px) in status color (suc/dng/frz/pnd). NO glassmorphism, NO navy/red gradients.
      Content:
      - Plan name (Arabic + English) — display font Space Grotesk for EN, IBM Plex Arabic for AR
      - Status pill: use AppColors badge mapping (active/expired/frozen/cancelled/pending)
      - Expiry: if active → "تنتهي في: {endDate}" + days remaining pill (suc if >14, wrn if ≤14, dng if ≤3)
      - If frozen → show "مجمدة حتى: {frozenUntilDate}" in frz banner
      - If session_pack → show "الجلسات المتبقية: {sessionsRemaining}" with progress ring (lime fill)
      - If expired → show "انتهت منذ {N} يوم" with dng badge
      - "فحص العضوية / View Details" text button (lime) → /membership/{id}
      
      State-specific CTAs:
      - Active: show "تسجيل حضور / Check In" filled lime pill → navigate to /qr
      - Expired: show "جدد الآن / Renew Now" outline/teal → deep-link to WhatsApp gym contact (configurable)
      - If null membership: "لا توجد عضوية / No active membership" with contact gym button

   c. QUICK STATS ROW (horizontal scroll, 3 stat cards — same card tokens):
      - Total visits this month (count from attendance API — cache from homepage load)
      - Account credit balance from credits API (if > 0 show suc500, else tertiary)
      - Invitation quota remaining

   d. MOTIVATIONAL SECTION:
      - "نصيحة اليوم / Tip of the Day" card: surface card + left lime bar (not random pastel gradients). Content local — array of 30 AR/EN tips by day-of-year index.
      - Days streak counter: calculate from attendance history (last 7 days — use cached attendance).

4. HomeScreen shimmer loading: show 3 shimmer cards (header, membership card, stats) while data loads.

5. HomeScreen error state: AppErrorWidget with retry. On retry: HomeCubit.loadHome().

6. Status badge mapping (helper):
   active → color: suc500 #22C55E, text: "نشط / Active"
   expired → color: dng500 #EF4444, text: "منتهي / Expired"
   frozen → color: frz500 #22D3EE, text: "مجمد / Frozen"
   cancelled → color: c400/dtt grey, text: "ملغي / Cancelled"
   pending → color: pnd500 #FBBF24, text: "قيد الانتظار / Pending"

7. Days remaining calculation:
   Parse endDate (YYYY-MM-DD) as local date. Diff with today. If negative → expired.
   Format: if 0 → "تنتهي اليوم!", if 1 → "يوم واحد", 2-10 → "{N} أيام", 11+ → "{N} يوم".

8. Widget tests:
   - HomeLoaded state renders membership card with correct status color
   - Expired membership shows renewal CTA
   - Session pack shows sessions remaining ring (not expiry date)
   - Null membership shows "no membership" state
   - Pull to refresh calls HomeCubit.refreshHome()
   - Greeting is "صباح الخير" before noon and "مساء الخير" after

Deliver: HomeRepository, HomeCubit, HomeScreen with all sections. Design-system membership card (lime/charcoal). Full shimmer loading. Arabic/English bilingual.
```

---

### PROMPT 4 — QR Check-in Screen

```
CONTEXT: Home, auth, membership card exist. Member has active membership. /qr tab.

TASK: QR scanner screen for gym check-in.

API:
  POST /api/attendance/qr-checkin
  Headers: Authorization: Bearer {accessToken}
  Body: { gymCode: string }
  → 200 QrCheckinResponse | 400 { error: string } | 429 { error: string }

QrCheckinResponse shape (based on CheckinService):
{
  memberId: string, memberName: string, memberNumber: string,
  profilePhotoUrl: string?,
  membershipPlanName: string, membershipPlanNameAr: string,
  sessionNumber: int?, sessionsRemaining: int?,
  checkInTime: string (ISO8601),
  message: string, messageAr: string
}

Error codes in { error } string to map (based on CheckinService validation gauntlet):
"no_membership" | "expired" | "frozen" | "time_restricted" | "session_exhausted" | "already_checked_in" | "trial_visits_exhausted" | "trial_expired_join_offer"

Note: The gym's QR code encodes the gymCode string. The member's app scans it, then posts { gymCode } with their JWT to trigger check-in. The QR is the GYM's static QR — not the member's QR.

1. CheckinRepository: checkIn(gymCode) → Either<Failure, CheckinSuccessData>.

2. CheckinCubit: states CheckinIdle, CheckinScanning, CheckinProcessing, CheckinSuccess{data}, CheckinError{message, code}, CheckinAlreadyDone.
   Methods: startScan(), processQrResult(gymCode), reset().

3. QrScanScreen (/qr tab):

   a. SCANNER VIEW (fullscreen, mobile_scanner package):
      MobileScanner widget fills most of the screen.
      Overlay: custom painter that draws a pulsing rounded scan frame (lime l500/l400). Outside frame: semi-transparent charcoal overlay (c900 @ ~55%).
      Corner lime (l400) lines animate in on screen open (scale animation).
      Instruction text below frame: "وجّه الكاميرا نحو QR النادي / Point camera at gym QR code".
      
   b. QR VALIDATION:
      On barcode detected: pause scanner → extract raw value.
      Validate: check if value is a valid gymCode format (alphanumeric + dash, 5-20 chars) OR if it equals the stored gymCode from SecureStorage (gym-specific QR).
      If stored gymCode in storage → use it directly (member is at their gym).
      Emit CheckinProcessing → show loading overlay on scanner.
   
   c. SUCCESS STATE (full-screen modal, slide-up):
      Lottie animation: green checkmark pulse (play once, 1.5s).
      Member profile photo (CachedNetworkImage, circular, 80px, fallback: initials avatar).
      Member name (Arabic name preferred if available).
      Plan name: "{planNameAr} / {planName}".
      Check-in time: formatted "٩:٣٠ ص" (Arabic numeral option toggleable by locale).
      If session_pack: "الجلسة #{sessionNumber} — {sessionsRemaining} جلسات متبقية" with session dots.
      Auto-dismiss after 4 seconds → reset to scanner.
      Manual dismiss: tap anywhere.

   d. ERROR STATE (inline — do NOT navigate away):
      Show red pulsing border around scan frame.
      Error card slides up from bottom with icon + bilingual message.
      Icon varies by error type:
        no_membership → 🏋️ "لا توجد عضوية نشطة / No active membership"
        expired → ⏰ "انتهت عضويتك / Membership expired"
        frozen → ❄️ "عضويتك مجمدة / Membership frozen"
        time_restricted → 🕐 "خارج وقت الاستخدام / Outside allowed hours"
        already_checked_in → ✅ "سبق تسجيل حضورك اليوم / Already checked in today"
        session_exhausted → 📊 "انتهت جلساتك / No sessions remaining"
        trial_expired_join_offer → 🎁 "انتهت تجربتك — اشترك الآن / Trial ended — join now"
      Retry button → resets to scanning state.
      Rate limit 429 → "تباطأ قليلاً، حاول بعد دقيقة / Too many attempts, try again in a minute".

   e. MANUAL GYM CODE ENTRY (fallback):
      "إدخال يدوي / Enter manually" text button below scanner.
      Shows bottom sheet: text field for gymCode. Useful if QR scanning fails (poor lighting).

   f. ALTERNATIVE TAB: "رمزي / My QR" toggle button at top-right:
      Instead of scanner, show member's own QR code (for future use / staff scanning).
      Display: qr_flutter QrImageView encoding the member's memberId (Guid).
      Label: "رمز العضو / Member QR" — note in UI that this is for staff use.
      Member number displayed below QR.

4. Check-in haptics: on success → HapticFeedback.heavyImpact(). On error → HapticFeedback.vibrate().

5. Throttle: do not call API more than once per 3 seconds (Cubit debounce). After success, scanner remains paused for 3 seconds to prevent double-scan.

6. Widget tests:
   - QR value mismatch → shows error with correct message
   - Success state shows member name and plan name
   - Already checked in → shows already-checked-in message (not an error icon)
   - Rate limit error → shows throttle message
   - Manual entry submits gymCode correctly

Deliver: CheckinRepository, CheckinCubit, QrScanScreen with full scanner overlay, success modal, error states, member QR display.
```

---

## SPRINT 3

### PROMPT 5 — Membership Details & History

```
CONTEXT: Home, QR check-in work. Member can see membership card on home.

TASK: Full membership detail screen and membership history.

APIs:
  GET /api/members/{memberId}/membership     → MembershipSummaryDto (current)
  GET /api/memberships/{memberId}/history?page=1&pageSize=20
      → { items: MembershipHistoryItemDto[], totalCount, page, pageSize }

MembershipHistoryItemDto:
{
  id: string, planName: string, planNameAr: string, planType: string,
  startDate: string, endDate: string, status: string,
  amountPaid: decimal, paymentMethod: string, createdAtUtc: string,
  sessionsRemaining: int?
}

1. MembershipRepository: getCurrentMembership(memberId), getMembershipHistory(memberId, page, pageSize).

2. MembershipCubit: MembershipInitial, MembershipLoading, MembershipLoaded{current, historyPage1}, MembershipHistoryLoadingMore, MembershipError.
   Methods: load(memberId), loadMoreHistory(memberId, nextPage).

3. MembershipDetailScreen (/membership/:id):
   Launched from HomeScreen "View Details" or via deep link.
   
   a. TOP HERO CARD (surface card + top status accent bar — NOT full-bleed status gradients):
      Plan name large (Arabic IBM Plex Arabic) + English Space Grotesk below.
      Status badge centered (AppColors mapping).
      Expiry countdown: circular timer showing % of membership used:
        - time-based: (today - startDate) / (endDate - startDate) * 100
        - session_pack: (totalSessions - sessionsRemaining) / totalSessions * 100
      Outer ring: full circle in surface2/c700. Inner progress arc: lime l500 (fl_chart RadialBarChart or custom CustomPainter).
      Below ring: main stat (days remaining OR sessions remaining).
      
   b. MEMBERSHIP INFO LIST (card with rows):
      Membership plan type chip (Arabic label):
        monthly_unlimited → "شهري غير محدود"
        session_pack → "باقة جلسات"
        time_limited → "محدود بوقت"
        pt_credits → "جلسات تدريب"
        family → "عائلي"
        trial → "تجريبي مجاني"
        day_pass → "يوم واحد"
      Start date / End date (formatted DD MMM YYYY — Arabic month names in Arabic locale)
      Amount paid + payment method
      Auto-renew status (if applicable)
      If frozen: frozen from / until dates in a frz500 info box (not generic blue)

   c. TIMELINE BAR (custom widget):
      Visual horizontal bar: startDate ←——[today position]——→ endDate
      Color gradient: suc500 on left, dng500 on right. Today marker = vertical lime (l500) line.
      
   d. HISTORY SECTION (below, with header "السجل السابق / Previous Memberships"):
      Lazy-loading list (ListView.builder with pagination trigger).
      Each history item: mini card with plan name, status chip, date range, amount paid.
      Status chip colors same as main status mapping.
      Infinite scroll: when user reaches 80% of list → load next page.
      Loading indicator at bottom during page load.
      Empty state: "لا يوجد سجل سابق / No previous memberships".

4. Plan type icon mapping (icons to use with each planType):
   monthly_unlimited → Icons.calendar_month
   session_pack → Icons.fitness_center
   time_limited → Icons.access_time
   pt_credits → Icons.sports
   family → Icons.family_restroom
   trial → Icons.star_border
   day_pass → Icons.today

5. Date formatting helper (lib/core/extensions/date_extensions.dart):
   toArabicDateString() → "١٥ يناير ٢٠٢٦"
   toLocaleDateString(locale) → locale-aware formatted string
   daysUntil() → int (negative = past)
   arabicOrdinal(n) → Arabic ordinal string

6. Widget tests:
   - Session pack shows sessions progress, not days
   - Expired membership shows 0% progress ring and red status
   - History list loads more when scrolled to 80%
   - Frozen membership shows freeze info box

Deliver: MembershipRepository, MembershipCubit, MembershipDetailScreen with hero card, progress ring, info rows, timeline bar, and paginated history.
```

---

### PROMPT 6 — Attendance History Log

```
CONTEXT: Membership detail works. Now the /history tab.

TASK: Paginated attendance log with calendar heatmap and visit statistics.

API:
  GET /api/members/{memberId}/attendance?page=1&pageSize=20
  → { items: AttendanceHistoryItemDto[], totalCount, page, pageSize }

AttendanceHistoryItemDto (from GymAttendance entity):
{
  id: string, checkInAtUtc: string (ISO8601), checkOutAtUtc: string?,
  entryMethod: string (qr|manual), duration: string?,
  manualReason: string? (only for manual entries)
}

1. AttendanceRepository: getHistory(memberId, page, pageSize).

2. AttendanceCubit: AttendanceInitial, AttendanceLoading, AttendanceLoaded{items, totalCount, currentPage, hasMore, stats}, AttendanceLoadingMore, AttendanceError.
   loadHistory(memberId) → first page.
   loadMore(memberId) → append next page.
   Compute local stats from loaded items: visitsThisMonth, visitsThisWeek, currentStreak, longestStreak.

3. AttendanceHistoryScreen (/history tab):
   
   a. STATS HEADER (horizontal scroll row of 4 stat chips):
      - زيارات هذا الشهر / Visits this month: count (lime l500)
      - زيارات هذا الأسبوع / Visits this week: count
      - أطول سلسلة / Longest streak: N days
      - السلسلة الحالية / Current streak: N days 🔥

   b. MONTHLY CALENDAR HEATMAP:
      Custom widget (7-column grid, one cell per day of current month).
      Cell color intensity based on visit count: 0 = surface2/c600, 1 = l200/l300, 2+ = l500.
      Today has a circle outline. Tapping a day shows tooltip with visit count.
      Month navigation: left/right arrows to switch month.
      Load all history up to 3 months when building heatmap (or use loaded items, capped at available data).

   c. ATTENDANCE LIST (below heatmap, infinite scroll):
      Group by date header (e.g., "الأحد، ١٥ يناير" in Arabic, "Sunday, Jan 15" in English).
      Each item card:
        - Time: check-in time (converted from UTC to local Cairo time: +3 hours. Use intl.DateFormat with 'Africa/Cairo' timezone).
        - Duration: if checkOutAtUtc present → show duration (e.g., "١ ساعة ٢٠ دقيقة"). If not → show "—".
        - Entry method chip: QR (green chip) or يدوي / Manual (orange chip).
        - If manual: small note icon, expandable → show manualReason.
        - Left bar: color by entry method (qr → l500, manual → inf500).

   d. EMPTY STATE:
      Lottie animation of gym equipment. "لا توجد زيارات بعد / No visits yet". 
      If membership active: "سجل حضورك بمسح QR النادي / Check in by scanning the gym QR" → button navigates to /qr tab.

   e. STREAK CALCULATION (local, from items list):
      Sort attendances DESC by checkInAtUtc.
      currentStreak: count consecutive days with at least one visit, starting from today or yesterday.
      longestStreak: max consecutive day streak in all history.
      visitsThisMonth: count items where month(checkInAtUtc) == currentMonth.
      Cairo timezone offset: add 3 hours to UTC before computing local date.

4. Cairo timezone conversion (lib/core/utils/timezone_helper.dart):
   utcToCairo(DateTime utc) → DateTime: utc.add(Duration(hours: 3)).
   Note: Cairo is UTC+2 in winter and UTC+3 in summer (EET/EEST). For simplicity, use fixed +3 or use the `timezone` package if installed. Document the simplification.

5. Widget tests:
   - Heatmap renders correct number of days for February (28 or 29 based on year)
   - Attendance item shows duration when checkOut is present; shows dash when null
   - Manual entry shows expandable reason chip
   - Streak: fixture with visits Mon-Wed-Thu-Fri → currentStreak=4 (today = Fri)

Deliver: AttendanceRepository, AttendanceCubit, AttendanceHistoryScreen with stats header, calendar heatmap (custom widget), paginated attendance list, streak calculation.
```

---

## SPRINT 4

### PROMPT 7 — Notifications Center

```
CONTEXT: All core features done. Now implementing the notifications tab.

TASK: In-app notification center + Firebase push notification setup.

APIs:
  GET  /api/notifications?page=1&pageSize=20  → { items: NotificationDto[], totalCount, ... }
  POST /api/notifications/{id}/read           → { message: string }

NotificationDto shape (from Notification entity):
{
  id: string, title: string, titleAr: string,
  body: string, bodyAr: string,
  type: string, isRead: bool, createdAtUtc: string
}

Notification types from the API (map each to icon + AppColors — no invented purples/pinks):
  "membership_expiry"  → ⏰ wrn500
  "birthday"           → 🎂 t500 (teal) — not purple
  "checkin_success"    → ✅ suc500
  "general"            → 📢 inf500
  "payment"            → 💳 t400
  "freeze"             → ❄️ frz500
  "invitation"         → 👥 l500 (lime)

1. NotificationsRepository: getNotifications(page, pageSize), markAsRead(id).

2. NotificationsCubit: NotificationsInitial, NotificationsLoading, NotificationsLoaded{items, unreadCount, hasMore, page}, NotificationsLoadingMore, NotificationsError.
   loadNotifications() → first page.
   loadMore() → append.
   markRead(id) → optimistically update local item isRead=true → call API → revert on error.
   get unreadCount → filter items where !isRead.
   
   NOTE: unreadCount exposed as stream consumed by BottomNavBar badge (from P1 shell setup).

3. NotificationsScreen (/notifications tab):

   a. APP BAR:
      "الإشعارات / Notifications" title.
      "تحديد الكل كمقروء / Mark all read" action button (top-right).
      (API doesn't have mark-all-read endpoint — call markAsRead for each unread item in series. Add loading indicator.)

   b. FILTER CHIPS ROW (horizontal scroll):
      All | Unread | Membership | Payment | General
      Active chip uses lime l100/l500 text (light) or rgba lime fill (dark). Filters the loaded list locally (no re-fetch).

   c. NOTIFICATION LIST (infinite scroll, grouped by date):
      Date headers: "اليوم / Today", "أمس / Yesterday", then date strings.
      Each notification card:
        - Left icon (type-specific, colored circle background).
        - Title (Arabic preferred when arabic locale active, else English).
        - Body text (truncated to 2 lines, expand on tap).
        - Time ago string (منذ دقيقتين، منذ ساعة، أمس، etc.).
        - Unread indicator: left accent bar (2px wide, lime l500). Fades away after markRead.
        - Tap → expand full body, mark as read (API call + local state update).
        - Swipe-to-dismiss: slide left → marks as read (no delete, API doesn't support it).
      
      Unread items appear with slightly lighter background.

   d. EMPTY STATE:
      Lottie animation of empty bell. "لا توجد إشعارات / No notifications yet."

4. FIREBASE PUSH NOTIFICATIONS:
   FirebaseMessagingService (lib/core/push/):
   - Initialize FirebaseMessaging.instance in main.dart after auth check.
   - Request permission (iOS). Request notification permission (Android 13+).
   - On foreground message: show flutter_local_notifications local notification.
   - On background/terminated tap: navigate to /notifications tab via GoRouter.
   - FCM token: GET and store in SecureStorage. Expose getFcmToken() method.
   Note: No API endpoint to register FCM token yet — store locally for when backend adds it. Document this gap.
   
   Local notification channel setup:
   Channel ID: "gymflow_notifications"
   Channel name: "HyMotion"
   Icon: notification icon (add ic_notification.png to android/app/src/main/res/drawable/)

5. Notification badge:
   BottomNavBar notification tab shows red badge with unreadCount when > 0.
   Badge disappears when count is 0.
   Badge uses flutter_badges package (add to pubspec) or custom Stack+Positioned.

6. Time ago formatter (lib/core/extensions/):
   timeAgo(DateTime utc, {String locale}) → String
   Arabic: "منذ ثوانٍ", "منذ دقيقة", "منذ {N} دقائق", "منذ ساعة", "منذ {N} ساعات", "أمس", "منذ {N} أيام"
   English: "just now", "1 minute ago", "{N} minutes ago", "1 hour ago", etc.

7. Widget tests:
   - Unread notification has lime left bar; read notification does not
   - Mark-read optimistically updates list before API responds
   - Filter chip "Unread" hides read notifications
   - Badge disappears when all notifications marked read
   - Date grouping: today's notifications under "اليوم", yesterday's under "أمس"

Deliver: NotificationsRepository, NotificationsCubit, NotificationsScreen, FirebaseMessagingService, local notification setup, time-ago formatter, badge integration.
```

---

### PROMPT 8 — Guest Invitation System

```
CONTEXT: Home, check-in, membership, attendance, notifications all work.

TASK: Guest invitation flow. Members can invite guests up to their monthly quota.

APIs:
  POST /api/invitation/send
  Body: { guestName: string, guestPhone: string, visitDate: string (YYYY-MM-DD) }
  → SendInvitationResponse | 400 { error: string }
  
  GET /api/invitation/history
  → InvitationHistoryResponse[]

Note: guestName should be in Arabic if possible. The member_id is resolved from JWT on the backend — no memberId needed in request body.

SendInvitationResponse:
{
  invitationId: string, quotaRemaining: int, message: string, messageAr: string
}

InvitationHistoryResponse (from MemberInvitation entity):
{
  id: string, guestName: string, guestPhone: string,
  visitDate: string, status: string (pending|used|cancelled|expired),
  createdAtUtc: string, usedAtUtc: string?
}

Quota remaining shown on HomeScreen (invitationQuotaRemaining from MemberDetailDto).

1. InvitationRepository: sendInvitation(guestName, guestPhone, visitDate) → Either<Failure, InvitationSentData>. getHistory() → Either<Failure, List<InvitationHistoryItem>>.

2. InvitationCubit: InvitationInitial, InvitationLoading, InvitationLoaded{history, quotaRemaining}, InvitationSending, InvitationSent{quotaRemaining}, InvitationError{message, code}.
   Errors to map:
   - "quota exceeded" / "quota_exceeded" → "لقد استنفدت حصتك الشهرية من الدعوات / Monthly invitation quota exhausted"
   - "guest already invited" → "هذا الهاتف تم دعوته بالفعل هذا الشهر / Guest already invited this month"
   - "invalid phone" → "رقم هاتف الضيف غير صحيح / Invalid guest phone number"
   - "no active membership" → "يجب أن تكون عضويتك نشطة لدعوة الضيوف / Active membership required to invite guests"

3. InvitationScreen (/invite — accessible from HomeScreen quick-actions or profile):

   a. HEADER:
      Quota indicator: "{quotaRemaining} دعوات متبقية هذا الشهر / {quotaRemaining} invitations left this month".
      Large number display (lime l500 / Space Grotesk). If 0 → show tertiary grey "لا توجد دعوات متبقية / No invitations left" with reset date hint (1st of next month).
      Monthly quota progress bar: (totalQuota - quotaRemaining) / totalQuota (totalQuota not from API — show only quotaRemaining as fraction N/? if total unknown — or ask: show N remaining).

   b. SEND INVITATION FORM (card):
      Field 1: Guest name — text input, label "اسم الضيف / Guest name". Required, min 2 chars.
      Field 2: Guest phone — phone input (+20 prefix locked). Same normalizer from P1.
      Field 3: Visit date — DatePicker. Min: tomorrow. Max: +14 days from today. Formatted YYYY-MM-DD for API, displayed DD/MM/YYYY in UI.
      "إرسال الدعوة / Send Invitation" button — disabled if quota=0 or form invalid.
      Loading state on submit: button shows spinner.
   
   c. SUCCESS BOTTOM SHEET (slides up, ≥50% screen height):
      Lottie confetti animation (play once).
      "تم إرسال الدعوة! 🎉" (Arabic).
      Guest name + visit date summary.
      Remaining quota: "باقي لك {N} دعوات هذا الشهر".
      "شارك الدعوة / Share Invitation" button → uses Share.share() to open system share sheet.
        Share text: "أنا أدعوك لزيارة النادي في {visitDate}! 💪\n{gymName}"
      "دعوة أخرى / Another Invitation" → reset form (if quota > 0).
      "إغلاق / Close" → dismiss.

   d. HISTORY SECTION (below form, scrollable):
      Header: "دعوات سابقة / Previous Invitations" with history count.
      Each item:
        - Guest name + masked phone (show last 4 digits: +20 *** *** 4567)
        - Visit date + status chip:
          pending → "بانتظار الزيارة / Pending" (blue)
          used → "تمت الزيارة / Visited" ✅ (green)
          cancelled → "ملغاة / Cancelled" (grey)
          expired → "انتهت / Expired" (red)
        - Created at time-ago.
      Empty state: "لم ترسل أي دعوات بعد / You haven't sent any invitations yet".

4. Phone masking helper (lib/core/utils/):
   maskPhone(String phone) → "+20 *** *** {last4}"

5. Widget tests:
   - Form disabled when quotaRemaining = 0
   - Invalid guest phone shows field error
   - Past dates not selectable in date picker
   - Success sheet shows correct remaining quota (quotaRemaining - 1)
   - History shows masked phone numbers
   - Used invitation has green chip; expired has red chip

Deliver: InvitationRepository, InvitationCubit, InvitationScreen (form + history), success bottom sheet, phone masker, share integration.
```

---

## SPRINT 5

### PROMPT 9 — Profile Screen + Settings

```
CONTEXT: All main features built. Now the profile tab.

TASK: Profile screen with edit capability, account settings, and sign-out.

APIs:
  GET /api/members/{memberId}          → MemberDetailDto
  PUT /api/members/{memberId}          → MemberDetailDto
  Body: UpdateMemberRequest (partial)
  
UpdateMemberRequest (from entity): { fullName?, fullNameAr?, email?, profilePhotoUrl?, notes? }
(Phone number is not editable by member — only by staff.)
(NationalIdEncrypted is not exposed to members.)

1. ProfileRepository: getProfile(memberId), updateProfile(memberId, UpdateProfileRequest), uploadPhoto(File) → photoUrl.
   uploadPhoto: use multipart form POST to /api/file-upload (check if endpoint exists — if not, skip upload and store base64 locally or show "photo upload coming soon" message). If endpoint exists, use it. If not, disable photo upload gracefully.

2. ProfileCubit: ProfileInitial, ProfileLoading, ProfileLoaded{member}, ProfileSaving, ProfileSaved, ProfileError, ProfilePhotoUploading.
   loadProfile(memberId), saveProfile(memberId, request), pickAndUploadPhoto().

3. ProfileScreen (/profile tab):

   a. PROFILE HEADER:
      Large avatar (120px circle):
        - If profilePhotoUrl: CachedNetworkImage.
        - Else: initials avatar (Space Grotesk letters on l300 lime background, text c900).
        - Edit overlay: camera icon bottom-right (small FAB style). Tap → ImagePicker (gallery + camera option sheet). After pick: crop (image_cropper if available, else skip) → upload → update avatar.
      Member full name (Arabic, bold, large).
      Member number (small, grey).
      Gym name from gymCode (stored locally).

   b. MEMBERSHIP QUICK CARD (compact version, not full detail):
      Plan name, status chip, expiry date. Tap → /membership.

   c. INFO SECTION (tap to edit):
      "معلوماتي / My Info" section card:
        - Full name (Arabic) — editable
        - Full name (English) — editable  
        - Email — editable (optional, can be empty)
        - Phone number — readonly (labelled "يُعدَّل عن طريق النادي / Edit via gym")
        - Date of birth — readonly (show age: "{N} سنة")
      In view mode: tap any editable field → goes to edit mode.

   d. EDIT MODE:
      "تعديل / Edit" button in top-right → all editable fields become TextFields.
      Validation:
        - Full name Arabic: min 2 chars, Arabic characters allowed (regex: [\u0600-\u06FF\s])
        - Full name English: min 2 chars, Latin chars
        - Email: valid email format or empty
      "حفظ / Save" button: call updateProfile → show success snackbar → return to view mode.
      "إلغاء / Cancel": discard changes → view mode.
      Loading: Save button shows spinner, all fields disabled.

   e. SETTINGS SECTION:
      "الإعدادات / Settings" section card:
        Language: toggle between العربية / English. Changes app locale immediately. Persist in SharedPreferences (not secure storage — not sensitive).
        Notifications: toggle switch. Persist locally (no API endpoint exists yet — store preference and skip push registration when off).
        About: version number (from package_info_plus), "سياسة الخصوصية / Privacy Policy" link (webview or external URL).

   f. ACCOUNT CREDIT BALANCE (quick view):
      Credit balance from HomeScreen cached data. "رصيد الحساب / Account Credit: {N} ج.م". Tapping → shows a simple ledger modal (use data from GET /api/members/{id}/credits).

   g. SIGN OUT:
      Red outlined "تسجيل الخروج / Sign Out" button at bottom.
      Confirmation dialog: "هل تريد تسجيل الخروج؟ / Are you sure you want to sign out?"
      On confirm: AuthCubit.signOut() → GoRouter redirects to /login.

4. Language toggle (lib/core/):
   LocaleCubit: manages app locale (ar / en).
   Persists to SharedPreferences key "app_locale".
   MaterialApp.locale bound to LocaleCubit.state.

5. Widget tests:
   - Edit mode: Save disabled until form is dirty and valid
   - Arabic name validation: "Ahmed" (Latin) shows field error for Arabic name field
   - Cancel in edit mode restores original values
   - Sign out dialog: cancel keeps user logged in; confirm triggers AuthCubit.signOut()
   - Language toggle changes locale immediately

Deliver: ProfileRepository, ProfileCubit, ProfileScreen (view + edit + settings), LocaleCubit, language toggle, sign-out flow.
```

---

### PROMPT 10 — Polish, Performance & Release Prep

```
CONTEXT: All 9 feature screens are complete and functional. This prompt handles cross-cutting polish, performance, deep links, error resilience, and release readiness.

TASK: No new feature screens — only improvements and release prep.

1. CONNECTIVITY HANDLING:
   ConnectivityService (lib/core/): uses connectivity_plus package.
   - On app start and on resume: check connectivity.
   - Show persistent banner ("لا يوجد اتصال بالإنترنت / No internet connection" — red) when offline.
   - Retry mechanism: all Cubits expose refresh() method. Banner has "إعادة المحاولة / Retry" button.
   - Offline graceful degradation: show cached data (from last successful load) when offline, with "بيانات محفوظة / Cached data" label.

2. PULL-TO-REFRESH EVERYWHERE:
   Audit all list screens (Home, Attendance, Notifications, Invitations). Every screen must have RefreshIndicator with correct Cubit refresh method wired. Consistent behavior: refreshing always goes to page 1 and clears existing list.

3. DEEP LINK HANDLING (go_router):
   URI scheme: gymflow://
   Configure Android intent-filter and iOS CFBundleURLTypes for gymflow:// scheme.
   Supported deep links:
   - gymflow://membership → /membership (requires auth)
   - gymflow://checkin → /qr (requires auth)
   - gymflow://notifications → /notifications (requires auth)
   - gymflow://invite → /invite (requires auth)
   All deep links: if not authenticated → store target → after login navigate to target.

4. ANALYTICS (Firebase Analytics — optional no-op if not configured):
   Track these events:
   - qr_checkin_success { planType }
   - qr_checkin_error { errorCode }
   - invitation_sent
   - notification_opened { type }
   - screen_view (automatic via GoRouter observer)
   Wrap in AnalyticsService with no-op fallback if Firebase not configured.

5. PERFORMANCE:
   a. Image caching: ensure all CachedNetworkImage uses maxWidthDiskCache=200 for avatars, 400 for larger images.
   b. List builders: all infinite scroll lists use ListView.builder (never ListView with children). Verify const constructors used for all static widgets.
   c. Shimmer memory: dispose animation controllers in shimmer widgets.
   d. Cubit cleanup: verify all Cubits are closed in their BlocProvider dispose.
   e. API batching: HomeScreen already uses Future.wait. Ensure no sequential awaits where parallel is possible.
   f. Run flutter build apk --analyze-size and document top 5 contributors.

6. CRASH REPORTING:
   FirebaseCrashlytics setup. Wrap main() in runZonedGuarded.
   FlutterError.onError → FirebaseCrashlytics.instance.recordFlutterFatalError.
   Custom keys: set member_id, gym_code, app_version on Crashlytics context after login.

7. ACCESSIBILITY:
   All interactive widgets have Semantics labels. Arabic Semantics label + English label where both locales supported. Minimum tap target: 44×44px (add SizedBox wrappers where needed). Check: flutter analyze --suppress=unused_import should return 0 issues.

8. TOKEN REFRESH EDGE CASES:
   - Scenario: two API calls fire simultaneously when token is expired. Ensure Dio interceptor uses a lock (Mutex from synchronized package) so only ONE refresh call is made, and both requests wait for it.
   - Implement: add `synchronized` package. In auth_interceptor.dart, use a boolean _isRefreshing lock + queue of waiting requests.
   - Write integration test: simulate two simultaneous 401 responses → verify /api/auth/refresh called exactly ONCE.

9. LOCALIZED DATE/NUMBER FORMATTING AUDIT:
   Audit ALL date and number displays in the app:
   - Dates in Arabic locale: use Arabic month names (يناير، فبراير...).
   - Numbers in Arabic locale: use Western Arabic numerals (0-9), NOT Eastern Arabic (٠-٩) — Egyptian users prefer standard digits.
   - Currency: always show as "X.XX ج.م" — never just "{N}".
   - Times: 12-hour with Arabic AM/PM (ص/م) in Arabic locale.

10. UNIT + INTEGRATION TESTS:
    Golden tests for:
    - MembershipCard in active/expired/frozen/cancelled states (4 goldens)
    - Attendance calendar heatmap for month with visits (1 golden)
    - OTP input box in idle/focused/error states (3 goldens)
    
    Integration tests (using integration_test package):
    - Full auth flow: enter gym code → phone → OTP (mock API) → home screen loads
    - QR scan → success screen appears → auto-dismisses after 4s
    - Pull to refresh on home → API called again
    
    Run: flutter test test/ && flutter test integration_test/

11. RELEASE CONFIG:
    android/app/build.gradle:
      minSdkVersion 23, targetSdkVersion 34
      applicationId "com.HyMotion.member"
      Version from pubspec: 1.0.0+1
    
    ios/Runner/Info.plist: minimum iOS 13.
    
    Proguard rules for Dio, flutter_secure_storage (standard rules — add to android/app/proguard-rules.pro).
    
    Build release APK: flutter build apk --release --dart-define=ENV=production
    Build iOS IPA: flutter build ipa --release --dart-define=ENV=production
    
    Create README.md in project root:
      - Setup instructions
      - Environment configuration  
      - API integration notes
      - Known limitations (FCM token registration endpoint pending, file upload endpoint TBD)

12. FINAL CHECKLIST (verify all before deliverable):
    [ ] flutter analyze returns 0 issues
    [ ] flutter test returns all passing
    [ ] No hardcoded strings (all in arb files)
    [ ] No hardcoded colors (all from AppColors — lime/charcoal tokens only)
    [ ] Light AND dark themes render correctly on both iOS and Android
    [ ] No Inter / Cairo / navy / gym-red leftovers in theme or widgets
    [ ] Arabic RTL layout correct on all screens
    [ ] Pull-to-refresh on all list screens
    [ ] Shimmer loading on all data screens
    [ ] Empty states on all list screens
    [ ] Error states with retry on all screens
    [ ] Token refresh works (manual test: let token expire, use app)
    [ ] Sign-out clears all stored data (verify with flutter_secure_storage debug read after sign-out)

Deliver: ConnectivityService, deep link config, AnalyticsService, Crashlytics setup, token refresh mutex, golden tests, integration tests, proguard rules, README.md, final audit fixes.
```

---

## Appendix A — API Error Code Quick Reference

| API Error String | Flutter Failure | Arabic Message |
|---|---|---|
| "Phone number not found" | memberNotFound | رقم الهاتف غير مسجل في هذا النادي |
| "Invalid gym code" | gymNotFound | كود النادي غير صحيح |
| "Invalid OTP" | otpInvalid | رمز التحقق غير صحيح أو منتهي الصلاحية |
| "disabled" / "inactive" | accountInactive | حسابك موقوف. تواصل مع النادي |
| "no_membership" | noMembership | لا توجد عضوية نشطة |
| "expired" | membershipExpired | انتهت عضويتك |
| "frozen" | membershipFrozen | عضويتك مجمدة |
| "time_restricted" | timeRestricted | خارج وقت الاستخدام المسموح |
| "already_checked_in" | alreadyCheckedIn | سبق تسجيل حضورك اليوم |
| "session_exhausted" | sessionsExhausted | انتهت جلساتك |
| "trial_expired_join_offer" | trialExpired | انتهت تجربتك المجانية — اشترك الآن |
| "quota exceeded" | quotaExceeded | استنفدت حصتك الشهرية من الدعوات |
| Network error | networkError | تحقق من اتصالك بالإنترنت |
| 401 after refresh | sessionExpired | انتهت جلستك. أعد تسجيل الدخول |
| 500 | serverError | خطأ في الخادم. حاول لاحقاً |

---

## Appendix B — Update Prompt 0 After Each PR

```
DONE P1: Project scaffold, theme, localization (60 keys), ApiClient+AuthInterceptor, SecureStorage, AuthCubit, GoRouter, BottomNavBar shell, AppShimmer, PhoneNormalizer.
DONE P2: AuthRepository, AuthCubit full states, GymCodeScreen, PhoneScreen, OtpScreen (animated boxes), SplashScreen. OTP auto-submit, resend countdown, shake animation.
DONE P3: HomeRepository (parallel Future.wait), HomeCubit, HomeScreen (design-system membership card, stats row, tips). Shimmer loading, pull-to-refresh.
DONE P4: CheckinRepository, CheckinCubit, QrScanScreen with scanner overlay, success modal (Lottie), error states per error code, member QR display, manual gymCode entry fallback, haptic feedback.
DONE P5: MembershipRepository, MembershipCubit, MembershipDetailScreen (hero card, progress ring, timeline bar, paginated history).
DONE P6: AttendanceRepository, AttendanceCubit, AttendanceHistoryScreen (stats header, calendar heatmap custom widget, paginated list grouped by date, streak calculation).
DONE P7: NotificationsRepository, NotificationsCubit, NotificationsScreen (filter chips, grouped list, swipe-to-read), FirebaseMessagingService, local notifications, unread badge.
DONE P8: InvitationRepository, InvitationCubit, InvitationScreen (quota display, form with phone normalizer, date picker, success bottom sheet, history). Phone masker.
DONE P9: ProfileRepository, ProfileCubit, ProfileScreen (view/edit, avatar upload, settings), LocaleCubit (language toggle), sign-out flow.
DONE P10: ConnectivityService, deep links, AnalyticsService, Crashlytics, token refresh mutex, golden tests, integration tests, proguard, README.
```
