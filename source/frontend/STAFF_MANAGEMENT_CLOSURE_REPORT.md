# Staff Management Closure Report

Verified 2026-08-15 against the running stack; last-login list/detail re-verified 2026-08-16 after `GMS.Api` restart.

- `GMS.Api` restarted with `--launch-profile https` (`https://localhost:5001`)
- Staff desk `http://localhost:3000/dashboard/staff/` → HTTP 200
- Seed owner `owner@gymflow.test` / `GYM-TEST-01`

No Employee, Person, Branch, custom roles, phone API, photo upload, or custom permissions were added. Backend `AnyStaff` was not changed.

---

## 1. Final Architecture

```text
ApplicationUser  (AspNetUsers)
        │
        │  AppUser.UserId = ApplicationUser.Id.ToString()
        ▼
AppUser          (app_users)
```

| ID | Responsibility |
|---|---|
| `ApplicationUser.Id` | Identity PK. JWT `sub`. Staff API `{id}`. RefreshToken.UserId. Permission cache key. |
| `AppUser.Id` | Domain PK. `AuditEvent.ActorUserId`. Check-in / shift actor. |
| `AppUser.UserId` | String link to Identity id. Not interchangeable with `AppUser.Id`. |

They are different GUIDs. Live proof: owner Identity `f8677f57-8b74-46a1-9698-08deadd7eaba` vs owner AppUser `23a34be5-2e50-4c0f-a199-b8dff9a32c28`.

---

## 2. Implemented Changes

### Backend

- `AuthService.LoginAsync` writes `AppUser.LastLoginAtUtc` on password login (refresh path explicitly does not).
- Login AppUser lookup uses `IgnoreQueryFilters()` then `UserId == ApplicationUser.Id.ToString() AND TenantId == tenant.Id` (anonymous login has empty TenantContext).
- Staff list/detail match `AppUser.LastLoginAtUtc` with case-insensitive `UserId` (seed rows store Identity id uppercase).
- Owner cannot be demoted, deactivated, or deleted (`OWNER_PROTECTED` → HTTP 403).
- Staff CRUD audits: `staff.create`, `staff.update`, `staff.role_change`, `staff.deactivate`, `staff.reactivate`, `staff.password_reset`.
- Password reset revokes refresh tokens.
- PUT staff is `[RejectImpersonation]` (DELETE and reset-password already were).
- Reactivation re-checks `staff_seats` before enabling.
- Read-only `profilePhotoUrl` on staff DTOs.

### Frontend

- Staff desk: search, role filter, status filter, Staff 360 (Profile / Account / Access / Activity).
- Owner row is view-only.
- Password UI matches Identity (6+, digit, lower, upper; special optional).
- Email hint: unique across HyMotion, not “this gym only”.
- `Never logged in` when `lastLoginAt` is null.
- No National ID / job title / department / hire date / staff number / Branch / Send Invite.

### Contracts / tests

- `FRONTEND_API_CONTRACTS.ts` and admin `types.ts`: `member_orders.view`, `member_orders.manage`; no duplicate `inventory.transfer`.
- AnyStaff contract comment: backend is Owner\|Manager\|Trainer.
- Tests: `AdminServiceStaffManagementTests`, `AuthStaffLastLoginTests`, `StaffRolePolicyTests`, plus existing isolation and seat-cap tests.

---

## 3. Security Verification

| Check | Result | Evidence |
|---|---|---|
| Tenant isolation | **PASS (live)** | Owner token GET/PUT/DELETE/reset against foreign Identity `0957dac9-9d30-4f36-9204-23485730a3c9` (other tenant) → HTTP 404. Unknown GUID → 404. Unit: `AdminServiceTenantIsolationTests`. |
| Owner protection | **PASS (live)** | Demote → 403 `OWNER_PROTECTED`. Deactivate with empty role → 403 `OWNER_PROTECTED`. DELETE → 403. |
| Impersonation | **PASS (code)** | `[RejectImpersonation]` on PUT, DELETE, reset-password. Not exercised with a live impersonation JWT in this pass. |
| Refresh revocation | **PASS (live + SQL)** | Deactivate: login 401 “disabled”; refresh 401 “expired or revoked”; `refresh_tokens.RevokedAtUtc` set. Password reset: prior refresh → 401; new password login → 200. |
| Role authorization | **PASS** | Staff APIs `OwnerOnly`. Create rejects Owner / Member / janitor (HTTP 400). Backend `AnyStaff` still Owner\|Manager\|Trainer (`Program.cs`). `StaffRolePolicyTests` green. |
| Permission behavior | **PASS (unit)** | Role change invalidates permission cache (`AdminServiceStaffManagementTests`). `PermissionsOverride` still ignored. Live Redis cache contents were not inspected. |
| Seat cap | **PASS (live + unit)** | Live create at cap → HTTP 402 `PLAN_LIMIT_EXCEEDED`. Reactivate while over cap → 402; after deactivating extras → 200. Unit: `Cp4UsageEnforcementTests.StaffSeats_HardBlock`. Inactive staff do not count (`IsActive = 1`). |

Note: a PUT that sends `role: "Owner"` on the owner row returns HTTP 400 (invalid create-style role) before `OWNER_PROTECTED`. The owner is still not mutated. Sending empty role or a creatable role correctly returns 403.

---

## 4. Audit Verification

Live `GET /api/audit?entityType=Staff&entityId={Identity id}` for created staff:

| Action | Live |
|---|---|
| `staff.create` | PASS |
| `staff.update` | PASS |
| `staff.role_change` | PASS |
| `staff.deactivate` | PASS |
| `staff.reactivate` | PASS (after seat room existed) |
| `staff.password_reset` | PASS |

Actor:

```text
AuditEvent.ActorUserId = 23a34be5-2e50-4c0f-a199-b8dff9a32c28  (owner AppUser.Id)
ApplicationUser.Id     = f8677f57-8b74-46a1-9698-08deadd7eaba  (JWT sub)
EntityId               = staff ApplicationUser.Id
```

**PASS:** actor is `AppUser.Id`, not Identity id. Also covered by `AuditActor_IsAppUserId_NotIdentityId`.

Secrets: password reset audit `after` is `{ identityUserId }` only. Live reset response does not echo the password.

---

## 5. Last Login Verification

### Intended rule

```text
Password login  → AppUser.LastLoginAtUtc = UtcNow
Refresh         → unchanged
Profile / role / deactivate  → unchanged
```

### Unit tests

`AuthStaffLastLoginTests` **passed**, including:

- `Login_WithoutTenantContext_WritesLastLogin_RefreshDoesNot` — does **not** call `SetTenant` before login (production scenario).
- `Login_IgnoreQueryFilters_DoesNotUpdateOtherTenantAppUser` — same Identity `UserId` on tenant B is not updated.
- Existing login/refresh tests that do set TenantContext.

### Live (re-verified 2026-08-16 after persist + list casing fixes)

`GMS.Api` restarted after the list dictionary fix.

Password login as `owner@gymflow.test` / `GYM-TEST-01`:

```text
GET /api/admin/staff/{id}  lastLoginAt = 2026-08-15T21:38:49.2997028Z
GET /api/admin/staff       lastLoginAt = 2026-08-15T21:38:49.2997028Z  (same)
```

`POST /api/auth/refresh` → 200. Detail `lastLoginAt` unchanged.

Manager password login then list:

```text
manager@gymflow.test lastLoginAt = 2026-08-15T21:39:01.8837077Z
```

Accounts that never logged in still return null (10 rows, including leftover `e2e.*` users) → UI “Never logged in”.

**Persist root cause:** `LoginAsync` queried `AppUsers` under the global tenant filter while `TenantContext.TenantId` was `Guid.Empty`.

**Persist fix:** `IgnoreQueryFilters()` on that lookup, still constrained by Identity id **and** resolved `tenant.Id`.

**List root cause:** seed `AppUser.UserId` is uppercase (`F8677F57-...`); list used a case-sensitive dictionary keyed by `ApplicationUser.Id.ToString()` (lowercase). Detail used SQL collation (case-insensitive), so 360 could show a time while the table showed Never.

**List fix:** case-insensitive `UserId` dictionary / match. Test: `LastLogin_ListMatchesWhenAppUserUserIdCasingDiffers`.

---

## 6. Frontend Verification

| Screen / rule | Result |
|---|---|
| Owner can open Staff | PASS — `/dashboard/staff/` 200; nav `OwnerOnly`; `GET /api/admin/staff` 200 |
| List: search, role, status, table | PASS — present in live HTML |
| Owner view-only | PASS — Edit / Reset / Deactivate disabled for Owner; 360 footer view-only |
| Create fields only name/email/password/role | PASS — Manager, Trainer, Receptionist cards only |
| Staff 360 Profile / Account / Access / Activity | PASS — implemented in `staff-app.js`; Activity loads `GET /audit?entityType=Staff&entityId=` |
| Never logged in | PASS — display path when null; live detail DTO now has a timestamp |
| Password policy 6+ / upper / lower / digit; special optional | PASS — UI + `staff.selftest` |
| No National ID, Job Title, Department, Hire Date, Staff Number, Branch | PASS — not in live HTML or staff JS |
| No Send Invite | PASS — not in staff folder |
| `member_orders.view` / `member_orders.manage` | PASS — `FRONTEND_API_CONTRACTS.ts`, admin `types.ts`, `staff-rules.js` |

Browser click-through of the 360 drawer was not done; verification is live HTML/JS + live API.

---

## 7. Tests

### Backend (actually run after persist fix; API stopped for rebuild)

```text
Passed: 27  Failed: 0
AdminServiceStaffManagementTests (includes uppercase UserId list/detail)
AuthStaffLastLoginTests (includes no-TenantContext + cross-tenant isolation)
StaffRolePolicyTests
AdminServiceTenantIsolationTests
```

### Frontend (actually run)

```text
node apps/web/src/app/(dashboard)/staff/staff.selftest.js
All staff.selftest checks passed.
```

### End-to-end / live API (actually run against https://localhost:5001)

| # | Check | Result |
|---|---|---|
| 1 | Owner opens Staff / list loads | PASS |
| 2 | Owner in list, view-only | PASS |
| 3 | Create Manager / Trainer / Receptionist | PASS (201) |
| 4 | Reject Owner / Member / unknown role | PASS (400) |
| 5 | Seat limit | PASS (402 live at Growth cap 10) |
| 6 | New staff login | PASS |
| 7 | Password login writes LastLoginAtUtc | PASS (detail + list after casing fix) |
| 8 | Refresh does not write last login | PASS (live timestamp unchanged) |
| 8b | Staff list lastLoginAt matches detail (UserId casing) | PASS |
| 9 | Staff 360 sections in desk JS | PASS |
| 10 | Never logged in when null | PASS |
| 11 | Role change Manager → Trainer | PASS |
| 12 | Owner demote / deactivate / delete | PASS (403) |
| 13 | Deactivate both IsActive=false, keep Identity role, revoke refresh | PASS (API + SQL) |
| 14 | Deactivated cannot login or refresh | PASS |
| 15 | Reactivate respects seat cap, then works | PASS |
| 16 | Password reset + new password login | PASS |
| 17 | Reset revokes prior refresh | PASS (401) |
| 18 | Staff audit actions + actor AppUser.Id | PASS |
| 19 | Tenant isolation all staff endpoints | PASS (live 404) |
| 20 | Contracts member_orders.* | PASS |
| 21 | No fake HR fields / Send Invite | PASS |
| 22 | Password UI vs Identity | PASS |
| 23 | AnyStaff unchanged | PASS (`Owner, Manager, Trainer` only) |

---

## 8. Remaining Known Issues

Intentionally unchanged:

```text
AnyStaff excludes Receptionist          (backend policy; frontend GfpAuthz includes Receptionist for nav kind:any only)
No phone on staff API
No photo upload
PermissionsOverride ignored / no custom permissions UI
No Branch domain
No Employee / Person entity
```

Also:

- PUT `role: "Owner"` on the owner returns 400 invalid-role rather than 403 `OWNER_PROTECTED`. Owner is still not changed.
- Access-token TTL (~15 min) is unchanged; deactivation/reset revoke refresh only.
- E2E created extra `e2e.*@gymflow.test` users on the local `GYM-TEST-01` tenant; extras were deactivated. Safe to leave or deactivate the remaining test Trainer.

---

## 9. Final Verdict

```text
STAFF MANAGEMENT: CLOSED
```

Last-login persist (`IgnoreQueryFilters` on anonymous login) and list/detail `UserId` casing are verified live. Owner protection, tenant isolation, audit actor = `AppUser.Id`, seat cap, soft deactivate, and password-reset refresh revocation remain as previously verified. No Employee/Person/Branch. Backend `AnyStaff` unchanged (Owner | Manager | Trainer).
