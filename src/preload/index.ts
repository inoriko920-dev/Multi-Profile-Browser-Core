import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserState } from '../shared/browser-state';

const IPC_CHANNELS = {
  browserNavigate: 'browser:navigate',
  browserBack: 'browser:back',
  browserForward: 'browser:forward',
  browserReload: 'browser:reload',
  browserGetState: 'browser:get-state',
  browserStateChanged: 'browser:state-changed',
} as const;

const browserApi = {
  navigate: (url: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.browserNavigate, url),
  back: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.browserBack),
  forward: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.browserForward),
  reload: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.browserReload),
  getState: (): Promise<BrowserState> => ipcRenderer.invoke(IPC_CHANNELS.browserGetState),
  onStateChanged: (callback: (state: BrowserState) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.browserStateChanged, (_event, state: BrowserState) => {
      callback(state);
    });
  },
};

contextBridge.exposeInMainWorld('foundation', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node,
  },
  browser: browserApi,
});
