import type { BrowserBounds } from '../../shared/browser-state';

export const BROWSER_TOOLBAR_HEIGHT = 76;

export function calculateBrowserBounds(
  contentWidth: number,
  contentHeight: number,
  toolbarHeight = BROWSER_TOOLBAR_HEIGHT,
): BrowserBounds {
  return {
    x: 0,
    y: toolbarHeight,
    width: Math.max(0, Math.floor(contentWidth)),
    height: Math.max(0, Math.floor(contentHeight - toolbarHeight)),
  };
}
