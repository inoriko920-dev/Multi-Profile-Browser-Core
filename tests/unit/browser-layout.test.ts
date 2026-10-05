import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BROWSER_TOOLBAR_HEIGHT, calculateBrowserBounds } from '../../src/main/browser/browser-layout';

test('places browser surface below the local toolbar', () => {
  assert.deepEqual(calculateBrowserBounds(1200, 800), {
    x: 0,
    y: BROWSER_TOOLBAR_HEIGHT,
    width: 1200,
    height: 682,
  });
});

test('never returns negative browser dimensions', () => {
  assert.deepEqual(calculateBrowserBounds(-20, 40), {
    x: 0,
    y: BROWSER_TOOLBAR_HEIGHT,
    width: 0,
    height: 0,
  });
});
