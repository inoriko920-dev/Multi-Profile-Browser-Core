import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { BrowserBackend } from '../browser/browser-backend';
import type { FileLogger } from '../logging/file-logger';

export const PRIMARY_BROWSER_SURFACE_ID = 'primary';

function assertTrustedShell(event: IpcMainInvokeEvent, shellWindow: BrowserWindow): void {
  if (event.sender.id !== shellWindow.webContents.id) {
    throw new Error('Untrusted IPC sender.');
  }
}

export function registerBrowserIpc(
  shellWindow: BrowserWindow,
  backend: BrowserBackend,
  logger: FileLogger,
): () => void {
  const invoke = <TArgs extends unknown[], TResult>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult | Promise<TResult>,
  ): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertTrustedShell(event, shellWindow);
      return handler(event, ...(args as TArgs));
    });
  };

  invoke<[string], void>(IPC_CHANNELS.browserNavigate, async (_event, input) => {
    if (typeof input !== 'string' || input.length > 4096) {
      throw new Error('Invalid URL input.');
    }

    await backend.navigate(PRIMARY_BROWSER_SURFACE_ID, input);
  });

  invoke<[], void>(IPC_CHANNELS.browserBack, async () => {
    await backend.goBack(PRIMARY_BROWSER_SURFACE_ID);
  });

  invoke<[], void>(IPC_CHANNELS.browserForward, async () => {
    await backend.goForward(PRIMARY_BROWSER_SURFACE_ID);
  });

  invoke<[], void>(IPC_CHANNELS.browserReload, async () => {
    await backend.reload(PRIMARY_BROWSER_SURFACE_ID);
  });

  invoke<[], ReturnType<BrowserBackend['getState']>>(IPC_CHANNELS.browserGetState, () =>
    backend.getState(PRIMARY_BROWSER_SURFACE_ID),
  );

  const unsubscribeState = backend.onStateChanged((state) => {
    if (!shellWindow.isDestroyed() && !shellWindow.webContents.isDestroyed()) {
      shellWindow.webContents.send(IPC_CHANNELS.browserStateChanged, state);
    }
  });

  logger.info('browser.ipc_registered');

  return () => {
    unsubscribeState();
    ipcMain.removeHandler(IPC_CHANNELS.browserNavigate);
    ipcMain.removeHandler(IPC_CHANNELS.browserBack);
    ipcMain.removeHandler(IPC_CHANNELS.browserForward);
    ipcMain.removeHandler(IPC_CHANNELS.browserReload);
    ipcMain.removeHandler(IPC_CHANNELS.browserGetState);
    logger.info('browser.ipc_unregistered');
  };
}
