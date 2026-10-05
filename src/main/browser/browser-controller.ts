import type { BrowserWindow } from 'electron';
import type { FileLogger } from '../logging/file-logger';
import { registerBrowserIpc, PRIMARY_BROWSER_SURFACE_ID } from '../ipc/browser-ipc';
import { calculateBrowserBounds } from './browser-layout';
import { ElectronBrowserBackend } from './electron-browser-backend';

export type BrowserController = {
  backend: ElectronBrowserBackend;
  cleanup: () => void;
};

export function createBrowserController(
  shellWindow: BrowserWindow,
  logger: FileLogger,
): BrowserController {
  const backend = new ElectronBrowserBackend(shellWindow, logger);

  const applyBounds = (): void => {
    if (shellWindow.isDestroyed() || !backend.hasSurface(PRIMARY_BROWSER_SURFACE_ID)) {
      return;
    }

    const bounds = shellWindow.getContentBounds();
    backend.setBounds(
      PRIMARY_BROWSER_SURFACE_ID,
      calculateBrowserBounds(bounds.width, bounds.height),
    );
  };

  const contentBounds = shellWindow.getContentBounds();
  backend.createSurface(
    PRIMARY_BROWSER_SURFACE_ID,
    calculateBrowserBounds(contentBounds.width, contentBounds.height),
  );

  const unregisterIpc = registerBrowserIpc(shellWindow, backend, logger);
  shellWindow.on('resize', applyBounds);

  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    shellWindow.removeListener('resize', applyBounds);
    unregisterIpc();
    backend.destroyAll();
    logger.info('browser.controller_destroyed');
  };

  shellWindow.once('closed', cleanup);

  return { backend, cleanup };
}
