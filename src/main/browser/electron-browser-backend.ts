import { WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import type { BrowserBounds, BrowserState, BrowserSurfaceId } from '../../shared/browser-state';
import type { FileLogger } from '../logging/file-logger';
import type { BrowserBackend, BrowserStateListener } from './browser-backend';
import { InvalidBrowserUrlError, normalizeBrowserUrl, safeUrlForLog } from './url-policy';

type SurfaceRecord = {
  view: WebContentsView;
  state: BrowserState;
};

const STEP01_PARTITION = 'step01-browser-session';

function cloneState(state: BrowserState): BrowserState {
  return {
    ...state,
    lastError: state.lastError ? { ...state.lastError } : null,
  };
}

export class ElectronBrowserBackend implements BrowserBackend {
  private readonly surfaces = new Map<BrowserSurfaceId, SurfaceRecord>();
  private readonly listeners = new Set<BrowserStateListener>();

  public constructor(
    private readonly hostWindow: BrowserWindow,
    private readonly logger: FileLogger,
  ) {}

  public createSurface(surfaceId: BrowserSurfaceId, bounds: BrowserBounds): void {
    if (this.surfaces.has(surfaceId)) {
      throw new Error(`Browser surface already exists: ${surfaceId}`);
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: STEP01_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        webviewTag: false,
      },
    });

    const state: BrowserState = {
      surfaceId,
      url: '',
      title: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      lastError: null,
    };

    const record: SurfaceRecord = { view, state };
    this.surfaces.set(surfaceId, record);

    this.configureSecurity(surfaceId, view);
    this.configureEvents(surfaceId, record);
    this.hostWindow.contentView.addChildView(view);
    view.setBounds(bounds);

    this.logger.info('browser.surface_created', { surfaceId });
    this.emitState(surfaceId);
  }

  public setBounds(surfaceId: BrowserSurfaceId, bounds: BrowserBounds): void {
    this.requireSurface(surfaceId).view.setBounds(bounds);
  }

  public async navigate(surfaceId: BrowserSurfaceId, input: string): Promise<void> {
    const record = this.requireSurface(surfaceId);
    const url = normalizeBrowserUrl(input);

    record.state.lastError = null;
    this.logger.info('browser.navigation_requested', {
      surfaceId,
      url: safeUrlForLog(url),
    });

    try {
      await record.view.webContents.loadURL(url);
    } catch (error) {
      if (error instanceof InvalidBrowserUrlError) {
        throw error;
      }

      this.logger.warn('browser.navigation_rejected', {
        surfaceId,
        url: safeUrlForLog(url),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async goBack(surfaceId: BrowserSurfaceId): Promise<void> {
    const contents = this.requireSurface(surfaceId).view.webContents;
    if (!contents.navigationHistory.canGoBack()) {
      return;
    }

    await this.waitForNextLoad(contents, () => contents.navigationHistory.goBack());
  }

  public async goForward(surfaceId: BrowserSurfaceId): Promise<void> {
    const contents = this.requireSurface(surfaceId).view.webContents;
    if (!contents.navigationHistory.canGoForward()) {
      return;
    }

    await this.waitForNextLoad(contents, () => contents.navigationHistory.goForward());
  }

  public async reload(surfaceId: BrowserSurfaceId): Promise<void> {
    const contents = this.requireSurface(surfaceId).view.webContents;
    if (!contents.getURL()) {
      return;
    }

    await this.waitForNextLoad(contents, () => contents.reload());
  }

  public getState(surfaceId: BrowserSurfaceId): BrowserState {
    return cloneState(this.requireSurface(surfaceId).state);
  }

  public hasSurface(surfaceId: BrowserSurfaceId): boolean {
    return this.surfaces.has(surfaceId);
  }

  public getSurfaceCount(): number {
    return this.surfaces.size;
  }

  public destroySurface(surfaceId: BrowserSurfaceId): void {
    const record = this.surfaces.get(surfaceId);
    if (!record) {
      return;
    }

    this.surfaces.delete(surfaceId);
    this.hostWindow.contentView.removeChildView(record.view);

    if (!record.view.webContents.isDestroyed()) {
      record.view.webContents.close({ waitForBeforeUnload: false });
    }

    this.logger.info('browser.surface_destroyed', { surfaceId });
  }

  public destroyAll(): void {
    for (const surfaceId of [...this.surfaces.keys()]) {
      this.destroySurface(surfaceId);
    }
  }

  public onStateChanged(listener: BrowserStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private configureSecurity(surfaceId: BrowserSurfaceId, view: WebContentsView): void {
    const { webContents } = view;

    webContents.session.setPermissionCheckHandler(() => false);
    webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });

    webContents.setWindowOpenHandler(({ url }) => {
      try {
        const normalized = normalizeBrowserUrl(url);
        queueMicrotask(() => {
          void this.navigate(surfaceId, normalized).catch((error: unknown) => {
            this.logger.warn('browser.popup_navigation_failed', {
              surfaceId,
              url: safeUrlForLog(normalized),
              error: error instanceof Error ? error.message : String(error),
            });
          });
        });
      } catch {
        this.logger.warn('browser.popup_blocked', {
          surfaceId,
          url: safeUrlForLog(url),
        });
      }

      return { action: 'deny' };
    });

    webContents.on('will-navigate', (details) => {
      try {
        normalizeBrowserUrl(details.url);
      } catch {
        details.preventDefault();
        this.logger.warn('browser.navigation_blocked', {
          surfaceId,
          url: safeUrlForLog(details.url),
        });
      }
    });

    webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
      this.logger.warn('browser.webview_attach_blocked', { surfaceId });
    });
  }

  private configureEvents(surfaceId: BrowserSurfaceId, record: SurfaceRecord): void {
    const { webContents } = record.view;

    webContents.on('did-start-navigation', (details) => {
      if (!details.isMainFrame) {
        return;
      }

      record.state.isLoading = true;
      record.state.lastError = null;
      this.logger.info('browser.navigation_started', {
        surfaceId,
        url: safeUrlForLog(details.url),
      });
      this.refreshState(record);
      this.emitState(surfaceId);
    });

    webContents.on('did-navigate', (_event, url) => {
      record.state.url = url;
      record.state.lastError = null;
      this.refreshState(record);
      this.emitState(surfaceId);
    });

    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      record.state.url = url;
      this.refreshState(record);
      this.emitState(surfaceId);
    });

    webContents.on('page-title-updated', (_event, title) => {
      record.state.title = title;
      this.emitState(surfaceId);
    });

    webContents.on('did-finish-load', () => {
      record.state.isLoading = false;
      record.state.lastError = null;
      this.refreshState(record);
      this.logger.info('browser.navigation_completed', {
        surfaceId,
        url: safeUrlForLog(record.state.url),
      });
      this.emitState(surfaceId);
    });

    webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) {
          return;
        }

        record.state.isLoading = false;
        record.state.lastError = {
          code: errorCode,
          description: errorDescription,
          url: safeUrlForLog(validatedURL),
        };
        this.refreshState(record);
        this.logger.warn('browser.navigation_failed', {
          surfaceId,
          errorCode,
          errorDescription,
          url: safeUrlForLog(validatedURL),
        });
        this.emitState(surfaceId);
      },
    );

    webContents.on('render-process-gone', (_event, details) => {
      record.state.isLoading = false;
      record.state.lastError = {
        code: details.exitCode,
        description: `Renderer process gone: ${details.reason}`,
        url: safeUrlForLog(webContents.getURL()),
      };
      this.logger.error('browser.renderer_gone', {
        surfaceId,
        reason: details.reason,
        exitCode: details.exitCode,
      });
      this.emitState(surfaceId);
    });
  }

  private refreshState(record: SurfaceRecord): void {
    const { webContents } = record.view;
    if (webContents.isDestroyed()) {
      return;
    }

    record.state.url = webContents.getURL();
    record.state.title = webContents.getTitle();
    record.state.canGoBack = webContents.navigationHistory.canGoBack();
    record.state.canGoForward = webContents.navigationHistory.canGoForward();
  }

  private emitState(surfaceId: BrowserSurfaceId): void {
    const state = this.getState(surfaceId);
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private requireSurface(surfaceId: BrowserSurfaceId): SurfaceRecord {
    const record = this.surfaces.get(surfaceId);
    if (!record) {
      throw new Error(`Unknown browser surface: ${surfaceId}`);
    }

    return record;
  }

  private waitForNextLoad(contents: WebContents, action: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        contents.removeListener('did-finish-load', handleFinish);
        contents.removeListener('did-fail-load', handleFail);
      };

      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        callback();
      };

      const handleFinish = (): void => finish(resolve);
      const handleFail = (
        _event: Electron.Event,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean,
      ): void => {
        if (!isMainFrame || errorCode === -3) {
          return;
        }

        finish(() => reject(new Error(`${errorDescription} (${errorCode}) ${validatedURL}`)));
      };

      contents.once('did-finish-load', handleFinish);
      contents.on('did-fail-load', handleFail);

      try {
        action();
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }
}
