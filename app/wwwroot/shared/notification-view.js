/**
 * HyMotion — notification view helpers (Phase 2, canonical §E/§I).
 * Pure, DOM-free: severity/category presentation maps and the badge-count selector.
 * Consumed by staff-notifications.js (badge), the notifications inbox page, and
 * notifications.selftest.js (loaded in a VM sandbox — keep this file stub-free).
 */
(function (global) {
  'use strict';

  var SEVERITY = {
    Critical: { cls: 'sev-critical', icon: 'ti-alert-triangle', en: 'Critical', ar: 'حرج' },
    ActionRequired: { cls: 'sev-action', icon: 'ti-clock', en: 'Action required', ar: 'يتطلب إجراء' },
    Info: { cls: 'sev-info', icon: 'ti-bell', en: 'Info', ar: 'معلومة' }
  };

  var CATEGORY = {
    Payments: { en: 'Payments', ar: 'المدفوعات' },
    Shifts: { en: 'Shifts', ar: 'الورديات' },
    Inventory: { en: 'Inventory', ar: 'المخزون' },
    Purchasing: { en: 'Purchasing', ar: 'المشتريات' },
    Memberships: { en: 'Memberships', ar: 'العضويات' },
    Members: { en: 'Members', ar: 'الأعضاء' },
    Leads: { en: 'Leads', ar: 'العملاء المحتملون' },
    Classes: { en: 'Classes', ar: 'الحصص' },
    Bookings: { en: 'Bookings', ar: 'الحجوزات' },
    Attendance: { en: 'Attendance', ar: 'الحضور' },
    Pos: { en: 'POS', ar: 'نقطة البيع' },
    Staff: { en: 'Staff', ar: 'الموظفون' },
    Security: { en: 'Security', ar: 'الأمان' },
    System: { en: 'System', ar: 'النظام' }
  };

  /** Severity presentation for a stored Priority value; unknown/null → Info presentation. */
  function severityView(priority) {
    return SEVERITY[priority] || SEVERITY.Info;
  }

  /** Localized category label; unknown/null categories return null — callers render nothing (never a raw enum). */
  function categoryView(category) {
    if (!category) return null;
    return CATEGORY[category] || null;
  }

  /**
   * Badge value selector (canonical two-count contract): the sidebar badge represents
   * needsAttention (unread ∧ unresolved ∧ priority ≥ ActionRequired), NOT total unread.
   * Falls back to count only for a pre-Phase-2 endpoint payload.
   */
  function pickBadgeCount(data) {
    if (!data) return 0;
    if (typeof data.needsAttention === 'number') return data.needsAttention;
    if (typeof data.count === 'number') return data.count;
    return 0;
  }

  global.GfpNotificationView = {
    severityView: severityView,
    categoryView: categoryView,
    pickBadgeCount: pickBadgeCount,
    SEVERITY: SEVERITY,
    CATEGORY: CATEGORY
  };
})(typeof window !== 'undefined' ? window : globalThis);
