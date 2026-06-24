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

// "WEB-123 some summary" -> "some summary"
function stripCaseKey(text, caseKey) {
  if (!text || !caseKey) return text || '';
  const re = new RegExp('^\\s*\\[?' + caseKey.replace('-', '\\-') + '\\]?\\s*');
  return text.replace(re, '').trim();
}

// JIRA rendered description is HTML. Convert it to compact plain text:
// replace attachment thumbnails/media with their file name, remove blank lines.
function htmlToCompactText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');

  doc.querySelectorAll('img, .image-wrap, .attachment-thumb, .mediaSingleView-content-wrap, [data-media-type], object, embed').forEach((el) => {
    const name = mediaName(el);
    el.replaceWith(doc.createTextNode(name ? `\n${name}\n` : ''));
  });

  doc.querySelectorAll('br').forEach((el) => el.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6, pre, blockquote').forEach((el) => {
    el.appendChild(doc.createTextNode('\n'));
  });

  const raw = doc.body ? doc.body.textContent || '' : '';
  return compactPlainText(raw);
}

// Best-effort attachment file name from a media/image element.
function mediaName(el) {
  const candidate =
    el.getAttribute('alt') ||
    el.getAttribute('title') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('data-file-name') ||
    el.getAttribute('data-filename') ||
    (el.textContent || '').trim();
  const name = (candidate || '').trim();
  return name && name.toLowerCase() !== 'image' ? name : '';
}

async function fetchSummaryAndDescription(caseKey) {
  const resp = await fetch(
    `${location.origin}/rest/api/2/issue/${caseKey}?fields=summary,description&expand=renderedFields`,
    { credentials: 'include', headers: { Accept: 'application/json' } }
  );
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const json = await resp.json();
  const fields = json && json.fields ? json.fields : {};
  const rendered = json && json.renderedFields ? json.renderedFields : {};
  const summary = fields.summary || '';

  // renderedFields gives HTML; fields.description may be ADF (object) or wiki text (string).
  let description = '';
  if (rendered.description) {
    description = htmlToCompactText(rendered.description);
  } else if (typeof fields.description === 'string') {
    description = compactPlainText(fields.description);
  } else if (fields.description && typeof fields.description === 'object') {
    description = compactPlainText(adfToText(fields.description));
  }
  return { summary, description };
}

function compactPlainText(text) {
  return (text || '')
    .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

// Minimal Atlassian Document Format -> text, skipping media/attachment nodes.
function adfToText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'media') {
    const name = node.attrs ? node.attrs.alt || node.attrs.title || '' : '';
    return name ? `\n${name}\n` : '';
  }
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';

  let out = '';
  if (Array.isArray(node.content)) {
    out = node.content.map(adfToText).join('');
  }
  const blockTypes = ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'tableRow'];
  if (blockTypes.includes(node.type)) out += '\n';
  return out;
}

// DOM fallback: read the description block rendered on the issue page.
function getDescriptionFromDom() {
  const selectors = [
    '[data-testid="issue.views.field.rich-text.description"]',
    '[data-testid$="description"] .ak-renderer-document',
    '.ak-renderer-document',
    '#description-val',
    '#descriptionmodule .mod-content'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim()) {
      return htmlToCompactText(el.innerHTML);
    }
  }
  return '';
}

// Builds the "Collect cursor agent message" payload.
async function getAgentMessage() {
  const caseKey = getCaseKeyFromUrl();
  if (!caseKey) return null;

  let summary = stripCaseKey(getCaseTitle(caseKey), caseKey);
  let description = '';
  try {
    const data = await fetchSummaryAndDescription(caseKey);
    if (data.summary) summary = data.summary.trim();
    description = data.description;
  } catch (e) {
    // Fall back to DOM scraping when the API is unavailable.
  }

  if (!description) {
    description = getDescriptionFromDom();
  }

  const text =
    `Requirement: ${summary}\n` +
    `Requirement Description:` +
    (description ? `\n${description}` : '');

  return { caseKey, text, url: location.origin + '/browse/' + caseKey };
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.request === 'GET_CASE_DATA') {
    sendResponse(getCaseData());
    return true;
  }
  if (msg && msg.request === 'GET_AGENT_MESSAGE') {
    getAgentMessage().then(sendResponse);
    return true;
  }
  return true;
});
