const test = require('node:test');
const assert = require('node:assert');

// Re-implement / import pure utility functions for isolated testing

function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'https://chromewebstore.google.com'
  ];
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPanText(val, isMono) {
  if (isMono) return 'Mono Mode';
  if (val === 0) return 'Center';
  if (val < 0) {
    return val === -1 ? 'Left Only' : `L ${Math.round(Math.abs(val) * 100)}%`;
  }
  return val === 1 ? 'Right Only' : `R ${Math.round(val * 100)}%`;
}

test('isRestrictedUrl - correctly identifies protected Chrome URLs', () => {
  assert.strictEqual(isRestrictedUrl('chrome://extensions'), true);
  assert.strictEqual(isRestrictedUrl('chrome-extension://abcdef/popup.html'), true);
  assert.strictEqual(isRestrictedUrl('edge://settings'), true);
  assert.strictEqual(isRestrictedUrl('about:blank'), true);
  assert.strictEqual(isRestrictedUrl('https://chromewebstore.google.com/detail/123'), true);
  assert.strictEqual(isRestrictedUrl(null), true);
  assert.strictEqual(isRestrictedUrl(''), true);
});

test('isRestrictedUrl - allows standard web pages', () => {
  assert.strictEqual(isRestrictedUrl('https://www.youtube.com/watch?v=123'), false);
  assert.strictEqual(isRestrictedUrl('https://open.spotify.com'), false);
  assert.strictEqual(isRestrictedUrl('http://localhost:3000'), false);
});

test('escapeHtml - prevents XSS injection', () => {
  const dangerousStr = '<script>alert("xss")</script> & \'test\'';
  const sanitized = escapeHtml(dangerousStr);
  assert.strictEqual(sanitized, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;test&#039;');
  assert.strictEqual(escapeHtml(''), '');
  assert.strictEqual(escapeHtml(null), '');
});

test('formatPanText - correctly formats pan and mono labels', () => {
  assert.strictEqual(formatPanText(0, false), 'Center');
  assert.strictEqual(formatPanText(-1, false), 'Left Only');
  assert.strictEqual(formatPanText(1, false), 'Right Only');
  assert.strictEqual(formatPanText(-0.5, false), 'L 50%');
  assert.strictEqual(formatPanText(0.75, false), 'R 75%');
  assert.strictEqual(formatPanText(-0.5, true), 'Mono Mode');
  assert.strictEqual(formatPanText(0, true), 'Mono Mode');
});
