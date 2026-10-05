import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('foundation', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node,
  },
});
