import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvalidBrowserUrlError, normalizeBrowserUrl, safeUrlForLog } from '../../src/main/browser/url-policy';

test('normalizes host-like input to HTTPS', () => {
  assert.equal(normalizeBrowserUrl('example.com'), 'https://example.com/');
});

test('allows HTTP and HTTPS URLs', () => {
  assert.equal(normalizeBrowserUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1');
  assert.equal(normalizeBrowserUrl('http://example.com/'), 'http://example.com/');
});

test('rejects non-HTTP(S) schemes and empty input', () => {
  for (const input of ['javascript:alert(1)', 'file:///C:/Windows/System32', 'data:text/html,hello', '   ']) {
    assert.throws(() => normalizeBrowserUrl(input), InvalidBrowserUrlError);
  }
});

test('safeUrlForLog strips query and fragment', () => {
  assert.equal(
    safeUrlForLog('https://example.com/path?token=secret#private'),
    'https://example.com/path',
  );
});
