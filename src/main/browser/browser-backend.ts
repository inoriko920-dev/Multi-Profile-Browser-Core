import type { BrowserBounds, BrowserState, BrowserSurfaceId } from '../../shared/browser-state';

export type BrowserStateListener = (state: BrowserState) => void;

export interface BrowserBackend {
  createSurface(surfaceId: BrowserSurfaceId, bounds: BrowserBounds): void;
  setBounds(surfaceId: BrowserSurfaceId, bounds: BrowserBounds): void;
  navigate(surfaceId: BrowserSurfaceId, input: string): Promise<void>;
  goBack(surfaceId: BrowserSurfaceId): Promise<void>;
  goForward(surfaceId: BrowserSurfaceId): Promise<void>;
  reload(surfaceId: BrowserSurfaceId): Promise<void>;
  getState(surfaceId: BrowserSurfaceId): BrowserState;
  hasSurface(surfaceId: BrowserSurfaceId): boolean;
  getSurfaceCount(): number;
  destroySurface(surfaceId: BrowserSurfaceId): void;
  destroyAll(): void;
  onStateChanged(listener: BrowserStateListener): () => void;
}
