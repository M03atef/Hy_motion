# Roles & Permissions — Architecture

**Status:** Option B implemented (per-gym job tasks).  
**Live:** `/dashboard/roles/` (Owner only).  
**Preview:** `previews/roles-permissions-management.html`  
**Date:** 2026-08-16

Staff answers “who works here?”. Roles answers “what can this job do in this gym?”

Identity roles stay closed. Owner and Member stay locked. `PermissionsOverride` stays unused. Overlay is `Tenant.Settings.role_permissions`, not a `RolePermissions` table.

---

## Verdict

**Recommended: Option A — Role Viewer (read-only).**

Do **not** ship configurable role permissions (B) or custom roles (C) in the next pass.

Access is already hardcoded in `DefaultPermissionProvider` and baked into the JWT. The Owner need that exists today is **visibility**: “What can a Receptionist do?” Staff 360 already shows a display copy of that map. A dedicated Owner-only Roles page should show the same truth, grouped by product domain — without writing a second authorization system.

**LIVE.** Option B — Owner ticks tasks for Manager / Receptionist / Trainer in this gym.  
**NOT READY** for custom roles (C) or `PermissionsOverride` (per-person).

---

## 1. Current authorization architecture

Verified from code. There is **no** `RolePermissions` table. There is **no** role CRUD API.

```
ApplicationUser  (Identity, Guid Id, TenantId)
      ↓  UserManager.GetRolesAsync
Identity Roles   (AspNetRoles: Owner | Manager | Trainer | Receptionist | Member)
      ↓
DefaultPermissionProvider.GetPermissions(roles, PermissionsOverride)
      ↓  PermissionsOverride is READ but NOT APPLIED
IReadOnlySet<string>
      ↓
Redis cache  key perm:{tenantId}:{userId}  TTL 30 minutes
      ↓
TokenService  one JWT claim type "perm" per permission string
      ↓  access token ~15 minutes
PermissionAuthorizationHandler  JWT claim match only (no DB per request)
      ↓
[HasPermission("…")]   and/or   [Authorize(Policy = "OwnerOnly"|…)]
```

### Step by step (actual types)

| Step | Where | What happens |
|---|---|---|
| 1 | `ApplicationUser` | Identity user. `TenantId`, `IsActive`, `PermissionsOverride` (JSON string, unused). |
| 2 | `AspNetUserRoles` | One (typical) Identity role name. Staff create/update replace all roles with one of Manager / Trainer / Receptionist. |
| 3 | `DefaultPermissionProvider` | Hardcoded dictionary, case-insensitive role names. Union if multiple roles. Unknown role → empty set. **Member is not in the map → 0 permissions.** |
| 4 | `AuthService.ResolvePermissionsAsync` | Cache get; on miss, provider + cache set. Used on **login, refresh, and impersonation**. |
| 5 | `RedisPermissionCacheService` | `perm:{tenantId}:{userId}`, JSON string array, 30 min TTL. Failures log and fall back to recompute. |
| 6 | `TokenService.GenerateAccessTokenAsync` | Claims: `sub` = Identity id, `tenant_id`, `gym_code`, `email`, names, `ClaimTypes.Role` per role, `perm` per permission. HMAC-SHA256. Default lifetime **15 minutes** (`JwtSettings:AccessTokenExpirationMinutes`). |
| 7 | API | `[HasPermission]` → policy name `Permission:{key}` → handler succeeds if JWT has that `perm` claim. Named policies (`OwnerOnly`, …) use **role claims**, not `perm`. |

Authorization is **hybrid**: permission claims **plus** Identity role policies. Editing a permission map later would **not** automatically change `OwnerOnly` / `AnyStaff` endpoints.

---

## 2. Current role inventory

Identity roles seeded in `DataSeeder` (exact names):

`Owner`, `Manager`, `Trainer`, `Receptionist`, `Member`

`UserRole` enum exists in Core (Owner=1 … Receptionist=5) for documentation/order. Runtime assignment uses **string Identity role names**, not the enum.

| Role | Created | Stored | Assigned | Checked | Permissions | Modify / delete the role itself | Assign via Staff |
|---|---|---|---|---|---|---|---|
| **Owner** | Seed + first gym owner | `AspNetRoles` / `AspNetUserRoles` | Provisioning, not Staff create | `OwnerOnly`; full `perm` set | All 24 in `Permissions.All` | **No** role CRUD. User: cannot demote/deactivate/delete (`OWNER_PROTECTED`) | **No** — Staff create rejects Owner |
| **Manager** | Seed + Staff create | Identity + `AppUser.Role` copy | Staff create/update | `ManagerOrAbove`; 22 perms | All except `plans.manage`, `settings.manage` | Role definition hardcoded | **Yes** |
| **Trainer** | Seed + Staff create | same | Staff | `AnyStaff` (backend includes Trainer); 1 perm | `checkin.manual` only | Hardcoded | **Yes** |
| **Receptionist** | Seed + Staff create | same | Staff | **Not** in backend `AnyStaff`; 13 perms | Front desk set (see §3) | Hardcoded | **Yes** |
| **Member** | Seed + member activation | Identity | Member App / activation | `AuthenticatedMember` | **None from the provider** | Hardcoded | **No** — not a Staff role |

Staff allowed roles (`AdminService.StaffRoles`): **Manager, Trainer, Receptionist** only.

`AppUser.Role` is a **display/copy** field (comment still lists stale values like `admin`). Identity is the source of truth. Staff update writes both.

Roles are **global names** in `AspNetRoles` (shared catalog). Users are **tenant-scoped**. There is no per-tenant role table.

---

## 3. Complete permission inventory

Source: `GMS.Core.Constants.Permissions` + `Permissions.All`. **24 keys.**  
(`TokenService` comment still says “17 today” — stale.)

Frontend `PermissionKey` in `FRONTEND_API_CONTRACTS.ts` matches these 24.  
`staff-rules.js` `PERMISSION_LABELS` matches these 24.

| Permission | Owner | Manager | Receptionist | Trainer | Member | Backend enforcement | Frontend |
|---|---|---|---|---|---|---|---|
| `members.view` | ✓ | ✓ | ✓ | — | — | Members, Attendance occupancy/search, invitations staff, reports (some), analytics | Nav Members / Invitations / Reports (OR) |
| `members.create` | ✓ | ✓ | ✓ | — | — | POST members | Member create UI |
| `members.edit` | ✓ | ✓ | ✓ | — | — | PUT members, some member edit | Edit |
| `checkin.manual` | ✓ | ✓ | ✓ | ✓ | — | Manual check-in actions | Attendance nav (OR members.view) |
| `sales.sell` | ✓ | ✓ | ✓ | — | — | Sales, POS invoice, offers list/get, promo list/get, trials, debtors list/remind, call-sheet, invoice resend/receipt | Sale, Call sheet, Offers (OR plans.manage) |
| `sales.discount.apply` | ✓ | ✓ | ✓ | — | — | Sale create (caller perms hash) | POS discount |
| `sales.discount.override` | ✓ | ✓ | — | — | — | Sale manual discount | POS override |
| `payments.cash.accept` | ✓ | ✓ | ✓ | — | — | **Not checked on `POST /sales` or `POST /sales/{id}/payments`** (open shift + `sales.sell` instead) | Displayed on Staff; weakly enforced |
| `payments.refund.request` | ✓ | ✓ | ✓ | — | — | POST /refunds | Refund CTA |
| `payments.refund.approve` | ✓ | ✓ | — | — | — | Approve/reject/list refunds, void invoice | Refund history |
| `shift.open` | ✓ | ✓ | ✓ | — | — | Open shift, current, movements | Shifts nav (OR close) |
| `shift.close` | ✓ | ✓ | ✓ | — | — | Close shift | Shifts |
| `shift.reconcile.approve` | ✓ | ✓ | — | — | — | Reconcile approve | Shifts manager UI |
| `memberships.freeze` | ✓ | ✓ | — | — | — | Freeze/unfreeze on members | Member freeze |
| `plans.manage` | ✓ | — | — | — | — | Plan CRUD, offer write, some promo write, import plans | Plans nav; Offers write |
| `reports.financial.view` | ✓ | ✓ | — | — | — | Invoices list/get, Z, financial reports, debtors summary, call-sheet renewal rate | Invoices, Z-Report, Reports |
| `settings.manage` | ✓ | — | — | — | — | **Imports + Audit** (`HasPermission`). **Not** gym Settings (those are `OwnerOnly`) | Import, Audit nav |
| `inventory.view` | ✓ | ✓ | ✓ | — | — | Catalog read, stock, reports, purchasing GET | Stock hub (flagged); Receptionist: view only |
| `inventory.manage` | ✓ | ✓ | — | — | — | Product/warehouse writes | Products/Suppliers (OR purchase) |
| `inventory.adjust` | ✓ | ✓ | — | — | — | Adjustments, counts | Fix qty / counts |
| `inventory.purchase` | ✓ | ✓ | — | — | — | Opening, pay supplier, PO approve/receive | Purchases, Buy |
| `inventory.transfer` | ✓ | ✓ | — | — | — | Transfers controller | Stock Move (hub, flagged) |
| `member_orders.view` | ✓ | ✓ | ✓ | — | — | GET member-orders | **Nav mismatch — see §4** |
| `member_orders.manage` | ✓ | ✓ | ✓ | — | — | Accept/reject/ready/complete | **Nav mismatch — see §4** |

Trainer “PT/class access” is **not** a permission. Comment on the provider: Trainer’s extra access is **role policy** (`AnyStaff` includes Trainer). Receptionist is **excluded** from backend `AnyStaff` on purpose (`StaffRolePolicyTests`).

---

## 4. Backend vs frontend reconciliation

| Item | Status |
|---|---|
| 24 `Permissions.All` vs `PermissionKey` | **Match** |
| `staff-rules.js` display map vs provider | **Match** (Owner/Manager/Receptionist/Trainer) |
| `member_orders.view` / `member_orders.manage` | **Live on API** (`MemberOrdersController`). **Nav still lists stale keys:** `orders.view`, `orders.fulfill`, `memberorders.view`, `memberorders.manage` plus `sales.sell`. Receptionist still sees the item because of `sales.sell`. A role with **only** `member_orders.*` would **not** see the nav item. |
| `inventory.transfer` | **Live** on `InventoryTransfersController`. Nav uses Stock Management hub + `inventory.view` (feature flags), not this key. |
| `payments.cash.accept` | In JWT and Staff UI. **Not** the gate on cash sale/collect. |
| `settings.manage` | JWT + Import/Audit. Settings **page** is `OwnerOnly`, not this permission. |
| Frontend `AnyStaff` | Includes **Receptionist**. Backend `AnyStaff` does **not**. Memberships current/history/assign policies follow **backend**. |
| `apps/admin` | Decodes `perm` the same way; not a Roles admin UI. |
| Dead frontend-only keys | `orders.view`, `orders.fulfill`, `memberorders.view`, `memberorders.manage` — **not** in `Permissions.All`. |
| Permissions only in backend | None vs contracts. |
| Case | Permission strings are lowercase dotted. Role names PascalCase on the wire. |

Do **not** treat the nav Member Orders OR-list as the permission catalog.

---

## 5. Permission cache behavior

```
Login / Refresh / Impersonation
  → cache GET perm:{tenantId}:{userId}
       hit → use cached set
       miss → DefaultPermissionProvider → cache SET (30 min)
  → bake into access token
```

```
Staff role change (AdminService)
  → RemoveFromRoles + AddToRole
  → IPermissionCacheService.InvalidateAsync(tenantId, user.Id)
  → AppUser.Role updated
```

**When do changes apply?**

- **Cache:** immediately invalidated for that user. Next login/refresh recomputes.
- **Access token:** still carries the **old** `perm` claims until it expires (~15 minutes) or the user refreshes.
- **There is no role-permission version in the JWT.** Changing the hardcoded map in a deploy does **not** revoke existing tokens. Users keep old claims until refresh/expiry.
- Invalidation is **per user**, not per role. If Option B ever existed, **every user with that role** would need invalidation (not implemented).

Redis down: log + recompute. Keys cannot collide across tenants (`tenantId` in key). Same user id in two tenants would be different keys; Identity users are tenant-scoped anyway.

---

## 6. JWT behavior

| Claim | Content |
|---|---|
| `sub` | `ApplicationUser.Id` (Guid) |
| `tenant_id` | Tenant Guid |
| `gym_code` | Tenant gym code |
| `role` (`ClaimTypes.Role`) | Identity role name(s) |
| `perm` | **One claim per permission string** |
| `jti` | Unique per token |
| Impersonation extras | platform user id + token_use |

Refresh: validates expired access token, loads user, **re-resolves permissions** (cache or provider), issues a new access token. Refresh does **not** write last-login.

**If a role’s permissions changed in code or (future) config: existing access tokens keep the old set until expiry or refresh.** API authorization does not re-read Redis per request.

---

## 7. Authorization policy map

Registered in `Program.cs`:

| Policy | Requirement | Includes Receptionist? | Includes Member? |
|---|---|---|---|
| `OwnerOnly` | Role Owner | No | No |
| `ManagerOrAbove` | Owner, Manager | No | No |
| `AnyStaff` | Owner, Manager, **Trainer** | **No** | No |
| `AuthenticatedMember` | Member | No | Yes |
| `AnyAuthenticated` | Authenticated | Yes if staff token | Yes |
| `Permission:{key}` | JWT `perm` claim | If that perm is in their token | Typically no perms |

**Role-only (examples):** Admin staff CRUD (`OwnerOnly`); gym Settings GET/PUT (`OwnerOnly`); Quick Actions PUT (`ManagerOrAbove`); Memberships current/history (`AnyStaff`); Member App store/occupancy/offers (`AuthenticatedMember`).

**Permission-only (examples):** Sales, members CRUD, inventory, refunds, member-orders, most reports.

**Both on one controller:** common (class `[Authorize]` + action `[HasPermission]`).

**Owner-only without matching permission:** `DELETE` member (deactivate) stays `OwnerOnly` even if the caller has `members.edit`.

Platform-console policies (`PlatformAdminOnly`, …) are a **different auth scheme**. Out of scope for gym Roles UI.

---

## 8. Tenant scoping

| Layer | Scope |
|---|---|
| `AspNetRoles` names | **Global** catalog (same five names for every gym) |
| `ApplicationUser` | **TenantId** required; Staff queries always `Id AND TenantId` |
| Permission map | **Global hardcoded** — every gym’s Manager has the same 22 keys |
| Permission cache | **Per tenant + user** |
| JWT | Contains `tenant_id` |

**If Option B were ever built:** do **not** create per-tenant Identity roles. Store a tenant overlay (JSON on `Tenant.Settings` or `TenantRolePermission` rows). Default remains `DefaultPermissionProvider`. Owner and Member must stay non-editable.

**Product default for Egyptian gyms:** access should stay **the same in every gym** unless a later Accept explicitly asks for per-gym Manager tweaks. Option A matches that.

---

## 9. Owner and Member (special roles)

### Owner

- Granted `Permissions.All` at login.
- Staff API: cannot change role, deactivate, or delete (`OWNER_PROTECTED` 403).
- Settings / Staff nav: `OwnerOnly`.
- Treat as a **system role**. A Roles UI must not offer Edit / Delete / duplicate.

### Member

- Identity role so Member App JWT can satisfy `AuthenticatedMember`.
- **Zero** entries in `DefaultPermissionProvider` — member APIs are role-gated, not `perm`-gated.
- Must **not** appear on a Staff Roles & Permissions desk.
- Must **not** be assignable in Staff Management.

---

## 10. Current limitations

1. Two systems: **role policies** and **permission claims**. They can disagree (Receptionist vs `AnyStaff`).
2. `PermissionsOverride` column exists, is passed into the provider, and is **ignored**.
3. No API returns the role→permission matrix; Staff UI **duplicates** it in `staff-rules.js`.
4. Nav Member Orders uses **wrong permission strings**.
5. `payments.cash.accept` and parts of `settings.manage` do not mean what a gym owner would guess from the label.
6. Permission cache invalidation is per-user only.
7. Access tokens stay valid up to ~15 minutes after a role change.
8. `AppUser.Role` comment / old values are stale vs Identity PascalCase.

---

## 11. Security risks (current + if B/C shipped)

| Risk | Current | If B (editable role perms) | If C (custom roles) |
|---|---|---|---|
| Privilege escalation | Owner cannot grant extra perms; map is code | Owner could grant `payments.refund.approve` / `inventory.adjust` to Receptionist. `settings.manage` would open Import/Audit, **not** Settings (`OwnerOnly`) — confusing and still dangerous | Same + invented “Cashier” with Owner-like perms |
| Self-escalation | Staff PUT is OwnerOnly; Owner cannot demote self via Staff | Must forbid editing Owner; must forbid caller editing own role’s perms if they are not Owner | Custom role rename to Owner |
| Cross-tenant | Staff scoped by TenantId | Overlay must be TenantId-keyed | Custom roles must not leak via AspNetRoles global names |
| JWT stale perms | 15 min after role change | 15 min after save unless refresh is forced | Same |
| Cache | Per tenant+user | Must invalidate **all users of that role** (new API) | Same |
| Owner protection | API-enforced | UI must lock Owner row | Must block delete Owner |
| Member isolation | No Member in Staff roles; 0 perms | Never attach staff perms to Member | Never allow custom role named Member |

Do **not** enable `PermissionsOverride` as a shortcut for B. It is unparsed, unvalidated JSON with no audit UI.

---

## 12. Option A — Role Viewer

**UI:** Owner sees the four staff roles, permission counts, grouped access. Read-only. Link to Staff for “who has this role”.

**Architecture:** unchanged. Read from the same map Staff already copies (`DefaultPermissionProvider` / `staff-rules.js`). Prefer **one** display source after Accept (still not a new backend table).

**Cost:** low. **Risk:** low. **Matches** current engine.

**Does not** let an owner make Receptionist approve refunds. That is a **product** change to the hardcoded map (code + tests), not a Roles editor.

---

## 13. Option B — Configurable role permissions

Owner toggles permissions on Manager / Receptionist / Trainer. Persist overlay. Runtime: overlay ∪/minus hardcoded defaults. Invalidate every user with that role. Refresh tokens pick up changes; access tokens lag ~15 min.

**Requires (not in repo today):**

- Storage (tenant JSON or table)
- Resolve path change in `DefaultPermissionProvider` or a new provider
- Invalidate-by-role
- Audit
- Owner/Member locks
- Honest UX: toggles that **do not** affect `OwnerOnly`/`AnyStaff` endpoints must be labeled or those endpoints migrated to `HasPermission`

**Risk:** high until the hybrid policy split is cleaned up.  
**Need:** unproven. Egyptian gyms have not asked to invent a sixth job; they asked who can sell / refund / open settings.

---

## 14. Option C — Custom roles

Create / rename / duplicate / delete roles, assign arbitrary permission sets, assign to staff.

**Requires:** Identity role lifecycle per tenant (or a parallel AppRole table because `AspNetRoles` is global), Staff create dropdown from DB, nav/feature assumptions, migration of every `RequireRole("Manager")` policy.

**Rejected** as the next step. Flexibility without a product model. Breaks “Receptionist means front desk” for support, training, and Member App isolation.

---

## 15. Recommended option

**A.**

Reasons, against the actual repo:

1. The engine already works. Staff already displays the map.
2. Smallest surface that answers “what can this role do?”
3. Avoids JWT/cache/Identity rewrites.
4. Avoids Owner granting `settings.manage` and thinking they opened Settings (they did not).
5. Tenant isolation stays: same jobs in every gym.
6. Future B is still possible **after** (i) nav keys are fixed, (ii) role policies vs perms are documented or collapsed, (iii) a real gym asks to change Receptionist.

Do **not** recommend C because it is “more complete”.

---

## 16. Migration implications (when implementing A later)

- **No database migration.**
- **No JWT change.**
- **No cache change.**
- Frontend: OwnerOnly page or Settings section; reuse `GfpStaffRules.ROLE_PERMISSIONS` or a single shared module.
- Optional fix (separate, small): nav Member Orders should include `member_orders.view` / `member_orders.manage`. That is a nav bug, not Roles CRUD.
- Do not enable `PermissionsOverride`.
- Do not add Identity roles.

If Product later Accepts **B**: new storage + provider + invalidate-by-role + tests + “takes effect within 15 minutes or on next login” copy. Separate decision.

---

## 17. UX / IA recommendation

Current Administration: Import, Audit, Notifications, **Staff**, **Settings**.

- **Staff** = people (already live, OwnerOnly).
- **Settings** = Gym Identity, QR, tax, occupancy, alerts — not jobs.

**Place Roles next to Staff**, not inside Gym Identity tabs:

```
Administration
  Staff                 who works here
  Roles                 what each job can do   (OwnerOnly, read-only)
  Settings              gym identity
```

Do not put a permission matrix on each employee (Staff 360 already lists the role’s access as display). The Roles page is the **matrix of jobs**.

Copy: **Roles**, **Access**, **This role can**. Not RBAC, ACL, claims, policies.

Member is hidden. Owner is marked **System** and has no Edit.

---

## 18. Open questions (do not block Option A)

1. Should backend `AnyStaff` include Receptionist? (Today: no. Quick Actions already special-cases Receptionist.)
2. Should Settings use `settings.manage` instead of `OwnerOnly`? (Today: no — Owner-only gym identity.)
3. Should `payments.cash.accept` be enforced on POS/collect?
4. After Accept of A, fix Member Orders nav keys in the same pass or separately?
5. Is a GET `/api/admin/roles` needed, or is the frontend display map enough for A?

Suggested for A: **no new API**. Frontend already has the map. Staff list can supply counts per role from `GET /api/admin/staff` (Owner already loads this).

---

## 19. Explicit out of scope

- Enabling or parsing `PermissionsOverride`
- Custom roles / role CRUD
- Per-tenant permission overlays
- Changing JWT lifetime or baking a permission version
- Expanding `AnyStaff`
- Platform-console roles
- Member App permission UI
- Replacing `[Authorize(Policy = "OwnerOnly")]` with permissions
- New Identity roles (Sales, Accountant, Inventory, Cashier)
- Employee / Person / Branch tables

---

## 20. Design preview

`previews/roles-permissions-management.html`

- Screen 1: four staff roles, real permission counts (24 / 22 / 13 / 1)
- Screen 2–3: grouped access, **read-only** (Option A — no Save)
- Owner = System
- Member omitted
- Quiet Staff/Invoices visual language

---

## Implementation (Option B)

Shipped as a **tenant overlay** on `DefaultPermissionProvider`.

| Piece | Choice |
|---|---|
| Defaults | Unchanged `DefaultPermissionProvider` |
| Overlay | `Tenant.Settings.role_permissions` JSON `{ Manager: [...], Receptionist: [...], Trainer: [...] }` |
| APIs | `GET /api/admin/roles`, `PUT /api/admin/roles/{role}`, `POST /api/admin/roles/{role}/reset` (OwnerOnly, PUT/reset `[RejectImpersonation]`) |
| Resolve | `RolePermissionResolver` at login/refresh/impersonation |
| Cache | Invalidate every `AppUser` with that role in the tenant |
| Owner / Member | Locked |
| `PermissionsOverride` | Still ignored |
| `AnyStaff` / `OwnerOnly` | Unchanged. UI notes that ticks do not open those role-gated screens |
| Effect | Next login, or ~15 minutes if the person stays signed in (refresh) |

---
