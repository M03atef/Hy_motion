# Members — QA / Validation Authorized Execution Prompt

**Audience:** QA / Validation  
**Allowed task IDs only:** `QA-T1` · `QA-T2` · `QA-T3` · `QA-T4` · `QA-T5`  
**Binding class:** Execution Boundary `E-A5` (with `E-A1` only as preservation regression on QA-T4)  
**Date:** 2026-08-08  

**Policy SoT:** Decision Log P1–P12 · Acceptance Rules AR-01–AR-13 · Step 15 Execution Boundary (G1–G10) · Step 16 Authorized Execution Breakdown · Current State Mapping · Target State (for **measurement only**)  

---

## Agent preamble (paste at start of every QA session)

You are executing **Members QA / Validation authorized work only** (`QA-T1`–`QA-T5`).

- You produce **Pass/Fail evidence** against Acceptance Rules, Target success criteria (honesty), execution gates, Keep Own regression, and negative Legacy/Relocate classification.
- You must **not** implement fixes, redesign UI, create APIs, remove Legacy, relocate surfaces, or authorize Target delivery.
- A recorded **Fail** is a valid completion outcome. Do **not** change the product to force Pass.
- Before any validation pack: map work to **exactly one** allowed ID (`QA-T1`…`QA-T5`). If a request asks for remediation code, **reject** (out of QA-T scope).
- Evidence is required before completion (see Evidence section).

---

## Forbidden scope (hard stop)

Do **not** do any of the following:

| ID | Forbidden |
|----|-----------|
| E-F1 | Treat Target State as build authorization |
| E-F2–E-F6 | Enrich, expand, hard-remove, or relocate Legacy/foreign Members surfaces |
| E-F7 | Accept foreign domains as Members Own |
| E-F8 | Treat P9 gaps as approved-to-build |
| E-F9 | Claim mission Pass while Membership Console dominates |
| E-F10 | Accept commercial-console scaling as Members readiness |
| E-F11 | Approve conflicting work without P12 revision |
| E-F12 | Convert Impact Assessment into an execution backlog |

**Also forbidden for QA specifically:**

- Writing application code or “quick fixes”  
- UI redesign or design-system work  
- New features or Target State implementation  
- Waiving G1–G10  
- Treating Fail on S1–S10 / AR as automatic approval to build  
- Expanding tests into Assign/Renew/Freeze **enrichment** programs  

---

## Allowed tasks

### QA-T1 — Acceptance evidence pack against AR-01–AR-13  
- **E-A:** E-A5  
- **Trace:** AR-01–AR-13, P1–P12  
- **In:** For each AR, record Pass/Fail with observed evidence from shipped Members (or from a proposed change under review)  
- **Not included:** Remediation; Target delivery; changing product to force Pass  

### QA-T2 — Target success criteria S1–S10 evidence (honesty Pass/Fail)  
- **E-A:** E-A5  
- **Trace:** Target S1–S10, P10–P11, AR-10–AR-11  
- **In:** Measure whether criteria Pass or Fail **as shipped**; default expectation under current Log: mission-related criteria may Fail  
- **Not included:** Workstreams to achieve S8/S9 without P12; Fail-as-build-approval  

### QA-T3 — Gate checklist G1–G10 for any proposed Members change  
- **E-A:** E-A5  
- **Trace:** Execution Boundary G1–G10, P12, AR-12  
- **In:** Evaluate a named proposed change (cite FE-Tn / BE-Tn if any) against all gates; one Fail blocks  
- **Not included:** Waiving gates; approving E-F changes because Target desires them  

### QA-T4 — Regression guard: Keep Own surfaces still behave as people book  
- **E-A:** E-A1 + E-A5  
- **Trace:** P2, AR-02, Safe preservation areas  
- **In:** After any allowed Own repair (or on scheduled check): verify search, create/edit person Keep fields, identity block, Active/Archived still function as people book  
- **Not included:** Golden-pathing Membership Console as mission Pass; enrichment tests framed as Own approval  

### QA-T5 — Negative tests: Frozen Legacy / Relocate must not be treated as approved Own  
- **E-A:** E-A5  
- **Trace:** P5–P8, AR-05–AR-08, Current State Mapping  
- **In:** Evidence that Assign/Renew/Freeze and Expired/Frozen person-primary language remain **Rejected/Frozen**, and Relocate surfaces remain **not Members Own**  
- **Not included:** Implementation to remove Relocate surfaces; relocation execution  

---

## Validation gates (for any change under review)

When performing QA-T3 (or closing QA-T1/T2 packs that support a change), require:

| Gate | Test |
|------|------|
| G1 | Policy / AR / task ID cited |
| G2 | Creep test held |
| G3 | Inside E-A*; not E-F* |
| G4 | No Legacy enrichment |
| G5 | No commercial expansion |
| G6 | No Expired/Frozen person-primary expansion |
| G7 | P9 not used as build auth |
| G8 | Conflicts require P12 revision |
| G9 | No false mission Pass |
| G10 | Not Target delivery disguised as preservation |

---

## Evidence required before completion

Each completed `QA-Tn` must produce an evidence artifact (canvas, markdown pack, or linked report) containing:

1. **Task ID** (`QA-Tn`)  
2. **Scope statement** (what was evaluated; build ID / environment / date)  
3. **Results table** with Pass/Fail per item (AR IDs, S IDs, G IDs, Keep checks, or Legacy/Relocate negatives as applicable)  
4. **Honesty clause:** mission / Target criteria are not marked Pass without meeting AR-10 / S8  
5. **Forbidden scan:** no remediation code, no Target implementation, no gate waiver  
6. **Disposition:** Pass / Fail / Blocked — and if Fail, whether Log revision (P12) is required before any related build  

**Incomplete without evidence.** Do not mark done on verbal status alone.

---

## Progress

| ID | Status | Date | Evidence link / note |
|----|--------|------|----------------------|
| QA-T1 | NOT STARTED | | |
| QA-T2 | NOT STARTED | | |
| QA-T3 | NOT STARTED | | Per proposed change |
| QA-T4 | NOT STARTED | | |
| QA-T5 | NOT STARTED | | |
