/**
 * HR secondary-route helper.
 * Do NOT open Staff/HR pages in target=_blank — sessionStorage auth does not carry to new tabs.
 * Do NOT iframe full dashboard pages — that nests a second shell (broken layout).
 * Departments/Positions/Shifts are normal full pages; ?embed=1 only hides chrome if ever needed.
 */
(function () {
  'use strict';
  try {
    var u = new URL(window.location.href);
    if (u.searchParams.get('embed') === '1') {
      document.documentElement.classList.add('hr-embed');
    }
  } catch (e) {
    /* ignore */
  }
})();
