const STORAGE_KEY = 'weeklyCommits';
const DONE_STATUSES = ['closed', 'fixed master', 'fixed live', 'verified fixed master', 'verified fixed feature', 'Done'];

const statusCache = new Map();

function loadData(cb) {
  chrome.storage.local.get({ [STORAGE_KEY]: {} }, (res) => cb(res[STORAGE_KEY] || {}));
}

function saveData(data, cb) {
  chrome.storage.local.set({ [STORAGE_KEY]: data }, cb || (() => {}));
}

function sortedWeekKeys(data) {
  return Object.keys(data).sort((a, b) => (a < b ? 1 : -1)); // newest week first
}

// Monday as the first day of the week (ISO). Returns YYYY-MM-DD.
function getCurrentWeekKey() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatWeekRange(weekKey) {
  const [y, m, d] = weekKey.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

// "WEB-122742 some summary" -> "some summary"
function stripKey(commit, caseKey) {
  if (!caseKey) return commit;
  const re = new RegExp('^\\s*\\[?' + caseKey.replace('-', '\\-') + '\\]?\\s*');
  return commit.replace(re, '').trim();
}

function statusSuffix(statusName) {
  const s = (statusName || '').trim().toLowerCase();
  return DONE_STATUSES.includes(s) ? ' (Done)' : ' (In Progress - )';
}

function originFor(item) {
  try {
    return new URL(item.url).origin;
  } catch (e) {
    return 'https://planetart.atlassian.net';
  }
}

async function fetchStatus(origin, caseKey) {
  if (statusCache.has(caseKey)) return statusCache.get(caseKey);
  try {
    const resp = await fetch(`${origin}/rest/api/2/issue/${caseKey}?fields=status`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    const name = json && json.fields && json.fields.status ? json.fields.status.name : '';
    statusCache.set(caseKey, name);
    return name;
  } catch (e) {
    statusCache.set(caseKey, null);
    return null;
  }
}

// Single-line copy: no status lookup, no suffix.
function formatLinePlain(item) {
  const title = stripKey(item.commit, item.caseKey);
  return `[${item.caseKey}] ${title}`;
}

// Cookie/session invalid -> no status -> no suffix, but still copy the line.
async function formatLine(item) {
  const status = await fetchStatus(originFor(item), item.caseKey);
  const suffix = status === null ? '' : statusSuffix(status);
  return `${formatLinePlain(item)}${suffix}`;
}

function copyTextViaTextarea(rawEl, text) {
  rawEl.value = text;
  rawEl.select();
  document.execCommand('copy');
}

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

function buildItemRow(item, onRemove) {
  const row = document.createElement('div');
  row.className = 'item';

  const link = document.createElement('a');
  link.href = item.url || '#';
  link.target = '_blank';
  link.textContent = item.commit;
  row.appendChild(link);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-one';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    const line = formatLinePlain(item);
    const raw = document.getElementById('rawClipboard');
    copyTextViaTextarea(raw, line);
    toast('Copied');
  });
  row.appendChild(copyBtn);

  if (onRemove) {
    const delBtn = document.createElement('button');
    delBtn.className = 'del-one';
    delBtn.textContent = '✕';
    delBtn.title = 'Remove';
    delBtn.addEventListener('click', onRemove);
    row.appendChild(delBtn);
  }

  return row;
}

async function buildWeekText(items) {
  const lines = await Promise.all(items.map(formatLine));
  return lines.join('\n');
}
