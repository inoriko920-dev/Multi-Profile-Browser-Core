import { app, BrowserWindow, type BrowserWindow as BrowserWindowType } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createFoundationWindow } from './bootstrap/create-window';
import { getFoundationInfo } from './bootstrap/runtime-info';
import { createBrowserController } from './browser/browser-controller';
import { runStep01Smoke } from './browser/step01-smoke';
import { PRIMARY_BROWSER_SURFACE_ID } from './ipc/browser-ipc';
import { FileLogger, normalizeError } from './logging/file-logger';
import { ShutdownState } from './recovery/shutdown-state';

const requestedUserDataPath = process.env.MPBC_USER_DATA_DIR;
if (requestedUserDataPath) {
  app.setPath('userData', requestedUserDataPath);
}

const isStep02CompatibilityMode = process.argv.includes('--step02');
const STEP02_INITIAL_URL = 'https://accounts.google.com/';

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

function createApplicationWindow(): BrowserWindowType {
  if (!logger) {
    throw new Error('Logger must be initialized before creating a window.');
  }

  const window = createFoundationWindow(logger);

  if (process.env.MPBC_SMOKE_TEST === '1') {
    window.webContents.once('did-finish-load', () => {
      logger?.info('app.smoke_test_pass');
      app.quit();
    });
    return window;
  }

  const controller = createBrowserController(window, logger);

  if (process.env.MPBC_STEP02_HARNESS_SMOKE === '1') {
    const finishHarnessSmoke = (): void => {
      try {
        if (!isStep02CompatibilityMode) {
          throw new Error('STEP 02 harness smoke requires --step02.');
        }

        const surfaceCount = controller.backend.getSurfaceCount();
        if (surfaceCount !== 1) {
          throw new Error(`Expected one browser surface, got ${surfaceCount}.`);
        }

        logger?.info('step02.harness_smoke_pass', {
          surfaceCount,
          remoteLoginAttempted: false,
        });
        controller.cleanup();
        app.quit();
      } catch (error) {
        controller.cleanup();
        exitAfterFatal('step02.harness_smoke_failed', error);
      }
    };

    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', finishHarnessSmoke);
    } else {
      queueMicrotask(finishHarnessSmoke);
    }

    return window;
  }

  if (process.env.MPBC_STEP01_SMOKE === '1') {
    void runStep01Smoke(window, controller.backend, logger)
      .then(() => {
        controller.cleanup();
        app.quit();
      })
      .catch((error: unknown) => {
        controller.cleanup();
        exitAfterFatal('step01.smoke_failed', error);
      });
    return window;
  }

  const initialUrl = isStep02CompatibilityMode ? STEP02_INITIAL_URL : 'https://example.com/';

  if (isStep02CompatibilityMode) {
    logger.info('step02.manual_compatibility_started', {
      initialUrl,
      sessionPersistence: 'memory-only',
      credentialAutomation: false,
    });
  }

  void controller.backend
    .navigate(PRIMARY_BROWSER_SURFACE_ID, initialUrl)
    .catch((error: unknown) => {
      logger?.warn('browser.initial_navigation_failed', {
        error: normalizeError(error),
      });
    });

  return window;
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
      mode: isStep02CompatibilityMode ? 'step02-manual-compatibility' : 'normal',
    });

    createApplicationWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createApplicationWindow();
      }
    });
  })
  .catch((error: unknown) => {
    exitAfterFatal('app.bootstrap_failed', error);
  });
