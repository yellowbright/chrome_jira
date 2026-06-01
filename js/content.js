function getCaseKeyFromUrl() {
  const m = location.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/);
  return m ? m[1] : null;
}

function getCaseTitle(caseKey) {
  // JIRA puts "KEY summary - Jira" in the document title on the issue page.
  let title = document.title
    .replace(/\s*-\s*Jira\s*$/i, '')
    .replace(/\s*-\s*JIRA\s*$/i, '')
    .trim();

  if (title && (!caseKey || title.indexOf(caseKey) !== -1)) {
    return title;
  }

  // Fallback: build from the page's H1 summary.
  const h1 = document.querySelector('[data-testid$="heading"] h1, h1');
  const summary = h1 ? h1.innerText.trim() : '';
  if (caseKey && summary) return `${caseKey} ${summary}`;
  return summary || caseKey || '';
}

function getCaseData() {
  const caseKey = getCaseKeyFromUrl();
  if (!caseKey) return null;

  const commit = getCaseTitle(caseKey);
  if (!commit) return null;

  return {
    caseKey: caseKey,
    gitCommitString: commit,
    url: location.origin + '/browse/' + caseKey
  };
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.request === 'GET_CASE_DATA') {
    sendResponse(getCaseData());
  }
  return true;
});
