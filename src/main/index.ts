import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createFoundationWindow } from './bootstrap/create-window';
import { getFoundationInfo } from './bootstrap/runtime-info';
import { FileLogger, normalizeError } from './logging/file-logger';
import { ShutdownState } from './recovery/shutdown-state';

let logger: FileLogger | null = null;
let shutdownState: ShutdownState | null = null;
let cleanShutdownWritten = false;

function writeCleanShutdown(): void {
  if (cleanShutdownWritten) {
    return;
  }

  cleanShutdownWritten = true;

  try {
    shutdownState?.markClean();
    logger?.info('app.clean_shutdown');
  } catch (error) {
    logger?.error('app.clean_shutdown_failed', { error: normalizeError(error) });
  }
}

function exitAfterFatal(event: string, error: unknown): void {
  try {
    logger?.error(event, { error: normalizeError(error) });
  } finally {
    app.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  exitAfterFatal('process.uncaught_exception', error);
});

process.on('unhandledRejection', (reason) => {
  exitAfterFatal('process.unhandled_rejection', reason);
});

app.on('before-quit', writeCleanShutdown);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void app
  .whenReady()
  .then(() => {
    const userDataPath = app.getPath('userData');
    logger = new FileLogger(join(userDataPath, 'logs'));
    shutdownState = new ShutdownState(join(userDataPath, 'runtime', 'shutdown-state.json'));

    const previousRun = shutdownState.inspectPreviousRun();
    const sessionId = randomUUID();
    shutdownState.markRunning(sessionId);

    logger.info('app.start', {
      sessionId,
      previousRun,
      runtime: getFoundationInfo(),
    });

    const window = createFoundationWindow(logger);

    if (process.env.MPBC_SMOKE_TEST === '1') {
      window.webContents.once('did-finish-load', () => {
        logger?.info('app.smoke_test_pass');
        app.quit();
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && logger) {
        createFoundationWindow(logger);
      }
    });
  })
  .catch((error: unknown) => {
    exitAfterFatal('app.bootstrap_failed', error);
  });
