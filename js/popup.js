const contentEl = document.getElementById('content');
const rawEl = document.getElementById('rawClipboard');

document.getElementById('copyAll').addEventListener('click', copyCurrentWeek);
document.getElementById('clearAll').addEventListener('click', clearCurrentWeek);
document.getElementById('viewHistory').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
});

render();

function render() {
  loadData((data) => {
    const weekKey = getCurrentWeekKey();
    const items = data[weekKey] || [];

    if (!items.length) {
      contentEl.innerHTML = '<p class="empty">No commits collected this week yet.</p>';
      return;
    }

    contentEl.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'week-header';
    head.innerHTML =
      `<span class="week-title">This week (${weekKey})</span>` +
      `<span class="week-meta">${formatWeekRange(weekKey)}</span>`;
    contentEl.appendChild(head);

    items.forEach((item, idx) => {
      const row = buildItemRow(item, () => removeItem(weekKey, idx));
      contentEl.appendChild(row);
    });
  });
}

function copyCurrentWeek() {
  const btn = document.getElementById('copyAll');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  loadData(async (data) => {
    try {
      const items = data[getCurrentWeekKey()] || [];
      if (!items.length) {
        toast('Nothing to copy');
        return;
      }
      const text = await buildWeekText(items);
      copyTextViaTextarea(rawEl, text);
      toast('Copied');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Copy Week';
    }
  });
}

function removeItem(weekKey, idx) {
  loadData((data) => {
    if (!data[weekKey]) return;
    data[weekKey].splice(idx, 1);
    if (data[weekKey].length === 0) delete data[weekKey];
    saveData(data, render);
  });
}

function clearCurrentWeek() {
  if (!confirm('Clear this week\'s collected commits?')) return;
  loadData((data) => {
    const weekKey = getCurrentWeekKey();
    delete data[weekKey];
    saveData(data, render);
  });
}
