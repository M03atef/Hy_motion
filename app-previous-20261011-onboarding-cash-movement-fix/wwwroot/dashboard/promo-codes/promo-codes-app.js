(function () {
  'use strict';
  const API_BASE = window.API_BASE || window.GFP_DEFAULT_API_BASE || '/api';

  function getToken() {
    return localStorage.getItem('gfp_access_token') || sessionStorage.getItem('gfp_access_token');
  }
  function getH() {
    const t = getToken();
    const h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('gfp_user') || sessionStorage.getItem('gfp_user'));
    } catch (_) {
      return null;
    }
  }
  function decodeJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {
      return null;
    }
  }
  function getPerms() {
    const p = decodeJwt(getToken() || '');
    const set = new Set();
    if (!p) return set;
    const raw = p.perm;
    if (Array.isArray(raw)) raw.forEach((x) => set.add(String(x)));
    else if (raw) set.add(String(raw));
    return set;
  }

  const user = getUser();
  const perms = getPerms();
  const canManage = perms.has('plans.manage') || /^Owner$/i.test((user && user.role) || '');
  let page = 1;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function toast(msg, type) {
    return globalThis.toastShared(msg, type);
  }
  async function api(method, path, body) {
    const opts = { method, headers: getH() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      location.href = '/auth/login/';
      return { ok: false, status: 401, data: null };
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  if (!canManage) {
    document.getElementById('btnNew').style.display = 'none';
  }

  async function load() {
    const q = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (document.getElementById('activeOnly').checked) q.set('activeOnly', 'true');
    if (document.getElementById('validToday').checked) q.set('validToday', 'true');
    const res = await api('GET', '/promo-codes?' + q.toString());
    const tbody = document.getElementById('tbody');
    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="muted">Failed (' +
        esc(String(res.status)) +
        ') — need sales.sell</td></tr>';
      return;
    }
    const items = (res.data && res.data.items) || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No promo codes</td></tr>';
    } else {
      tbody.innerHTML = items
        .map((p) => {
          const actions = [];
          if (canManage) {
            actions.push('<button type="button" class="btn secondary" data-edit="' + esc(p.id) + '">Edit</button>');
            if (p.isActive) {
              actions.push(
                '<button type="button" class="btn ghost" data-off="' + esc(p.id) + '">Deactivate</button>',
              );
            }
          }
          return (
            '<tr>' +
            '<td><strong>' +
            esc(p.code) +
            '</strong></td>' +
            '<td>' +
            esc(p.type) +
            '</td>' +
            '<td>' +
            esc(String(p.value)) +
            (p.type === 'percent' ? '%' : '') +
            '</td>' +
            '<td>' +
            esc(p.validFrom) +
            ' → ' +
            esc(p.validTo) +
            '</td>' +
            '<td>' +
            esc(String(p.usesCount)) +
            (p.maxUses != null ? ' / ' + esc(String(p.maxUses)) : '') +
            '</td>' +
            '<td class="' +
            (p.isActive ? 'status-on' : 'status-off') +
            '">' +
            (p.isActive ? 'Yes' : 'No') +
            '</td>' +
            '<td style="display:flex;gap:6px">' +
            actions.join('') +
            '</td>' +
            '</tr>'
          );
        })
        .join('');
    }

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.onclick = () => openEdit(btn.getAttribute('data-edit'), items);
    });
    tbody.querySelectorAll('[data-off]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Deactivate this promo?')) return;
        const r = await api('DELETE', '/promo-codes/' + btn.getAttribute('data-off'));
        if (!r.ok) {
          toast('Deactivate failed (' + r.status + ')', 'err');
          return;
        }
        toast('Deactivated', 'ok');
        load();
      };
    });

    const pager = document.getElementById('pager');
    pager.innerHTML = '';
    const data = res.data || {};
    if (data.hasPrevious) {
      const b = document.createElement('button');
      b.className = 'btn secondary';
      b.textContent = 'Prev';
      b.onclick = () => {
        page = Math.max(1, page - 1);
        load();
      };
      pager.appendChild(b);
    }
    if (data.hasNext) {
      const b = document.createElement('button');
      b.className = 'btn secondary';
      b.textContent = 'Next';
      b.onclick = () => {
        page += 1;
        load();
      };
      pager.appendChild(b);
    }
  }

  function openCreate() {
    document.getElementById('formCard').style.display = 'block';
    document.getElementById('formTitle').textContent = 'Create promo';
    document.getElementById('editId').value = '';
    document.getElementById('promoForm').reset();
  }

  function openEdit(id, items) {
    const p = items.find((x) => x.id === id);
    if (!p) return;
    document.getElementById('formCard').style.display = 'block';
    document.getElementById('formTitle').textContent = 'Edit ' + p.code;
    document.getElementById('editId').value = p.id;
    document.getElementById('fCode').value = p.code;
    document.getElementById('fType').value = p.type;
    document.getElementById('fValue').value = p.value;
    document.getElementById('fFrom').value = (p.validFrom || '').slice(0, 10);
    document.getElementById('fTo').value = (p.validTo || '').slice(0, 10);
    document.getElementById('fMaxUses').value = p.maxUses != null ? p.maxUses : '';
    document.getElementById('fMaxMember').value = p.maxUsesPerMember != null ? p.maxUsesPerMember : '';
    document.getElementById('fMinPrice').value = p.minPrice != null ? p.minPrice : '';
    document.getElementById('fApplies').value = (p.appliesTo || []).join(',');
  }

  function readBody() {
    const applies = document
      .getElementById('fApplies')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      code: document.getElementById('fCode').value.trim(),
      type: document.getElementById('fType').value,
      value: Number(document.getElementById('fValue').value),
      validFrom: document.getElementById('fFrom').value,
      validTo: document.getElementById('fTo').value,
      maxUses: document.getElementById('fMaxUses').value
        ? Number(document.getElementById('fMaxUses').value)
        : null,
      maxUsesPerMember: document.getElementById('fMaxMember').value
        ? Number(document.getElementById('fMaxMember').value)
        : null,
      minPrice: document.getElementById('fMinPrice').value
        ? Number(document.getElementById('fMinPrice').value)
        : null,
      appliesTo: applies.length ? applies : null,
    };
  }

  document.getElementById('btnNew').onclick = openCreate;
  document.getElementById('btnCancel').onclick = () => {
    document.getElementById('formCard').style.display = 'none';
  };
  document.getElementById('btnReload').onclick = () => {
    page = 1;
    load();
  };
  document.getElementById('promoForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!canManage) {
      toast('plans.manage required', 'err');
      return;
    }
    const id = document.getElementById('editId').value;
    const body = readBody();
    const res = id
      ? await api('PUT', '/promo-codes/' + id, body)
      : await api('POST', '/promo-codes', body);
    if (!res.ok) {
      toast((res.data && (res.data.detail || res.data.title)) || 'Save failed', 'err');
      return;
    }
    toast('Saved', 'ok');
    document.getElementById('formCard').style.display = 'none';
    load();
  };

  load();
})();
