# Members — Backend Authorized Execution Prompt

**Audience:** Backend developer  
**Allowed task IDs only:** `BE-T1` · `BE-T2` · `BE-T3` · `BE-T4` · `BE-T5`  
**Binding classes:** Execution Boundary `E-A1` · `E-A2` · `E-A3` (+ Legacy non-enrichment for BE-T5)  
**Date:** 2026-08-08  

**Policy SoT:** Decision Log P1–P12 · Acceptance Rules AR-01–AR-13 · Step 15 Execution Boundary · Step 16 Authorized Execution Breakdown  

---

## Agent preamble (paste at start of every BE session)

You are executing **Members Backend authorized work only** (`BE-T1`–`BE-T5`).

- You may only preserve people-book Own invariants, repair Critical/High Own defects, remediate security/tenant/authz integrity on Own operations, or **hold** Frozen Legacy façades **without enrichment**.
- You must **not** implement Target State, create new APIs for Target delivery, slim/relocate façades, enrich freeze/unfreeze, or expand commercial Members surface.
- Before any change: map the work to **exactly one** allowed ID (`BE-T1`…`BE-T5`) and its `E-A*` class. If it does not map, **stop**.
- All gates **G1–G10** must Pass. One Fail = do not ship.
- Evidence is required before completion (see Evidence section).

---

## Forbidden scope (hard stop)

Do **not** do any of the following:

| ID | Forbidden |
|----|-----------|
| E-F1 | Treat Target State as build authorization |
| E-F2 | Enrich Assign / Renew / Freeze (including Members freeze/unfreeze façades) |
| E-F3 | Expand Expired / Frozen as person-primary semantics in Own person APIs |
| E-F4 | New commercial columns, Members-hosted commercial workflows, or Members-owned foreign endpoints |
| E-F5 | Hard-remove Frozen Legacy |
| E-F6 | Relocate foreign surfaces/data without formal P12 Log revision |
| E-F7 | Claim Members Own of membership / attendance / payments / POS / CRM / scheduling / inventory / loyalty |
| E-F8 | Build P9 gaps (merge, people-only import, prefs/WhatsApp, elected extensions) as new APIs |
| E-F9 | Claim mission Pass |
| E-F10 | Scale Members as commercial console |
| E-F11 | Conflict with P1–P11 / AR-01–AR-11 without cited P12 revision |
| E-F12 | Use Impact Assessment as a backlog |

**Also forbidden for BE specifically:**

- New public API contracts for Target delivery  
- DTO redesign to slim membership/attendance/credits projections “toward Target”  
- Relocating referral/invitation/trial columns off GymMember without P12  
- Alternate Members commercial write paths  
- “Fixes” that add freeze/renew/assign capability  

---

## Allowed tasks

### BE-T1 — Preserve person CRUD / search / phone-uniqueness invariants  
- **E-A:** E-A1  
- **Trace:** P2, AR-02  
- **In:** Maintain existing people-book create/read/update/search and tenant phone uniqueness — **preservation only**  
- **Not included:** Commercial DTO projection redesign; façade slim/relocate; freeze/unfreeze changes; new foreign endpoints on Members  

### BE-T2 — Preserve IsActive deactivate / reactivate as person status  
- **E-A:** E-A1  
- **Trace:** P2, P6, AR-02, AR-06  
- **In:** Keep person Active/Archived (Inactive) semantics distinct from membership lifecycle — **preservation only**  
- **Not included:** Coupling account status to expiry/freeze; membership mutation via person status  

### BE-T3 — Critical/High defect repair on Members Own person APIs only  
- **E-A:** E-A2  
- **Trace:** E-A2, P2, AR-02  
- **In:** Defects that corrupt person record truth, uniqueness, or Own authz  
- **Prerequisite:** Severity Critical or High; defect ID recorded  
- **Not included:** Freeze/unfreeze enrichment; membership/attendance/credits façade enrichment; referral/invitation process expansion  

### BE-T4 — Security / tenant-isolation / authz integrity on Own people-book operations  
- **E-A:** E-A3  
- **Trace:** E-A3, P2, AR-02  
- **In:** Security vulnerabilities or tenant/authz integrity on Own people-book operations only  
- **Not included:** P9 APIs; relocating process columns; new Members-owned foreign writes  

### BE-T5 — Hold Frozen Legacy write façades without enrichment  
- **E-A:** E-A1 + Legacy L2/L3  
- **Trace:** P5, P7, P8, AR-05, AR-07, AR-08  
- **In:** Non-enrichment posture for `freeze` / `unfreeze` (and non-expansion of foreign read façades) — constraint preservation only  
- **Not included:** Hard removal; relocation; alternate commercial write paths; capability-adding “fixes”  

---

## Validation gates (must Pass before completion)

| Gate | Test |
|------|------|
| G1 | Change cites task ID + policy/AR IDs |
| G2 | Creep test: person vs process — no new process Own |
| G3 | Fits mapped E-A class; not E-F* |
| G4 | No Frozen Legacy enrichment |
| G5 | No commercial surface / foreign-responsibility expansion on Members |
| G6 | Person status remains Active/Archived — not Expired/Frozen as person-primary |
| G7 | P9 not used as authorization |
| G8 | Conflicts → stop for P12 revision |
| G9 | Do not claim mission Pass |
| G10 | Deliverable is preservation or Own critical/security fix — not Target delivery |

---

## Evidence required before completion

1. **Task ID** (`BE-Tn`) and **E-A** class  
2. **Invariant statement:** what Own people-book behavior was preserved or which Critical/High/security issue was resolved  
3. **Gate checklist** G1–G10 Pass/Fail  
4. **Forbidden scan:** E-F2, E-F4, E-F5, E-F6, E-F8, and Target API work were not performed  
5. For BE-T3/T4: defect/security ID + severity + confirmation scope was Own person APIs only  
6. For BE-T5: statement that no capability was added to Legacy façades  
7. Projects/files touched  

**Incomplete without evidence.** Do not mark done on code alone.

---

## Progress

| ID | Status | Date | Evidence link / note |
|----|--------|------|----------------------|
| BE-T1 | DONE — verified | 2026-08-08 | Evidence audit Pass — canvases/members-be-t-evidence-audit.canvas.tsx · no code change |
| BE-T2 | DONE — verified | 2026-08-08 | IsActive deactivate/reactivate distinct from membership — Pass · no code change |
| BE-T3 | N/A | 2026-08-08 | No logged Critical/High Own person-API defect — no repair |
| BE-T4 | N/A | 2026-08-08 | No logged Own security/tenant defect — no repair |
| BE-T5 | DONE — held | 2026-08-08 | Freeze/unfreeze façades held without enrichment · no code change |
