# Staff 360 Implementation Report

**Date:** 2026-08-16  
**Desk:** `/dashboard/staff/`  
**Architecture:** `STAFF_MANAGEMENT_ARCHITECTURE.md`  
**Gap analysis:** `STAFF_360_GAP_ANALYSIS.md`

## 14. Final verdict

```text
STAFF 360 — COMPLETE
```

Existing Staff Management was extended, not rebuilt. Identity + AppUser stay. Roles Option B stays on `/dashboard/roles/`. `AnyStaff` is still Owner|Manager|Trainer. Owner protection and last-login-on-password-only are unchanged.

The four desk questions are answered: who they are, what their job is, what the job can access, and what they have been doing (real audit rows only).

---

## 1. What already existed

- Staff CRUD on `ApplicationUser` + `AppUser` (`OwnerOnly`)
- Closed Identity roles; create Manager / Trainer / Receptionist only
- Owner cannot be demoted, deactivated, or deleted
- Last login = `AppUser.LastLoginAtUtc` on password login; refresh does not write it
- Staff API `{id}` = `ApplicationUser.Id` (JWT `sub`)
- `AuditEvent.ActorUserId` = `AppUser.Id`; staff CRUD `EntityId` = Identity id
- Read-only `profilePhotoUrl`; `AppUser.PhoneNumber` column unused by staff APIs
- 360 stacked drawer: Profile / Account / Access / Activity
- Access “This job can” from `GET /api/admin/roles` (Option B overlay)
- Activity was only `GET /api/audit?entityType=Staff&entityId={IdentityId}` (lifecycle about them)

## 2. What was missing (implemented)

Classified **MISSING — SHOULD ADD** in the gap analysis:

- Staff number (`ST-0001`)
- Job title, department, hire date, notes
- Phone on DTOs (canonical `AppUser.PhoneNumber`)
- Photo **upload**
- List columns / search / department filter
- Activity = actor events ∪ staff-entity events, with friendly labels

## 3. What was implemented

**Backend:** columns on `AppUser`; `StaffDepartments`; allocate `ST-0001` (max existing + 1, including soft-deleted); create/update/list/detail mapping; `GET /api/admin/staff/{id}/activity`; `POST /api/admin/staff/{id}/photo` via `IFileStorageService`; unknown department / hire-date range → 400.

**Frontend:** work fields on add/edit; 360 Profile shows number/title/dept/hire/phone/notes; photo on edit; activity from the new API; list Staff / Number / Job title / Role / Department / Status / Last login; search includes number + phone.

**Migration:** `20260816144224_AddAppUserStaffOpsFields` applied to `GymFlowProDb` (localdb). Existing `app_users` rows backfilled with unique `ST-####`.

## 4. What was intentionally NOT implemented

- `Employee` / `Person` / `StaffProfile` / `Branch` tables
- Payroll, salary, commission, leave, contracts, benefits, HR documents, staff clock-in
- National ID, date of birth, address (member identity — not copied)
- 2FA UI (`TwoFactorEnabled` remains unused)
- Custom roles, `PermissionsOverride`, `RolePermissions` table, per-person ticks
- Fabricated login audit rows (login is not audited today)
- Expanding `AnyStaff` to Receptionist

## 5. Architecture changes

None to the Identity pair. Ops fields live on `AppUser`. Phone is one column. Photo URLs dual-write Identity + AppUser. Activity reuses `audit_events` (new actor index only). Roles remain Option B; Staff 360 Access is read-only and links to Roles.

`AdminService` now takes `IFileStorageService` (already registered).

## 6. Database changes

On `app_users`:

| Column | Type |
|---|---|
| `StaffNumber` | `VARCHAR(12)` nullable; unique `(TenantId, StaffNumber)` where not null |
| `JobTitle` | `nvarchar(80)` |
| `Department` | `nvarchar(40)` + `(TenantId, Department)` index |
| `HireDate` | `DATE` |
| `Notes` | `nvarchar(2000)` |

On `audit_events`: index `(TenantId, ActorUserId, CreatedAtUtc)`.

Backfill SQL assigns `ST-0001`… per tenant by `CreatedAtUtc, Id` before the unique index.

## 7. API changes

| Method | Path |
|---|---|
| GET | `/api/admin/staff/{id}/activity` → `StaffActivityItemDto[]` |
| POST | `/api/admin/staff/{id}/photo` multipart, ≤2MB, jpeg/png/webp/gif, `[RejectImpersonation]` |

Create/update/list/detail gained `phoneNumber`, `staffNumber`, `jobTitle`, `department`, `hireDate`; detail also `notes`.

PUT: `null` profile fields leave existing values (deactivate payload still safe). Empty string can clear title/department/notes/phone.

## 8. Frontend changes

`/dashboard/staff/` cache: `staff.css?v=5`, `staff-rules.js?v=6`, `staff-app.js?v=7`.

360 drawer unchanged in shape (not the historical HR tabs preview). Access still points at Roles for task edits.

## 9. Security verification

| Check | Result |
|---|---|
| Staff APIs `OwnerOnly` | Unchanged (class-level) |
| Owner protect | Unit tests still pass |
| Impersonation | PUT / DELETE / reset / **photo** have `[RejectImpersonation]` |
| Photo types/size | 2MB + allow-list; random stored name |
| Last login | `AuthStaffLastLoginTests` pass; refresh still does not write |
| `AnyStaff` | Still Owner\|Manager\|Trainer (`StaffRolePolicyTests`) |
| `PermissionsOverride` | Still unused |

## 10. Tenant isolation verification

`FindStaffUserAsync` remains Identity id **and** `TenantId`. Foreign staff get/update/delete/reset/**activity**/**photo** fail (`AdminServiceTenantIsolationTests`). Identity users have no global tenant filter; this AND remains required.

## 11. Audit verification

- Create/update/role_change/deactivate/reactivate/password_reset unchanged
- Photo writes `staff.update` `{ profilePhoto: true }`
- Activity query: `(EntityType==Staff && EntityId==IdentityId) OR (ActorUserId==AppUser.Id)`
- Actor is still `AppUser.Id`, not Identity id
- No `auth.login` rows invented

## 12. Test results

| Suite | Result |
|---|---|
| `AdminServiceStaffManagementTests` + `AdminServiceTenantIsolationTests` + `AuthStaffLastLoginTests` + `StaffRolePolicyTests` | **32 passed** |
| `npm run test:staff` | **All passed** (including 72 prevent-task cases + new 360 asserts) |
| EF `database update` `AddAppUserStaffOpsFields` | **Done** on `GymFlowProDb` |

## 13. Remaining gaps (accepted)

- PUT cannot clear `HireDate` (`null` = leave unchanged)
- Activity has no login rows until login is actually audited
- Unknown audit actions show the raw `action` string
- No photo delete endpoint
- National ID / DOB / 2FA / Branch still out of product
