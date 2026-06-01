const contentEl = document.getElementById('content');
const rawEl = document.getElementById('rawClipboard');

document.getElementById('copyAll').addEventListener('click', copyAll);
document.getElementById('clearAll').addEventListener('click', clearAll);

render();

function render() {
  loadData((data) => {
    const weeks = sortedWeekKeys(data);
    if (!weeks.length) {
      contentEl.innerHTML = '<p class="empty">No commits collected yet.</p>';
      return;
    }

    contentEl.innerHTML = '';
    weeks.forEach((weekKey) => {
      const items = data[weekKey] || [];

      const weekDiv = document.createElement('div');
      weekDiv.className = 'week';

      const head = document.createElement('div');
      head.className = 'week-header';
      head.innerHTML =
        `<span class="week-title">Week of ${weekKey}</span>` +
        `<span class="week-meta">${formatWeekRange(weekKey)}</span>`;
      weekDiv.appendChild(head);

      items.forEach((item, idx) => {
        const row = buildItemRow(item, () => removeItem(weekKey, idx));
        weekDiv.appendChild(row);
      });

      contentEl.appendChild(weekDiv);
    });
  });
}

async function buildPlainText(data) {
  const weeks = sortedWeekKeys(data);
  const blocks = [];
  for (const weekKey of weeks) {
    blocks.push(await buildWeekText(data[weekKey] || []));
  }
  return blocks.join('\n\n'); // blank line between weeks, no date headers
}

function copyAll() {
  const btn = document.getElementById('copyAll');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  loadData(async (data) => {
    try {
      const text = await buildPlainText(data);
      if (!text) {
        toast('Nothing to copy');
        return;
      }
      copyTextViaTextarea(rawEl, text);
      toast('Copied');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Copy All';
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

function clearAll() {
  if (!confirm('Clear ALL collected commits (every week)?')) return;
  saveData({}, render);
}
