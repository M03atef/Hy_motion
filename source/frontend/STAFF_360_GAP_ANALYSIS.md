# Staff 360 Gap Analysis

Inspected against the live repository on 2026-08-16. Source of truth is code, not the historical Employee-360 preview.

**Status:** Implemented 2026-08-16. Report: `STAFF_360_IMPLEMENTATION_REPORT.md`. Architecture: `STAFF_MANAGEMENT_ARCHITECTURE.md`.

**Architecture kept:** `ApplicationUser` (Identity) → `AppUser` (domain mirror) → Identity role → `DefaultPermissionProvider` (+ tenant `role_permissions` overlay) → JWT `perm` claims → Audit.

**Do not revert:** Roles Option B (checkboxes per job on `/dashboard/roles/`) is already accepted. Staff 360 Access stays **read-only** and links to Roles.

---

## ID map

| ID | Meaning |
|---|---|
| `ApplicationUser.Id` | JWT `sub`. Staff API `{id}`. Audit `EntityId` for staff CRUD. |
| `AppUser.Id` | Domain PK. `AuditEvent.ActorUserId`. Check-in / shift actor. |
| `AppUser.UserId` | String of Identity id. Not interchangeable with `AppUser.Id`. |
| `StaffNumber` | **Missing today.** Display number (`ST-0001`). Never either GUID. |

---

## Classification table

| Capability | Current State | Gap | Recommendation | Implementation |
|---|---|---|---|---|
| Full Name | EXISTS on Identity + AppUser; create/update/list/360 | — | Keep | Existing |
| Email | EXISTS; unique globally; not editable after create | — | Keep | Existing |
| Profile Photo | PARTIALLY EXISTS. `ProfilePhotoUrl` on both users; list/360 display; **no upload** | Write path + storage folder | Reuse `IFileStorageService` (same as product photos). Dual-write both URL columns. | **Yes** |
| Phone | PARTIALLY EXISTS. `AppUser.PhoneNumber` column; never in staff DTOs; create leaves `""` | Expose + persist one canonical source | Canonical = `AppUser.PhoneNumber`. Do not add a second phone column. | **Yes** |
| National ID | MISSING. Only `GymMember.NationalIdEncrypted` | Member identity, not desk ops | Do not copy Member NID onto staff | **No** |
| Date of Birth | MISSING. Only `GymMember.DateOfBirth` | Same | Do not copy | **No** |
| Address | MISSING | Low desk value | Skip | **No** |
| Notes | MISSING on staff (members have `Notes`) | Owner needs a place for “works evenings / has gym keys” | Short operational notes on `AppUser` | **Yes** |
| Staff Number | MISSING | Owners identify people as ST-0001, not GUIDs | Tenant-scoped `ST-0001`, server-generated, unique, never reused, never from the client | **Yes** |
| Job Title | MISSING | Role ≠ job (“Front Desk Supervisor” vs Receptionist) | Free-text on `AppUser`. Does not replace Identity role | **Yes** |
| Department | MISSING | Filter the list (Front Desk / Training / …) | Controlled strings on `AppUser`. No Department entity | **Yes** |
| Hire Date | MISSING | “When did they start” | Optional `DateOnly` on `AppUser` | **Yes** |
| Employment Status | EXISTS as `IsActive` (account) | Not HR employment status | Keep account Active/Inactive. Do not add Employed/Terminated | Existing |
| System Role | EXISTS. Closed set. Create Manager/Trainer/Receptionist only | — | Keep. Owner protected | Existing |
| Permission summary | EXISTS. Staff 360 “This job can” from `GET /admin/roles` | — | Read-only. Edits stay on Roles (Option B) | Existing |
| Account status | EXISTS `IsActive` + deactivate/reactivate | — | Keep | Existing |
| Last Login | EXISTS `AppUser.LastLoginAtUtc` on password login only; refresh does not write | — | Do not regress | Existing |
| Password reset | EXISTS. Revokes refresh. Owner blocked | — | Keep | Existing |
| 2FA status | PARTIALLY EXISTS. Columns default false; no tenant MFA writers/UX | Would be a fake “Off” forever | Do not show until MFA exists | **No** |
| Activity | PARTIALLY EXISTS. 360 loads `GET /audit?entityType=Staff&entityId={IdentityId}` (lifecycle **about** them). Desk work (check-in, sale, refund) is stored as **actor** = `AppUser.Id`. Login is **not** an audit action | Timeline misses “what they did” | `GET /api/admin/staff/{id}/activity` = actor events ∪ staff-entity events. Friendly labels. No second store. Do not fabricate login rows | **Yes** |
| Lifecycle | EXISTS in audit: `staff.create` / `update` / `role_change` / `deactivate` / `reactivate` / `password_reset` | Shown only as raw action strings | Same activity feed, human labels | **Yes** (labels) |
| List search | PARTIALLY. Name + email, client-side | Number + phone once persisted | Extend client filter | **Yes** |
| List filters | PARTIALLY. Role + status | Department once persisted | Add department select | **Yes** |
| List columns | Employee, Role, Email, Status, Last login, Created | Number / title / dept more useful than email+created on the grid | Staff, Number, Title, Role, Dept, Status, Last login | **Yes** |
| Branch | OUT OF SCOPE | — | Still deferred | **No** |
| Employee / Person table | Must not exist | — | Extend `AppUser` only | **No** |
| Payroll / leave / contracts | Must not exist | — | — | **No** |
| Custom roles / PermissionOverride / RolePermissions table | Must not exist | Option B overlay already covers gym-level job tasks | Do not add per-person ticks | **No** |
| AnyStaff / OwnerOnly | EXISTS | — | Unchanged | Existing |

---

## Field-level notes (A–F)

### A. Person / Profile

| Field | Exists? | Where? | Exposed? | Editable? | Persisted? | Safe? | Value |
|---|---|---|---|---|---|---|---|
| Full Name | Y | Identity + AppUser | Y | Y | Y | — | High |
| Photo URL | Y | Both | Read | N | Column empty | Y — reuse file storage | High |
| Phone | Y | AppUser (+ unused Identity phone) | N | N | Default `""` | Y — expose AppUser | High |
| Email | Y | Both | Y | Create only | Y | — | High |
| National ID | N | Member only | — | — | — | Unsafe copy | None for desk |
| DOB | N | Member only | — | — | — | Same | None for desk |
| Address | N | — | — | — | — | Skip | Low |
| Notes | N | — | — | — | — | Y on AppUser | Medium |

### B. Employment (ops, not HR)

No columns today. Smallest fit: **columns on `AppUser`**, as already sketched in `STAFF_MANAGEMENT_ARCHITECTURE.md` §3. No `Employee` / `Person` / `StaffProfile` table.

### C. System access

Live and approved. Staff 360 must not grow permission checkboxes. Roles page is Option B (editable jobs), not the stale “read-only Roles” line in the 360 prompt.

### D. Account / security

Last login is correct (`AuthStaffLastLoginTests`). 2FA is a schema placeholder — do not paint it.

### E. Activity

`AuditEvent` already has everything needed. Missing piece is **query by actor**. General `GET /api/audit` has no `actorUserId` filter (and is `settings.manage`). Prefer a **Staff-scoped** OwnerOnly endpoint so tenant isolation stays on `FindStaffUserAsync`.

Login is not audited today. Account already shows Last login. Do **not** invent login rows.

### F. Lifecycle

All six target events already exist as audit actions. Expose them in the same activity feed.

---

## Architecture choice (Rules 1–3)

| Option | Verdict |
|---|---|
| Put job/dept/hire/number/notes on **Identity** | No — not auth fields |
| New **Employee / Person / StaffProfile** table | No — one gym staff row already is AppUser |
| Columns on **AppUser** | **Yes** — smallest model that fits |

Phone stays on `AppUser.PhoneNumber` (already there). Photo URLs stay on both users (Identity is what the DTO already reads); upload writes both.

---

## Implement now (MISSING — SHOULD ADD / PARTIAL)

1. Staff Number (`ST-####`, tenant unique, server-side)
2. Job Title (string)
3. Department (controlled list)
4. Hire Date (`DateOnly?`)
5. Phone (expose existing column)
6. Profile photo upload (existing `IFileStorageService`)
7. Notes
8. Staff 360 + list/search/filter presentation
9. Activity timeline from existing `AuditEvent` (actor ∪ staff entity)

## Explicitly not now

National ID, DOB, address, 2FA UI, Branch, Employee entity, payroll, custom roles, per-person permission overrides, login-event fabrication, Roles revert.
