import type { BrowserState } from '../shared/browser-state';

type FoundationBrowserApi = {
  navigate: (url: string) => Promise<void>;
  back: () => Promise<void>;
  forward: () => Promise<void>;
  reload: () => Promise<void>;
  getState: () => Promise<BrowserState>;
  onStateChanged: (callback: (state: BrowserState) => void) => void;
};

type FoundationApi = {
  platform: NodeJS.Platform;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  browser: FoundationBrowserApi;
};

declare global {
  interface Window {
    foundation: FoundationApi;
  }
}

const backButton = document.querySelector<HTMLButtonElement>('#back');
const forwardButton = document.querySelector<HTMLButtonElement>('#forward');
const reloadButton = document.querySelector<HTMLButtonElement>('#reload');
const form = document.querySelector<HTMLFormElement>('#navigation-form');
const addressInput = document.querySelector<HTMLInputElement>('#address');
const status = document.querySelector<HTMLDivElement>('#status');

if (!backButton || !forwardButton || !reloadButton || !form || !addressInput || !status) {
  throw new Error('Browser toolbar elements are missing.');
}

function renderState(state: BrowserState): void {
  backButton.disabled = !state.canGoBack || state.isLoading;
  forwardButton.disabled = !state.canGoForward || state.isLoading;
  reloadButton.disabled = !state.url;

  if (document.activeElement !== addressInput && state.url) {
    addressInput.value = state.url;
  }

  if (state.lastError) {
    status.textContent = 'Gagal memuat';
    status.dataset.error = 'true';
  } else if (state.isLoading) {
    status.textContent = 'Memuat…';
    status.dataset.error = 'false';
  } else {
    status.textContent = 'Siap';
    status.dataset.error = 'false';
  }

  document.title = state.title ? `${state.title} · Multi-Profile Browser Core` : 'Multi-Profile Browser Core';
}

function showActionError(error: unknown): void {
  status.textContent = error instanceof Error ? error.message : 'Operasi gagal';
  status.dataset.error = 'true';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = addressInput.value;
  void window.foundation.browser.navigate(input).catch(showActionError);
});

backButton.addEventListener('click', () => {
  void window.foundation.browser.back().catch(showActionError);
});

forwardButton.addEventListener('click', () => {
  void window.foundation.browser.forward().catch(showActionError);
});

reloadButton.addEventListener('click', () => {
  void window.foundation.browser.reload().catch(showActionError);
});

window.foundation.browser.onStateChanged(renderState);
void window.foundation.browser.getState().then(renderState).catch(showActionError);
