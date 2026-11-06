/**
 * HyMotion — Cairo calendar helpers for report date presets.
 * Financial APIs interpret DateOnly ranges in Africa/Cairo.
 */
(function (global) {
  'use strict';

  var TZ = 'Africa/Cairo';

  function toYmd(date) {
    var d = date instanceof Date ? date : new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  function todayYmd() {
    return toYmd(new Date());
  }

  function parseYmd(ymd) {
    var parts = String(ymd || '').split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function addDaysYmd(ymd, delta) {
    var p = parseYmd(ymd);
    if (!p) return ymd;
    var utc = Date.UTC(p.year, p.month - 1, p.day + delta, 12, 0, 0);
    return toYmd(new Date(utc));
  }

  function startOfMonthYmd(refYmd) {
    var p = parseYmd(refYmd || todayYmd());
    if (!p) return refYmd;
    return p.year + '-' + String(p.month).padStart(2, '0') + '-01';
  }

  function presetRange(preset) {
    var to = todayYmd();
    if (preset === 'last7') return { from: addDaysYmd(to, -6), to: to };
    if (preset === 'last30') return { from: addDaysYmd(to, -29), to: to };
    if (preset === 'thisMonth') return { from: startOfMonthYmd(to), to: to };
    return { from: to, to: to };
  }

  global.GfpCairoDates = {
    TZ: TZ,
    toYmd: toYmd,
    todayYmd: todayYmd,
    addDaysYmd: addDaysYmd,
    startOfMonthYmd: startOfMonthYmd,
    presetRange: presetRange,
  };
})(typeof window !== 'undefined' ? window : globalThis);
