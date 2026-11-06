/**
 * Stock Management embed + legacy redirect helper.
 * - ?embed=1 → paint as framed workspace (no sidebar chrome)
 * - otherwise → redirect into the hub with the right tab (keeps deep-link query)
 */
(function () {
  'use strict';
  try {
    var u = new URL(window.location.href);
    if (u.searchParams.get('embed') === '1') {
      document.documentElement.classList.add('stock-embed');
      document.addEventListener(
        'click',
        function (e) {
          var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!a) return;
          var href = a.getAttribute('href') || '';
          if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
          if (href.indexOf('/dashboard/') === 0 && href.indexOf('embed=1') < 0) {
            a.setAttribute('target', '_top');
          }
        },
        true
      );
      return;
    }

    var path = u.pathname || '';
    var tab = 'on-hand';
    if (path.indexOf('/transfers') >= 0) tab = 'move';
    else if (path.indexOf('/counts') >= 0) tab = 'count';
    else if (path.indexOf('/stock') >= 0) tab = 'on-hand';
    else return;

    var hub = new URL('/dashboard/inventory/stock-management/', window.location.origin);
    hub.searchParams.set('tab', tab);
    u.searchParams.forEach(function (value, key) {
      if (key === 'embed' || key === 'tab') return;
      hub.searchParams.set(key, value);
    });
    window.location.replace(hub.pathname + hub.search + (u.hash || ''));
  } catch (e) {
    /* ignore */
  }
})();
