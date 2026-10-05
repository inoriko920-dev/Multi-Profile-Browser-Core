export type BrowserSurfaceId = string;

export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserNavigationError = {
  code: number | string;
  description: string;
  url: string;
};

export type BrowserState = {
  surfaceId: BrowserSurfaceId;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  lastError: BrowserNavigationError | null;
};
