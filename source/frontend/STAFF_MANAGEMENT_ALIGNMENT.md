# Staff Management Alignment

Inspected against the live repository on 2026-08-15. Claims in the original prompt were verified against code; several comments and contracts are already stale. This document is the source of truth for the alignment pass.

## Implementation status (2026-08-15)

**Shipped.** Preview: `previews/staff-management-alignment.html`. Live desk: `/dashboard/staff/`. No migration.

| Item | Status |
|---|---|
| Last login written on password login only (not refresh) | Done — `AuthService.LoginAsync` |
| Staff DTOs map `AppUser.LastLoginAtUtc` (never `UpdatedAtUtc`) | Done |
| Owner cannot be demoted / deactivated / deleted | Done — API `OWNER_PROTECTED` 403 + UI view-only |
| Staff CRUD audit (`staff.create` / `update` / `role_change` / `deactivate` / `reactivate` / `password_reset`) | Done — actor is `AppUser.Id` |
| Password reset revokes refresh tokens | Done |
| PUT staff `[RejectImpersonation]` | Done |
| Password UX matches Identity (6+, digit, lower, upper; special optional) | Done |
| Email uniqueness copy is global, not “this gym only” | Done |
| `member_orders.*` on frontend `PermissionKey`; no duplicate `inventory.transfer` | Done |
| Backend `AnyStaff` still Owner\|Manager\|Trainer | Unchanged on purpose |
| Phone / photo upload / Branch / Employee | Out of scope |

Tests: `AdminServiceStaffManagementTests`, `AuthStaffLastLoginTests`, `StaffRolePolicyTests`, `AdminServiceTenantIsolationTests`, `Cp4UsageEnforcementTests` (staff seats), `npm run test:staff`.

---

## 1. Current Staff architecture

Staff is **not** an Employee/Person/HR aggregate. It is an Identity user plus a domain mirror:

```text
ApplicationUser  (AspNetUsers, Identity PK)
        │
        │  AppUser.UserId = ApplicationUser.Id.ToString()
        ▼
AppUser          (app_users, domain PK)
```

- Authentication, JWT `sub`, staff API `{id}`, and refresh tokens all use **`ApplicationUser.Id`**.
- Check-in / shift / audit actor lookups use **`AppUser.Id`**, resolved via `AppUser.UserId` + `TenantId`.
- `AdminService.CreateStaffUserAsync` already creates both rows in one flow (Identity first, then `AppUser` mirror). That pattern is preserved.
- There is no `Person`, `Employee`, `Branch`, `JobTitle`, `Department`, `HireDate`, `StaffNumber`, or custom-role table.

`ApplicationUser` has **no EF global tenant query filter**. Every staff read/mutate must be `Id + TenantId`. `FindStaffUserAsync` already does this.

---

## 2. Identity vs AppUser

| | `ApplicationUser` | `AppUser` |
|---|---|---|
| Table | `AspNetUsers` | `app_users` |
| PK | `Id` (`Guid`) | `Id` (`Guid`) |
| Link | — | `UserId` = Identity id as string |
| Auth | Password, roles, refresh tokens, `IsActive` | Domain actor for check-in/shifts/audit |
| Extra | `PermissionsOverride` (ignored), `ProfilePhotoUrl` | `LastLoginAtUtc`, `PhoneNumber`, `TwoFactorEnabled`, `IsDeleted` |

They are **never interchangeable**. LoginResponse.user.id is Identity id. Call-sheet `staffUserId` is `AppUser.Id`. Mixing them is a known historical bug class (see CheckinService tests).

---

## 3. ID ownership rules

| Context | ID |
|---|---|
| JWT `sub` / `NameIdentifier` | `ApplicationUser.Id` |
| `GET/PUT/DELETE /api/admin/staff/{id}` | `ApplicationUser.Id` |
| RefreshToken.UserId | `ApplicationUser.Id` |
| Permission cache key | `(TenantId, ApplicationUser.Id)` |
| `AuditEvent.ActorUserId` | `AppUser.Id` |
| `AuditEvent.EntityId` for staff CRUD | `ApplicationUser.Id` (target Identity user) |

Frontend `staffId` / `s.id` means **Identity user id**. Do not rename it to imply `AppUser.Id`.

`AuditService.ResolveActorUserIdAsync` already implements:

```text
JWT sub → ApplicationUser.Id → AppUser.UserId → AppUser.Id
```

Staff CRUD must call `IAuditService.LogAsync` and let that resolver fill the actor. Do not pass Identity id as actor.

---

## 4. Current role model

Closed Identity role set (PascalCase, seeded):

```text
Owner | Manager | Trainer | Receptionist | Member
```

- Staff list includes **Owner** (service skips only `Member` / empty roles). Controller XML comment and `FRONTEND_API_CONTRACTS.ts` that say “excludes owner” are **wrong**.
- `POST /api/admin/staff` allows only Manager / Trainer / Receptionist. Owner and Member are rejected. Input is case-insensitive; **canonical PascalCase is persisted** via `NormalizeStaffRole`.
- Wire responses already return Identity role names (`roles.FirstOrDefault()`), which are PascalCase. DTO comments and the frontend contract that say “all lowercase” are **wrong**. Frontend already lowercases for display (`normRole`).
- No custom role CRUD. `AppUser.Role` is a display/mirror string, kept in sync on create/update.

---

## 5. Current permission model

Canonical source: `GMS.Core.Constants.Permissions.All` + `DefaultPermissionProvider`.

| Role | Effective permissions |
|---|---|
| Owner | All 22 keys in `Permissions.All` |
| Manager | All except `plans.manage`, `settings.manage` |
| Receptionist | members view/create/edit, checkin.manual, sales.sell, sales.discount.apply, payments.cash.accept, payments.refund.request, shift.open/close, inventory.view, member_orders.view/manage |
| Trainer | `checkin.manual` only |
| Member | none of these `perm` claims |

`ApplicationUser.PermissionsOverride` exists and is **intentionally ignored** (`IPermissionProvider` remarks + `DefaultPermissionProvider`). No per-user permission UI.

Role change already calls `_permissionCacheService.InvalidateAsync(tenantId, user.Id)` (Identity id). Keep that.

---

## 6. Current API contracts

`AdminController` — class `[Authorize(Policy = "OwnerOnly")]`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/staff` | List. `id` = Identity id. Owner **is** included. |
| GET | `/api/admin/staff/{id}` | Detail |
| POST | `/api/admin/staff` | Create. Seat cap **before** Identity insert → `PLAN_LIMIT_EXCEEDED` HTTP 402 |
| PUT | `/api/admin/staff/{id}` | Name, role, `isActive`. No `[RejectImpersonation]` today |
| DELETE | `/api/admin/staff/{id}` | Soft deactivate. `[RejectImpersonation]` |
| POST | `/api/admin/staff/{id}/reset-password` | `{ newPassword }`. `[RejectImpersonation]` |

DTOs today:

```text
StaffListItemDto / StaffDetailDto
  id, fullName, email, role, isActive, lastLoginAt, createdAtUtc
  (+ updatedAtUtc on detail)

CreateStaffRequest   fullName, email, password, role
UpdateStaffRequest   fullName, role, isActive
ResetPasswordRequest newPassword
```

Phone is **not** on staff DTOs. Photo is **not** on staff DTOs (field exists on both user tables). No upload endpoint for staff photos.

---

## 7. Known inconsistencies (verified)

| # | Claim vs repo | Verdict |
|---|---|---|
| 1 | Last Login | **Bug confirmed.** `LastLoginAt = user.UpdatedAtUtc`. `AppUser.LastLoginAtUtc` exists (since InitialCreate) and is **never written**. |
| 2 | Staff CRUD audit | **Confirmed missing.** No `LogAsync` in `AdminService`. |
| 3 | Owner protection | **UI-only.** List disables Owner edit/reset/deact. API `Update`/`Delete` can demote or deactivate Owner. `NormalizeStaffRole` rejects `"Owner"` on update, so sending `role: "Owner"` fails — but `role: "manager"` demotes, and empty role + `isActive: false` deactivates. |
| 4 | GET list “excludes owner” | **Docs wrong.** Owner is listed. |
| 5 | Role casing | API returns PascalCase. Contracts/UI comments say lowercase. Backend already normalizes input. |
| 6 | Password policy | Identity: min 6, digit, lower, upper, **special not required**. Staff UI: 8+ and special required. |
| 7 | Email uniqueness | `RequireUniqueEmail = true` is **global**. Tenant duplicate check message says “for this organization” — misleading. |
| 8 | Fake UI | `staffNumber` (always empty), “Send invite” toast with no API. |
| 9 | `AnyStaff` | Backend: `Owner\|Manager\|Trainer` only (`Program.cs`). Contract + `GfpAuthz` include Receptionist. Quick Actions GET uses explicit four-role list (deliberate; do not expand `AnyStaff`). |
| 10 | Permissions in `FRONTEND_API_CONTRACTS.ts` | Still 17 keys. Backend has 22: + `inventory.view/manage/adjust/purchase/transfer` + `member_orders.view/manage`. `apps/admin` types duplicate `inventory.transfer` and omit member_orders. `nav.selftest.js` ALL_PERMS is already complete. |
| 11 | Reset password | Does **not** revoke refresh tokens. Deactivate does. |
| 12 | PUT impersonation | Role change / deactivate are not `[RejectImpersonation]`; delete and reset are. |
| 13 | Soft delete | DELETE sets `IsActive=false` on both users, revokes refresh, does **not** set `AppUser.IsDeleted`, does **not** remove Identity roles. Matches required lifecycle. User-facing copy still says “deleted”. |
| 14 | Staff 360 | No 360. Edit drawer only. No Access / Activity sections. |
| 15 | Photo / phone | Fields exist; Staff CRUD does not expose them. |

---

## 8. Security risks

1. **Owner demotion/deactivation via API** — highest. UI is not a control.
2. **Last Login lie** — operators cannot tell who never signed in.
3. **Unaudited staff mutations** — create/role/deactivate/reset have no tenant audit row.
4. **Password reset leaves refresh tokens live** — old sessions keep rotating for up to 30 days.
5. **Impersonation can PUT role/status** — platform support token can demote or deactivate staff without the real owner.
6. **Cross-tenant** — already guarded by `Id+TenantId`; `AdminServiceTenantIsolationTests` covers get/update/delete/reset. Keep and expand.

---

## 9. Last Login fix

**Write path (login only):**

On successful `AuthService.LoginAsync` (password valid, tenant match, `IsActive`, not suspended):

```text
ApplicationUser login
  → AppUser where UserId = Identity.Id.ToString() AND TenantId
  → AppUser.LastLoginAtUtc = DateTime.UtcNow
```

Do **not** update `UpdatedAtUtc` on login.

**Not a login:**

- Token refresh (`RefreshTokenAsync`) — session continuation, not a new sign-in.
- Profile / role / activate / deactivate / password reset.

**Read path:**

Map `StaffListItemDto.LastLoginAt` / `StaffDetailDto.LastLoginAt` from `AppUser.LastLoginAtUtc`, never `ApplicationUser.UpdatedAtUtc`. Missing AppUser or null → `null` → UI “Never logged in”.

**Migration:** none. Column already exists (`InitialCreate`).

**Frontend:** never display `updatedAtUtc` as last login.

---

## 10. Audit plan

Reuse `IAuditService` / `audit_events`. Dotted action names to match existing convention (`product.create`, `settings.quick_actions.update`), **not** PascalCase `StaffCreated`.

| Event | Action | EntityType | EntityId | Metadata (no secrets) |
|---|---|---|---|---|
| Create | `staff.create` | `Staff` | Identity id | email, role |
| Update (name/status) | `staff.update` | `Staff` | Identity id | before/after name, role, isActive |
| Role change | `staff.role_change` | `Staff` | Identity id | oldRole, newRole |
| Deactivate (PUT or DELETE) | `staff.deactivate` | `Staff` | Identity id | previousStatus, newStatus |
| Reactivate | `staff.reactivate` | `Staff` | Identity id | previousStatus, newStatus |
| Password reset | `staff.password_reset` | `Staff` | Identity id | identityUserId only |

Actor = `AppUser.Id` via existing resolver. Tenant from `ITenantContext`. Never log password, reset token, or `PermissionsOverride` JSON.

DELETE is audited as `staff.deactivate`, not a destructive delete.

---

## 11. Owner protection plan

API must reject (HTTP 403, code `OWNER_PROTECTED`) when the target’s Identity roles include `Owner` and the operation would:

- change role away from Owner
- set `isActive = false`
- DELETE (soft deactivate)

Name-only update of an Owner (same role, still active) is allowed so a typo can be fixed; the UI remains View-first and does not offer Edit/Reset/Deactivate.

Do not silently no-op. Do not remove the Owner role. Do not rely on the frontend.

---

## 12. Frontend redesign

Live desk: `apps/web/src/app/(dashboard)/staff/` (OwnerOnly). `apps/admin` has no Staff pages — login/nav only.

**Screen 1 — List:** search, role filter, status filter, table (Employee, Role, Email, Status, Last Login, Created, Actions). Owner: View only. No staff number / department / branch / job title. No Send Invite.

**Screen 2 — Create:** Full Name, Email, Password, Role (Manager / Trainer / Receptionist). Email hint: unique across HyMotion (Identity global unique). Password = backend policy.

**Screen 3 — Staff 360:** Profile (name, email, avatar fallback; photo if `profilePhotoUrl` present), Account (created, last login, Active/Inactive), Access (role + effective permissions from canonical map), Activity (`GET /api/audit?entityType=Staff&entityId=`). No National ID / job title / department / hire date / staff number / branch.

**Screen 4 — Edit:** Full Name, Role, Active/Inactive. Owner is read-only.

**Screen 5 — Reset password:** backend policy (6+, upper, lower, digit; special optional).

**Screen 6 — Deactivate / Reactivate:** confirm. Inactive copy: cannot log in or refresh; existing access tokens may remain valid until expiry (~15 min). Do not say “Deleted”.

Preview: `previews/staff-management-alignment.html`.

**Phone:** `AppUser.PhoneNumber` exists but is not on staff DTOs. **Out of this pass** (would be an explicit contract extension).

**Photo:** add optional **read-only** `profilePhotoUrl` on list/detail DTOs from `ApplicationUser.ProfilePhotoUrl`. No upload API.

**Branch:** none. Future extension point only.

---

## 13. Test plan

| Area | Test |
|---|---|
| Tenant isolation | Keep `AdminServiceTenantIsolationTests` get/update/delete/reset |
| Owner protection | Cannot demote / deactivate / delete Owner |
| Role validation | Allow Manager, Trainer, Receptionist (any case → PascalCase). Reject Owner, Member, unknown |
| Seat cap | Keep `Cp4UsageEnforcementTests.StaffSeats_HardBlock_ReturnsPlanLimitExceeded_BeforeIdentityWrite`. Owner counts as a seat (`AspNetUsers` active + role ≠ Member) |
| Last Login | Login writes `AppUser.LastLoginAtUtc`. Refresh does not. Profile/role/deactivate do not. List DTO does not use `UpdatedAtUtc` |
| Soft deactivation | Both `IsActive=false`, rows retained, roles retained, `IsDeleted` stays false, refresh revoked |
| Password reset | Refresh tokens revoked after reset |
| Permission cache | Role change still invalidates cache (existing path) |
| Audit | create / update / role_change / deactivate / reactivate / password_reset |
| Audit actor | `ActorUserId` is `AppUser.Id`, not Identity id |
| AnyStaff | Receptionist does **not** satisfy backend `AnyStaff`; Owner/Manager/Trainer do. Policy **unchanged** |

---

## 14. Explicit out of scope

Person, Employee, HR, Branch module/selector, custom roles, permission CRUD, per-user overrides UI, National ID, job title, department, hire date, staff number, payroll, leave, attendance-as-HR, performance, staff photo upload, staff phone on API, expanding `AnyStaff` to Receptionist, new staff tables, Identity architecture redesign.

---

## 15. Migration requirements

**None.** `app_users.LastLoginAtUtc` already exists. No new tables. No schema change for audit (existing `audit_events`).

---

## Decisions (this pass)

1. **Last login ≠ refresh.** Documented product rule: only password login updates `LastLoginAtUtc`.
2. **AnyStaff stays Owner\|Manager\|Trainer.** Correct the API contract comment. Frontend `GfpAuthz.AnyStaff` including Receptionist is a **nav/shell helper**, not the ASP.NET policy — do not change it here (Receptionist would lose Dashboard `kind: 'any'`). Quick Actions already uses an explicit four-role authorize list.
3. **Audit names are dotted** (`staff.create`), matching `IAuditService` convention, not the prompt’s PascalCase labels.
4. **Password reset will revoke refresh tokens** (same as deactivate). Access tokens still die at ~15 min expiry. Chosen because leaving a 30-day refresh after an admin reset is an avoidable session-hijack window; it is not a broader auth redesign.
5. **PUT staff gets `[RejectImpersonation]`** — role and activation are identity-critical, same class as delete/reset.
6. **Read-only `profilePhotoUrl`** on staff DTOs. No upload.
7. **Canonical roles on the wire are PascalCase.** Frontend display mapping stays lowercase internally.

## Permission reconciliation (smallest safe correction)

Backend `Permissions.All` (22):

```text
members.view, members.create, members.edit
checkin.manual
sales.sell, sales.discount.apply, sales.discount.override
payments.cash.accept, payments.refund.request, payments.refund.approve
shift.open, shift.close, shift.reconcile.approve
memberships.freeze, plans.manage
reports.financial.view, settings.manage
inventory.view, inventory.manage, inventory.adjust, inventory.purchase, inventory.transfer
member_orders.view, member_orders.manage
```

`inventory.transfer` appears once in backend. Frontend admin `types.ts` duplicated it — remove the duplicate. Add missing inventory + member_orders keys to `FRONTEND_API_CONTRACTS.ts` `PermissionKey`. Do not add or remove backend permissions.

Staff 360 Access list is a **display copy** of `DefaultPermissionProvider`, documented in `staff-rules.js`. JWT `perm` remains the runtime gate.

## Impersonation recommendation (applied)

Protect PUT (role/status) with `[RejectImpersonation]`. Create stays allowed under impersonation so support can help an owner add staff without handing over the password. Documented here before the code change.
