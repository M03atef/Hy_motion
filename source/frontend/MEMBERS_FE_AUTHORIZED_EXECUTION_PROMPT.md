# Members — Frontend Authorized Execution Prompt

**Audience:** Frontend developer  
**Allowed task IDs only:** `FE-T1` · `FE-T2` · `FE-T3` · `FE-T4` · `FE-T5` · `FE-T6`  
**Binding classes:** Execution Boundary `E-A1` · `E-A2` · `E-A3` (as mapped per task)  
**Date:** 2026-08-08  

**Policy SoT:** Decision Log P1–P12 · Acceptance Rules AR-01–AR-13 · Step 15 Execution Boundary · Step 16 Authorized Execution Breakdown  

---

## Agent preamble (paste at start of every FE session)

You are executing **Members Frontend authorized work only** (`FE-T1`–`FE-T6`).

- You may only preserve Safe Own Keep surfaces or repair Critical/High / a11y-AR-EN / security issues on those Own surfaces.
- You must **not** implement Target State, redesign UI, add features, enrich Frozen Legacy, or expand commercial Members chrome.
- Before any change: map the work to **exactly one** allowed ID (`FE-T1`…`FE-T6`) and its `E-A*` class. If it does not map, **stop**.
- All gates **G1–G10** must Pass. One Fail = do not ship.
- Evidence is required before completion (see Evidence section).

---

## Forbidden scope (hard stop)

Do **not** do any of the following:

| ID | Forbidden |
|----|-----------|
| E-F1 | Treat Target State as build authorization |
| E-F2 | Enrich Assign / Renew / Freeze on Members |
| E-F3 | Expand Expired / Frozen as person-primary language |
| E-F4 | Add commercial columns, Members-hosted commercial workflows, or Members-owned foreign endpoints |
| E-F5 | Hard-remove Frozen Legacy |
| E-F6 | Relocate foreign surfaces without formal P12 Log revision |
| E-F7 | Claim Members Own of membership / attendance / payments / POS / CRM / scheduling / inventory / loyalty |
| E-F8 | Build P9 gaps (merge, people-only import, prefs/WhatsApp, elected extensions) |
| E-F9 | Claim mission Pass while Membership Console dominates |
| E-F10 | Scale Members as commercial console |
| E-F11 | Conflict with P1–P11 / AR-01–AR-11 without cited P12 revision |
| E-F12 | Use Impact Assessment as a backlog |

**Also forbidden for FE specifically:**

- UI redesign, IA collapse, visual refreshes, design-system restyles  
- New features of any kind  
- Target State implementation (Trust IA, remove ERP tabs, relocate CTAs, etc.)  
- Changes to list filters/stats/Plan/Status/Remaining for product reasons  
- Changes to Assign / Renew / Freeze / Notification / Credits / Attendance / History surfaces except if an Own Keep defect fix would otherwise be impossible — and then **only** the minimum non-enriching touch with explicit gate evidence  
- Referral-field expansion or new person form fields  

---

## Allowed tasks

### FE-T1 — Preserve Members Keep people-book entry path  
- **E-A:** E-A1  
- **Trace:** P1–P2, AR-01–AR-02  
- **In:** Search, paged list findability, Member/Phone columns, Add CTA as entry to create-person, View/Edit, pagination — **preservation only**  
- **Not included:** List commercial chrome; filter/stats redesign; Plan/Status/Remaining; Renew/Assign CTAs; Relocate tabs  

### FE-T2 — Preserve person create / edit Keep fields  
- **E-A:** E-A1  
- **Trace:** P2, AR-02  
- **In:** Identity, contact, DOB, national ID, emergency intent, notes — **preservation only**  
- **Not included:** Referral expansion; Assign modal; form redesign; new fields; P9 prefs/WhatsApp  

### FE-T3 — Preserve detail identity + Active/Archived person control  
- **E-A:** E-A1  
- **Trace:** P2, P6, AR-02, AR-06  
- **In:** Identity block; Active/Inactive toggle; Deactivate/Activate account — **preservation only**  
- **Not included:** Membership panel; Freeze/Renew/Assign; Credits/Attendance/History tabs; quota/credits chips; Send Notification expansion  

### FE-T4 — Critical/High defect repair on Keep FE Own surfaces only  
- **E-A:** E-A2  
- **Trace:** P2, AR-02, E-A2  
- **In:** Defects that corrupt person truth, findability, or Own authz UX on Keep surfaces  
- **Prerequisite:** Severity is Critical or High; defect ID recorded  
- **Not included:** “Fixes” that improve Assign/Renew/Freeze, Expired/Frozen chrome, ERP tabs, or commercial CTAs  

### FE-T5 — Accessibility / AR-EN integrity fixes on Keep FE Own surfaces  
- **E-A:** E-A2  
- **Trace:** E-A2, P2, AR-02  
- **In:** a11y or AR/EN integrity on Keep Own UI only  
- **Not included:** Visual redesign; IA changes; membership-console copy systems  

### FE-T6 — Security-related FE hardening on Own person flows  
- **E-A:** E-A3  
- **Trace:** E-A3, P2, AR-02  
- **In:** Person-data exposure / authz display integrity on Own create/edit/detail identity flows  
- **Not included:** New commercial workflows; foreign-domain hosting; Legacy productization  

---

## Validation gates (must Pass before completion)

| Gate | Test |
|------|------|
| G1 | Change cites task ID + policy/AR IDs |
| G2 | Creep test: person vs process — no new process Own |
| G3 | Fits E-A1–E-A3 mapping for that task; not E-F* |
| G4 | No Frozen Legacy enrichment |
| G5 | No commercial surface expansion |
| G6 | No Expired/Frozen person-primary language expansion |
| G7 | P9 not used as authorization |
| G8 | Conflicts → stop for P12 revision |
| G9 | Do not claim mission Pass |
| G10 | Deliverable is preservation or Own critical/security fix — not Target delivery |

---

## Evidence required before completion

Provide a short evidence pack in the PR / handoff:

1. **Task ID** used (`FE-Tn`) and **E-A** class  
2. **Before/after** summary of Keep Own behavior preserved or defect resolved  
3. **Gate checklist** G1–G10 with Pass/Fail for each  
4. **Forbidden scan:** explicit statement that E-F2, E-F3, E-F4, and Target implementation were not performed  
5. For FE-T4/T5/T6: **defect or security ID**, severity, and confirmation touch area was Keep Own only  
6. Paths of files touched  

**Incomplete without evidence.** Do not mark done on code alone.

---

## Progress

| ID | Status | Date | Evidence link / note |
|----|--------|------|----------------------|
| FE-T1 | DONE — verified | 2026-08-08 | Cycle 1 closure + FE evidence audit — Keep path Pass · no code change |
| FE-T2 | DONE — verified | 2026-08-08 | Create/edit Keep fields Pass · no code change |
| FE-T3 | DONE — verified | 2026-08-08 | Identity + Active/Inactive Pass · no code change |
| FE-T4 | N/A | 2026-08-08 | No Critical/High Own Keep FE defect |
| FE-T5 | N/A | 2026-08-08 | No Critical/High a11y/AR-EN Own defect |
| FE-T6 | N/A | 2026-08-08 | No Critical Own FE security defect |
