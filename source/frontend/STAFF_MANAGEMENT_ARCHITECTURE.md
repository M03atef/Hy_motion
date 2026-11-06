# Staff Management / Staff 360 — Architecture

**Status:** IMPLEMENTED 2026-08-16  
**Desk:** `/dashboard/staff/` (Owner-only)  
**Preview (layout):** `previews/staff-management-alignment.html` (stacked 360 drawer). `previews/staff-employee-360.html` is historical HR and was **not** implemented.

Staff 360 answers four desk questions without becoming an HR system:

| Question | Where |
|---|---|
| Who is this person? | Name, photo, phone, staff number, notes |
| What is their job? | Job title + department + hire date (ops copy). Identity **role** stays separate |
| What can they access? | Read-only “This job can” from `GET /api/admin/roles`. Edits stay on `/dashboard/roles/` (Option B) |
| What have they been doing? | `GET /api/admin/staff/{id}/activity` = actor events ∪ staff-entity events |

---

## ID map (do not collapse)

```text
Tenant
  └── ApplicationUser     AspNetUsers     PK = JWT sub = staff API {id}
        email, password, IsActive, FirstName, LastName, ProfilePhotoUrl
        TenantId (no EF global tenant filter — every query uses Id AND TenantId)
        │
        └── AppUser           app_users     PK = domain actor id
              UserId = ApplicationUser.Id.ToString()
              Role, IsActive, LastLoginAtUtc, PhoneNumber, ProfilePhotoUrl
              StaffNumber, JobTitle, Department, HireDate, Notes
```

| ID | Meaning |
|---|---|
| `ApplicationUser.Id` | JWT `sub`. Staff API `{id}`. Refresh token user. Permission cache key. Audit `EntityId` for `staff.*` |
| `AppUser.Id` | `AuditEvent.ActorUserId`. Check-in / shift actor |
| `AppUser.UserId` | String of Identity id. Not interchangeable with `AppUser.Id` |
| `StaffNumber` | Display `ST-0001`. Tenant-scoped. Server-generated. Never either GUID |

Members use the same pair with `Role = Member`. Do not add `Employee`, `Person`, `StaffProfile`, or `Branch`.

---

## Operational fields on AppUser (not HR)

| Column | Rules |
|---|---|
| `StaffNumber` | `ST-0001`… Unique per tenant (filtered unique index). Allocated on create; backfilled for existing rows; never reused (max+1 including soft-deleted via `IgnoreQueryFilters`). Client cannot set it |
| `JobTitle` | Free text, max 80. Does not replace Identity role |
| `Department` | Controlled: Front Desk, Sales, Training, Management, Operations, Other (`StaffDepartments`). Unknown → 400 |
| `HireDate` | Optional `DATE`. Year &lt; 1970 or after tomorrow → 400. v1 PUT cannot clear a set date (`null` = leave unchanged) |
| `Notes` | Optional, max 2000. Ops notes, not HR docs |
| `PhoneNumber` | Canonical staff phone. Identity phone is unused |

Photo: reuse `IFileStorageService`, folder `staff-photos-{tenant:N}`, dual-write `ApplicationUser.ProfilePhotoUrl` + `AppUser.ProfilePhotoUrl`. JPEG/PNG/WebP/GIF, ≤ 2MB.

**Update semantics:** omitted nullable profile fields (`null`) leave existing values. Empty string can clear title/department/notes/phone. Deactivate still sends only `fullName` / `role` / `isActive`.

---

## APIs (`AdminController`, `OwnerOnly`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/staff` | Includes Owner. Excludes Member. `{id}` = Identity id |
| GET | `/api/admin/staff/{id}` | Detail includes `notes` |
| POST | `/api/admin/staff` | Manager / Trainer / Receptionist only. Allocates `StaffNumber`. `staff_seats` → 402 |
| PUT | `/api/admin/staff/{id}` | `[RejectImpersonation]`. Owner cannot be demoted/deactivated |
| DELETE | `/api/admin/staff/{id}` | Soft deactivate. `[RejectImpersonation]` |
| POST | `/api/admin/staff/{id}/reset-password` | Revokes refresh. `[RejectImpersonation]` |
| GET | `/api/admin/staff/{id}/activity` | Actor ∪ `EntityType=Staff` + `EntityId={Identity id}` |
| POST | `/api/admin/staff/{id}/photo` | Multipart. `[RejectImpersonation]` |

Last login remains `AppUser.LastLoginAtUtc` on **password login only**. Refresh does not write it. Login is not an audit action — do not fabricate login rows.

Roles: `GET/PUT /api/admin/roles`, overlay `Tenant.Settings.role_permissions`. Staff 360 Access is read-only.

`AnyStaff` remains Owner\|Manager\|Trainer (Receptionist excluded). Unchanged.

---

## Activity

Existing `audit_events` only. No second store.

```text
(EntityType == Staff AND EntityId == ApplicationUser.Id)
OR (ActorUserId == AppUser.Id)
```

Friendly `label` for known actions; unknown actions pass through as `action`. `aboutThisStaff` is true for lifecycle rows about this Identity id.

---

## Out of scope (still)

Employee / Person / Branch tables. Payroll, salary, leave, contracts, benefits, HR documents. National ID, date of birth, address (member identity — do not copy). 2FA UI (`TwoFactorEnabled` is a schema placeholder). Custom roles, `PermissionsOverride`, `RolePermissions` table, per-person ticks. Staff clock-in/out.

---

## Tests / migration

- `GMS.Tests/AdminServiceStaffManagementTests.cs` — number, profile, activity, photo, Owner protection
- `GMS.Tests/AdminServiceTenantIsolationTests.cs` — foreign staff 404 on get/update/activity/photo
- `GMS.Tests/AuthStaffLastLoginTests.cs` — login vs refresh
- `GMS.Tests/StaffRolePolicyTests.cs` — AnyStaff unchanged
- `npm run test:staff` — departments, activity URL, staff number, photo
- Migration `AddAppUserStaffOpsFields` backfills `StaffNumber` then adds filtered unique index + actor index
