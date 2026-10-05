import assert from 'node:assert/strict';
import type { BrowserWindow } from 'electron';
import type { FileLogger } from '../logging/file-logger';
import { PRIMARY_BROWSER_SURFACE_ID } from '../ipc/browser-ipc';
import { calculateBrowserBounds } from './browser-layout';
import type { BrowserBackend } from './browser-backend';
import { InvalidBrowserUrlError } from './url-policy';

export async function runStep01Smoke(
  shellWindow: BrowserWindow,
  backend: BrowserBackend,
  logger: FileLogger,
): Promise<void> {
  logger.info('step01.smoke_started');

  await backend.navigate(PRIMARY_BROWSER_SURFACE_ID, 'https://example.com/');
  assert.equal(new URL(backend.getState(PRIMARY_BROWSER_SURFACE_ID).url).hostname, 'example.com');

  await backend.navigate(PRIMARY_BROWSER_SURFACE_ID, 'https://example.org/');
  let state = backend.getState(PRIMARY_BROWSER_SURFACE_ID);
  assert.equal(new URL(state.url).hostname, 'example.org');
  assert.equal(state.canGoBack, true);

  await backend.goBack(PRIMARY_BROWSER_SURFACE_ID);
  state = backend.getState(PRIMARY_BROWSER_SURFACE_ID);
  assert.equal(new URL(state.url).hostname, 'example.com');
  assert.equal(state.canGoForward, true);

  await backend.goForward(PRIMARY_BROWSER_SURFACE_ID);
  state = backend.getState(PRIMARY_BROWSER_SURFACE_ID);
  assert.equal(new URL(state.url).hostname, 'example.org');

  await backend.reload(PRIMARY_BROWSER_SURFACE_ID);
  assert.equal(new URL(backend.getState(PRIMARY_BROWSER_SURFACE_ID).url).hostname, 'example.org');

  let invalidSchemeRejected = false;
  try {
    await backend.navigate(PRIMARY_BROWSER_SURFACE_ID, 'javascript:alert(1)');
  } catch (error) {
    invalidSchemeRejected = error instanceof InvalidBrowserUrlError;
  }
  assert.equal(invalidSchemeRejected, true);

  let unavailableUrlRejected = false;
  try {
    await backend.navigate(PRIMARY_BROWSER_SURFACE_ID, 'http://127.0.0.1:9/');
  } catch {
    unavailableUrlRejected = true;
  }
  assert.equal(unavailableUrlRejected, true);
  assert.equal(backend.hasSurface(PRIMARY_BROWSER_SURFACE_ID), true);

  backend.destroySurface(PRIMARY_BROWSER_SURFACE_ID);
  assert.equal(backend.getSurfaceCount(), 0);

  const contentBounds = shellWindow.getContentBounds();
  const bounds = calculateBrowserBounds(contentBounds.width, contentBounds.height);
  for (let index = 0; index < 5; index += 1) {
    const surfaceId = `cleanup-${index}`;
    backend.createSurface(surfaceId, bounds);
    assert.equal(backend.hasSurface(surfaceId), true);
    backend.destroySurface(surfaceId);
    assert.equal(backend.hasSurface(surfaceId), false);
  }

  assert.equal(backend.getSurfaceCount(), 0);
  logger.info('step01.smoke_passed');
}
