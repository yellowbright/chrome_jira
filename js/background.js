const MENU_ID = 'COLLECT_COMMIT';
const STORAGE_KEY = 'weeklyCommits';

const URL_PATTERNS = ['*://*.atlassian.net/browse/*'];

chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Collect GIT commit message',
      contexts: ['all'],
      documentUrlPatterns: URL_PATTERNS
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || !tab.id) return;
  requestCaseData(tab.id, false);
});

function requestCaseData(tabId, isRetry) {
  chrome.tabs.sendMessage(tabId, { request: 'GET_CASE_DATA' }, (caseObj) => {
    if (chrome.runtime.lastError) {
      // Content script not present yet (page opened before install / not injected).
      if (!isRetry) {
        chrome.scripting.executeScript(
          { target: { tabId }, files: ['js/content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              notify('Error', 'Cannot access this page. Open a JIRA case page and try again.');
              return;
            }
            requestCaseData(tabId, true);
          }
        );
      } else {
        notify('Error', 'No case data found. Try reloading the page.');
      }
      return;
    }
    if (!caseObj) {
      notify('Error', 'No case data found. Open a JIRA case (/browse/KEY) page.');
      return;
    }
    handleCollect(caseObj, tabId);
  });
}

// Monday as the first day of the week (ISO). Returns YYYY-MM-DD.
function getWeekStartKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Match shared.js formatLinePlain: "[KEY] title"
function formatCommitLine(caseKey, commit) {
  const re = new RegExp('^\\s*\\[?' + caseKey.replace('-', '\\-') + '\\]?\\s*');
  const title = commit.replace(re, '').trim();
  return `[${caseKey}] ${title}`;
}

function handleCollect(caseObj, tabId) {
  const weekKey = getWeekStartKey(new Date());
  const line = formatCommitLine(caseObj.caseKey, caseObj.gitCommitString);

  chrome.storage.local.get({ [STORAGE_KEY]: {} }, (res) => {
    const data = res[STORAGE_KEY] || {};
    const week = data[weekKey] || [];

    const exists = week.some((item) => item.caseKey === caseObj.caseKey);
    if (exists) {
      copyToClipboard(tabId, line);
      notify('Already added', `${caseObj.caseKey} is already in this week's list. Copied to clipboard.`);
      return;
    }

    week.push({
      caseKey: caseObj.caseKey,
      commit: caseObj.gitCommitString,
      url: caseObj.url,
      addedAt: Date.now()
    });
    data[weekKey] = week;

    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      copyToClipboard(tabId, line);
      notify('Collected', line);
    });
  });
}

function copyToClipboard(tabId, text) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (str) => {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    },
    args: [text]
  });
}

let notificationTimeout = null;
function notify(title, message) {
  const id = 'commit-collector';
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: '/img/icon-128.png',
    title,
    message,
    priority: 1
  });
  if (notificationTimeout) clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => chrome.notifications.clear(id), 3000);
}

createMenu();
