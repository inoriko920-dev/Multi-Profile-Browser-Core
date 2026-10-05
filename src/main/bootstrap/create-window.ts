import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { FileLogger } from '../logging/file-logger';

export function createFoundationWindow(logger: FileLogger): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: '#f6f8fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
    logger.warn('navigation.blocked', { reason: 'STEP_00_LOCAL_ONLY' });
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  void window
    .loadFile(join(__dirname, '../../renderer/index.html'))
    .catch((error: unknown) => logger.error('renderer.load_failed', { error }));

  return window;
}
