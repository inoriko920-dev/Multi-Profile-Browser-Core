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

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required browser toolbar element is missing: ${selector}`);
  }

  return element;
}

const backButton = requireElement<HTMLButtonElement>('#back');
const forwardButton = requireElement<HTMLButtonElement>('#forward');
const reloadButton = requireElement<HTMLButtonElement>('#reload');
const form = requireElement<HTMLFormElement>('#navigation-form');
const addressInput = requireElement<HTMLInputElement>('#address');
const status = requireElement<HTMLDivElement>('#status');
const quickTargets = [...document.querySelectorAll<HTMLButtonElement>('[data-step02-url]')];

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function renderQuickTargetState(currentUrl: string): void {
  const currentHost = hostOf(currentUrl);

  for (const button of quickTargets) {
    const targetUrl = button.dataset.step02Url ?? '';
    button.dataset.active = String(Boolean(currentHost) && hostOf(targetUrl) === currentHost);
  }
}

function renderState(state: BrowserState): void {
  backButton.disabled = !state.canGoBack || state.isLoading;
  forwardButton.disabled = !state.canGoForward || state.isLoading;
  reloadButton.disabled = !state.url;

  if (document.activeElement !== addressInput && state.url) {
    addressInput.value = state.url;
  }

  renderQuickTargetState(state.url);

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

for (const button of quickTargets) {
  button.addEventListener('click', () => {
    const targetUrl = button.dataset.step02Url;
    if (!targetUrl) {
      showActionError(new Error('Target STEP 02 tidak valid.'));
      return;
    }

    void window.foundation.browser.navigate(targetUrl).catch(showActionError);
  });
}

window.foundation.browser.onStateChanged(renderState);
void window.foundation.browser.getState().then(renderState).catch(showActionError);
