const contentEl = document.getElementById('content');
const rawEl = document.getElementById('rawClipboard');

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

      const info = document.createElement('div');
      info.className = 'week-header-info';
      info.innerHTML =
        `<span class="week-title">Week of ${weekKey}</span>` +
        `<span class="week-meta">${formatWeekRange(weekKey)}</span>`;
      head.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'week-header-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-week primary';
      copyBtn.textContent = 'Copy All';
      copyBtn.title = 'Copy this week';
      copyBtn.addEventListener('click', () => copyWeek(weekKey, copyBtn));
      actions.appendChild(copyBtn);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'clear-week danger';
      clearBtn.textContent = 'Clear All';
      clearBtn.title = 'Clear this week';
      clearBtn.addEventListener('click', () => clearWeek(weekKey));
      actions.appendChild(clearBtn);

      head.appendChild(actions);
      weekDiv.appendChild(head);

      items.forEach((item, idx) => {
        const row = buildItemRow(item, () => removeItem(weekKey, idx));
        weekDiv.appendChild(row);
      });

      contentEl.appendChild(weekDiv);
    });
  });
}

function copyWeek(weekKey, btn) {
  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = 'Loading...';
  loadData(async (data) => {
    try {
      const items = data[weekKey] || [];
      if (!items.length) {
        toast('Nothing to copy');
        return;
      }
      const text = await buildWeekText(items);
      copyTextViaTextarea(rawEl, text);
      toast('Copied');
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

function clearWeek(weekKey) {
  if (!confirm(`Clear commits for week of ${weekKey}?`)) return;
  loadData((data) => {
    delete data[weekKey];
    saveData(data, render);
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
