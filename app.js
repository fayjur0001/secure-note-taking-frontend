/* Plain JS client for the Secure Notes API. No framework on purpose. */
const API = (window.API_URL || '').replace(/\/$/, '');
const $ = (sel) => document.querySelector(sel);

const state = {
  token: localStorage.getItem('token'),
  me: null,
  pages: { notes: 1, posts: 1, interests: 1, users: 1, adminNotes: 1 },
  postsUserId: '',
  interestFilter: '',
  ownerFilter: '',
};

/* ---------------- helpers ---------------- */

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout();
    throw new Error((data.error || `HTTP ${res.status}`) + (data.details ? ': ' + data.details.join(', ') : ''));
  }
  return data;
}

const showError = (err) => { $('#msg').textContent = err ? err.message || String(err) : ''; };
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '');

/** Build a <tr> safely (textContent, so user content can't inject HTML). */
function row(cells, actions = []) {
  const tr = document.createElement('tr');
  for (const c of cells) {
    const td = document.createElement('td');
    td.textContent = c ?? '';
    tr.appendChild(td);
  }
  if (actions.length) {
    const td = document.createElement('td');
    for (const [label, fn] of actions) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => fn().catch(showError);
      td.appendChild(b);
    }
    tr.appendChild(td);
  }
  return tr;
}

function pager(el, pageKey, pagination, reload) {
  el.innerHTML = '';
  const prev = document.createElement('button');
  prev.textContent = '« Prev';
  prev.disabled = pagination.page <= 1;
  prev.onclick = () => { state.pages[pageKey]--; reload().catch(showError); };
  const next = document.createElement('button');
  next.textContent = 'Next »';
  next.disabled = !pagination.hasMore;
  next.onclick = () => { state.pages[pageKey]++; reload().catch(showError); };
  const span = document.createElement('span');
  span.textContent = ` Page ${pagination.page} `;
  el.append(prev, span, next);
}

function wireForm(sel, handler) {
  $(sel).addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(null);
    try { await handler(e.target); } catch (err) { showError(err); }
  });
}

/* ---------------- auth ---------------- */

function setSession(token, user) {
  state.token = token;
  localStorage.setItem('token', token);
  setMe(user);
}

function setMe(user) {
  state.me = user;
  $('#me-name').textContent = user.name;
  $('#me-role').textContent = user.role;
  $('#me-id').textContent = user._id;
  document.querySelectorAll('.admin-only').forEach((el) => el.classList.toggle('hidden', user.role !== 'admin'));
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  const pf = $('#profile-form');
  pf.name.value = user.name;
  pf.interests.value = (user.interests || []).join(', ');
  showTab('notes');
}

function logout() {
  state.token = null;
  state.me = null;
  localStorage.removeItem('token');
  $('#app-view').classList.add('hidden');
  $('#auth-view').classList.remove('hidden');
}

wireForm('#login-form', async (f) => {
  const { token, user } = await api('/api/auth/login', { method: 'POST', body: formData(f) });
  f.reset();
  setSession(token, user);
});

wireForm('#register-form', async (f) => {
  const d = formData(f);
  const { token, user } = await api('/api/auth/register', {
    method: 'POST',
    body: { ...d, interests: splitList(d.interests) },
  });
  f.reset();
  setSession(token, user);
});

$('#logout').onclick = logout;

/* ---------------- tabs ---------------- */

const loaders = {
  notes: loadNotes,
  profile: async () => {},
  posts: loadUserPosts,
  interests: loadInterests,
  'admin-users': loadUsers,
  'admin-notes': loadAdminNotes,
};

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  showError(null);
  loaders[name]().catch(showError);
}
document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

/* ---------------- my notes ---------------- */

async function loadNotes() {
  const { data, pagination } = await api(`/api/notes?page=${state.pages.notes}&limit=5`);
  const body = $('#notes-body');
  body.innerHTML = '';
  for (const n of data) {
    body.appendChild(row([n.title, n.content, fmtDate(n.updatedAt)], [
      ['Edit', async () => {
        const f = $('#note-form');
        f.id.value = n._id; f.title.value = n.title; f.content.value = n.content;
      }],
      ['Delete', async () => {
        if (!confirm('Delete note?')) return;
        await api(`/api/notes/${n._id}`, { method: 'DELETE' });
        await loadNotes();
      }],
    ]));
  }
  pager($('#notes-pager'), 'notes', pagination, loadNotes);
}

wireForm('#note-form', async (f) => {
  const { id, title, content } = formData(f);
  if (id) await api(`/api/notes/${id}`, { method: 'PUT', body: { title, content } });
  else await api('/api/notes', { method: 'POST', body: { title, content } });
  f.reset();
  f.id.value = '';
  state.pages.notes = 1;
  await loadNotes();
});
$('#note-cancel').onclick = () => { $('#note-form').reset(); $('#note-form').id.value = ''; };

/* ---------------- profile ---------------- */

wireForm('#profile-form', async (f) => {
  const d = formData(f);
  const body = { name: d.name, interests: splitList(d.interests) };
  if (d.password) body.password = d.password;
  const { user } = await api('/api/auth/me', { method: 'PATCH', body });
  f.password.value = '';
  setMe(user);
  showTab('profile');
});

/* ---------------- posts (Scenario 2) ---------------- */

wireForm('#post-form', async (f) => {
  await api('/api/posts', { method: 'POST', body: formData(f) });
  f.reset();
  state.postsUserId = '';
  state.pages.posts = 1;
  await loadUserPosts();
});

wireForm('#user-posts-form', async (f) => {
  state.postsUserId = f.userId.value.trim();
  state.pages.posts = 1;
  await loadUserPosts();
});

async function loadUserPosts() {
  const userId = state.postsUserId || state.me._id;
  const { user, data, pagination } = await api(`/api/users/${userId}/posts?page=${state.pages.posts}&limit=5`);
  $('#user-posts-title').textContent = `Posts by ${user.name}`;
  const body = $('#user-posts-body');
  body.innerHTML = '';
  const mine = String(user._id) === String(state.me._id);
  for (const p of data) {
    const actions = mine
      ? [['Delete', async () => { await api(`/api/posts/${p._id}`, { method: 'DELETE' }); await loadUserPosts(); }]]
      : [];
    body.appendChild(row([p.title, p.body, fmtDate(p.createdAt)], actions));
  }
  pager($('#user-posts-pager'), 'posts', pagination, loadUserPosts);
}

/* ---------------- interests (Scenario 1) ---------------- */

wireForm('#interests-form', async (f) => {
  state.interestFilter = f.interest.value.trim();
  state.pages.interests = 1;
  await loadInterests();
});

async function loadInterests() {
  const q = new URLSearchParams({ page: state.pages.interests, limit: 10 });
  if (state.interestFilter) q.set('interest', state.interestFilter);
  const { data, pagination } = await api(`/api/users/interests?${q}`);
  const body = $('#interests-body');
  body.innerHTML = '';
  for (const g of data) {
    const tr = row([g.interest, g.count]);
    const td = document.createElement('td');
    for (const u of g.users) {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = u.name;
      a.title = 'View posts';
      a.onclick = (e) => {
        e.preventDefault();
        state.postsUserId = u._id;
        state.pages.posts = 1;
        $('#user-posts-form').userId.value = u._id;
        showTab('posts');
      };
      td.append(a, ' ');
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }
  pager($('#interests-pager'), 'interests', pagination, loadInterests);
}

/* ---------------- admin: users ---------------- */

async function loadUsers() {
  const { data, pagination } = await api(`/api/admin/users?page=${state.pages.users}&limit=10`);
  const body = $('#users-body');
  body.innerHTML = '';
  for (const u of data) {
    body.appendChild(row([u.name, u.email, u.role, (u.interests || []).join(', ')], [
      ['Edit', async () => {
        const f = $('#user-form');
        f.id.value = u._id; f.name.value = u.name; f.email.value = u.email;
        f.role.value = u.role; f.interests.value = (u.interests || []).join(', '); f.password.value = '';
      }],
      ['Notes', async () => {
        state.ownerFilter = u._id;
        state.pages.adminNotes = 1;
        $('#admin-notes-form').owner.value = u._id;
        showTab('admin-notes');
      }],
      ['Delete', async () => {
        if (!confirm(`Delete ${u.email} and all their notes/posts?`)) return;
        await api(`/api/admin/users/${u._id}`, { method: 'DELETE' });
        await loadUsers();
      }],
    ]));
  }
  pager($('#users-pager'), 'users', pagination, loadUsers);
}

wireForm('#user-form', async (f) => {
  const d = formData(f);
  const body = { name: d.name, email: d.email, role: d.role, interests: splitList(d.interests) };
  if (d.password) body.password = d.password;
  if (d.id) await api(`/api/admin/users/${d.id}`, { method: 'PUT', body });
  else await api('/api/admin/users', { method: 'POST', body });
  f.reset();
  f.id.value = '';
  await loadUsers();
});
$('#user-cancel').onclick = () => { $('#user-form').reset(); $('#user-form').id.value = ''; };

/* ---------------- admin: all notes ---------------- */

wireForm('#admin-notes-form', async (f) => {
  state.ownerFilter = f.owner.value.trim();
  state.pages.adminNotes = 1;
  await loadAdminNotes();
});

async function loadAdminNotes() {
  const q = new URLSearchParams({ page: state.pages.adminNotes, limit: 10 });
  if (state.ownerFilter) q.set('owner', state.ownerFilter);
  const { data, pagination } = await api(`/api/admin/notes?${q}`);
  const body = $('#admin-notes-body');
  body.innerHTML = '';
  for (const n of data) {
    const owner = n.owner ? `${n.owner.name} <${n.owner.email}>` : '(deleted)';
    body.appendChild(row([owner, n.title, n.content, fmtDate(n.updatedAt)]));
  }
  pager($('#admin-notes-pager'), 'adminNotes', pagination, loadAdminNotes);
}

/* ---------------- boot ---------------- */

(async function init() {
  if (!state.token) return;
  try {
    const { user } = await api('/api/auth/me');
    setMe(user);
  } catch {
    logout();
  }
})();
