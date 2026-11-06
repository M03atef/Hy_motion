# Member Invitation / Referral System — Conflicts + Implementation Prompts

> Grounded in the research plan vs live HyMotion codebase (as of 2026-08-06).
> **Rule for every prompt:** extend existing guest-invite / credit / check-in / analytics surfaces; do not invent a parallel invitations stack.

---

## A. Reality check (plan vs code)

| Plan assumption | Live reality |
|-----------------|--------------|
| “Does not actually exist yet — from-scratch” | **False.** `member_invitations`, `InvitationService`, send/history APIs, plan `InvitationQuota`, funnel analytics, and quota-by-period counting **already exist** (partial). |
| New unified `invitations` table | Prefer **evolve `member_invitations`**, not rename/replace (breaks analytics, EF, funnel, contracts). |
| Dual types `guest_pass` \| `referral` | Live table is **guest-visit only** (`GuestName`, `GuestPhoneNumber`, `VisitDate`). No `invitation_type`, no `referral_code` on invite. |
| Statuses + `rejected_fraud` | Live: `pending \| visited \| converted \| expired`. Never writes visited/converted/expired (repo helpers unused). |
| Guest check-in | **Missing.** Attendance always requires a real `MemberId` + `MembershipId`. No ManualCheckinReason = Guest. |
| Reward via `member_credits` | Ledger exists for **refunds** only: `EntryType` = `refund \| payment_use \| adjustment`. Must **extend** EntryType (or add typed reason + `referral_rewards` row), not invent a second wallet. |
| Plan referral reward fields | Only `InvitationQuota` exists. No `referral_reward_type` / `referral_reward_value`. |
| Member `referral_code`, counts, tier | **Missing.** Denormalized `InvitationQuotaRemaining` / `LastInvitationResetDate` are **legacy**; live truth = count by `QuotaPeriod`. |
| Automation holding period | Platform `automation_enrollments` is control-plane; tenant reward hold should use **Hangfire recurring/job** (mirror trial follow-up), not platform schema. |
| Online join `?ref=` | Public online-joining largely incomplete — attribute at **POS assign/sale + create-member** first; deep-link later. |
| WS16 “Referral Rewards & Loyalty” | **No WS16 invitation workstream** in repo; invitations funnel is under analytics **§16**. Use these **INV-*** prompts, not WS16. |

### Critical bugs to fix before/with net-new features

1. **JWT → GymMember resolution:** `InvitationController` passes JWT `sub` (= Identity user id) into `InvitationService` which queries `GymMember.Id`. Send/history fail for real members. Resolve via `AppUser.UserId` → `GymMember.AppUserId` (same pattern as notifications).
2. **Status vocabulary drift:** Docs/Flutter often say `sent`; code creates `pending`; funnel counts all rows as “sent”. Lock vocabulary in contracts.
3. **Stale docs** claiming visit/convert + admin quotas done — ignore delivery markdown; trust EF + `FRONTEND_API_CONTRACTS.ts`.

---

## B. Conflict register (resolve before coding)

| ID | Conflict | Resolution (binding) |
|----|----------|----------------------|
| C1 | Plan “from scratch” vs existing guest invite schema | **Extend** `MemberInvitation` / `member_invitations`. Do not create a second `invitations` table. |
| C2 | Plan rename `GuestPhone` vs live `GuestPhoneNumber` | Keep **`GuestPhoneNumber`**. Normalize with existing `PhoneNormalizer`. |
| C3 | Plan status `rejected_fraud` | Add as new allowed status; keep existing four. |
| C4 | Plan `referral_code` on invite vs on member | Member owns durable `ReferralCode`; invite may snapshot `ReferralCodeUsed`. |
| C5 | Guest pass uncapped sharing vs quota | Guest pass remains **plan.InvitationQuota / QuotaPeriod**. Referral shares **uncapped**; **rewarded** referrals have monthly cap. |
| C6 | Guest pass vs referral as one feature | Single table + `InvitationType`; **separate APIs/UI modes** so quotas/rewards never blend. |
| C7 | Reward = free days vs credit ledger | Free days → membership EndDate extension + audit; credit → `member_credits` with EntryType **`referral_reward`**. Lifecycle in **`referral_rewards`**. |
| C8 | Prefer `automation_enrollments` for hold | Use **tenant Hangfire job** `ProcessReferralRewardHoldsJob`. |
| C9 | Guest attendance without GymMember | Redeem invitation marks `visited`; extend check-in with `invitationId` / guest reason — do **not** fake GymMember rows for one-day guests. |
| C10 | Denormalized quota vs period counts | Period-count is source of truth. Denormalized column is cache only. |
| C11 | Family plan type vs “Invite family” | Flag/`ReferralKind=family` + higher reward config — not a third system. |
| C12 | Trial ≠ conversion | Reward only paid conversion ≥ min amount; trials/day_pass alone never grant. |
| C13 | Points / loyalty economy | Out of scope. Ambassador = counter + badge only. |
| C14 | Self-referral | Block when normalized phones match (optional national ID when both present). |
| C15 | Flutter / web surface | Member send UI = Flutter later; desk redeem = `apps/web`. Don’t block backend on Flutter. |

---

## C. Phased prompts (apply in order)

Copy one prompt per agent session. Each ends with acceptance criteria. Do **not** skip INV-0.

### Agent preamble (paste above every INV-N)

> You are implementing HyMotion invitations. Read `Frontend/MEMBER_INVITATION_SYSTEM_PROMPTS.md` section B conflicts; do not create a second invitations table; resolve members via AppUser not JWT-sub-as-GymMember.Id; guest_pass uses InvitationQuota; referrals use referral_rewards + member_credits EntryType extension; no points ledger. Follow OpenWolf `.wolf/OPENWOLF.md`.

---

### INV-0 — Foundations & ID fix (blocking) ✅ DONE (2026-08-07)

**Goal:** Make existing guest invite send/history work; freeze vocabulary/contracts before schema growth.

**Done:**
1. `InvitationService` resolves JWT `sub` → `AppUser.UserId` → `GymMember.AppUserId` (no longer treats `sub` as GymMember.Id).
2. `FRONTEND_API_CONTRACTS.ts` §22: statuses + `guestPhoneNumber` + funnel route; JWT note corrected.
3. WhatsApp via `IWhatsAppService.SendGuestInvitationAsync` (OTP sender misuse removed).
4. Tests: `InvitationServiceTests` (3) — linked send, wrong-id fail, quota period.

**Accept:** met.

---

### INV-1 — Schema evolve for dual types (guest_pass + referral) ✅ DONE (2026-08-07)

**Goal:** Migrate existing tables to support the plan without breaking funnel.

**Done:**
1. `member_invitations`: `InvitationType`, `ReferralCodeUsed`, `ConvertingSaleId`, nullable `VisitDate`, wider status.
2. `gym_members`: `ReferralCode` (filtered unique), `SuccessfulReferralCount`, `ReferralTier` + backfill codes.
3. `membership_plans`: `ReferralRewardType` / `ReferralRewardValue`; `InvitationQuota` kept for guest.
4. Plan DTOs/validators + web plans referral reward UI; new members get referral codes; quota counts `guest_pass` only.
5. Migration `AddInvitationReferralSchemaInv1` applied to LocalDB.

**Accept:** met (guest send tests 3/3).

---

### INV-2 — Complete guest_pass lifecycle (desk) ✅ DONE

**Goal:** pending → visited → expired; check-in; guest-phone abuse cap.

**Done:**
1. Desk web (Attendance): “Guest invite redeem” card — search pending by guest phone/name.
2. `GET /api/invitation/pending?q=` + `POST /api/invitation/{id}/redeem-visit` → `visited` + `VisitedAtUtc` (`checkin.manual`).
3. Redeem does **not** create GymMember / GymAttendance rows (conflict C9).
4. Hangfire `guest-pass-expiry` (00:15 Cairo): pending guest_pass with `VisitDate` &lt; today → `expired`.
5. Guardrail: ≤1 guest_pass visit per guest phone per rolling 90 days per tenant (send + redeem).
6. Funnel `visited` increments via existing `VisitedAtUtc` analytics count. Audit: `invitation.redeem`.

**Don't:** Pay rewards on guest visit. (unchanged)

**Accept:** met — InvitationServiceTests 6/6 (send, redeem, 90d reject, expire).

---

### INV-3 — Referral share + attribution (no payout yet) ✅ DONE

**Goal:** Uncapped referral share + attach at paid signup.

**Done:**
1. `GET /api/invitation/referral-share` — code + WhatsApp text + `?ref=CODE` hint.
2. Optional `referralCode` / `referringMemberId` on create-member, assign-membership, POS sale (+ newMember).
3. Paid activate hooks (`SaleService`, cash assign `PersistPaidMembershipAsync`, `PaymentService`) → status `converted` + `ConvertingSaleId` / timestamps; audit `invitation.convert` (no credits/days).
4. Self-referral blocked (phone + national ID when both present).
5. Tenant setting `referral_min_sale_amount_egp` (default 0); `trial` / `day_pass` never convert.

**Don't:** Grant credits/days yet. (unchanged)

**Accept:** met — `ReferralAttributionServiceTests` + invitation share (11 with INV-2 suite filter).

---

### INV-4 — referral_rewards + hold + grant/reverse ✅ DONE

**Goal:** Dual-sided rewards with fraud hold; reuse `member_credits`.

**Done:**
1. Table `referral_rewards` (`pending_hold|granted|reversed|forfeited`) — migration `AddReferralRewardsInv4`.
2. On convert: dual `pending_hold` rows (referrer + referee); hold days from `referral_hold_days` (default 14).
3. Hangfire `referral-reward-holds` hourly → grant credit (`EntryType=referral_reward`) or free_days (extend EndDate + audit); WhatsApp template `referral_reward_granted`.
4. Full sale refund → forfeit in-hold / reverse after grant (offsetting ledger or EndDate clip).
5. Monthly capped rewarded referrals (`referral_monthly_rewarded_cap`, default 10); `ReferralTier` from SuccessfulReferralCount (bronze/silver/gold/ambassador).
6. Plan override else price threshold (`referral_reward_price_threshold_egp` ~1500 → free_days else credit).
7. CK widened for `member_credits.EntryType` to include `referral_reward`.

**Don't:** Cash payout; points; platform automation_enrollments. (unchanged)

**Accept:** met — `ReferralRewardServiceTests` hold→grant, forfeit, reverse, free_days.

---

### INV-5 — Family referral path (thin) ✅ DONE

**Goal:** Higher reward when family-tagged / family plan conversion.

**Done:**
1. Family trigger: converting plan `PlanType == "family"`.
2. Tenant multiplier `referral_family_reward_multiplier` (default **1.5×**) on reward value at hold create.
3. `ReferralReward.IsFamily` label; migration `AddReferralRewardIsFamilyInv5`.
4. EN/AR rules copy on `GET /api/invitation/referral-share` (`FamilyRulesEn`/`Ar`, labels, multiplier).
5. No shared booking / new invitation subsystem.

**Accept:** met — family plan rewards 50→75 with 1.5×; non-family unchanged; share includes family copy.

---

### INV-6 — Analytics & owner KPIs ✅ DONE

**Goal:** Extend funnel for guest vs referral and contribution %.

**Done:**
1. `InvitationFunnelDto`: overall totals (compat) + `guestPass` / `referral` slices + Cairo-month `percentNewMembersFromReferrals`.
2. Reports widget: overall + split funnels + contribution card; contracts updated.
3. Retention compare deferred (INV-6b skipped).

**Don't:** Fake paid CAC. (unchanged)

**Accept:** met — `InvitationFunnelAnalyticsTests` matches guest/referral counts + 50% contribution.

---

### INV-6q — Guest quota consume-on-attendance ✅ DONE (2026-08-07)

**Goal:** Make plan `InvitationQuota` an enforced business rule (not send-count).

**Done:**
1. Usage = count `guest_pass` with `VisitedAtUtc` in Cairo `yyyy-MM` (pending/expired do not spend).
2. Send rejects only when remaining = 0; response `quotaUsed`/`quotaRemaining` unchanged by send.
3. Redeem consumes 1, re-checks quota, attributes `QuotaPeriod` to visit month; returns used/remaining.
4. `GET /api/invitation/guest-quota` (member) + `GET /api/invitation/members/{id}/guest-quota` (desk `checkin.manual`).
5. `MemberService` remaining aligned to visit-based count; contracts §22 updated.

**Accept:** met — InvitationServiceTests cover send-no-consume, redeem-consume, block at 0, expired no-spend.

---

### INV-7 — Flutter / member UI (after API stable)

**Goal:** “Invite a Friend” with Guest pass | Refer & earn; quota meter; rules copy.

**Do:** Correct field names to contracts (`guestPhoneNumber`, live statuses).

**Accept:** Member sends guest_pass within quota and shares referral code; rules mention hold period.

---

### INV-8 — Cleanup & doc hygiene

**Do:** Document or remove no-op `InvitationQuotaResetJob`; implement or delete orphan `InvitationQuotasDto`; fix stale markdown claiming full lifecycle done; update OpenWolf cerebrum/anatomy/memory.

---

## D. Build order

```text
INV-0 → INV-1 → INV-2 ─┐
              → INV-3 ─┴→ INV-4 → INV-5 → INV-6 → INV-7 → INV-8
```

---

## E. Out of scope (plan §9)

- Points-economy loyalty
- Device fingerprinting
- Rewarding trial starts
- Blending guest quota with referral reward caps
