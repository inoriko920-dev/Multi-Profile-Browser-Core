import { app } from 'electron';
import type { FoundationInfo } from '../../shared/foundation-info';

export function getFoundationInfo(): FoundationInfo {
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node,
  };
}
