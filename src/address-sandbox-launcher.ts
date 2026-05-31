import { updateAddressFields } from './p21-data-endpoint';
import type { P21AddressUpdateValue } from './types/p21-types';

/**
 * Styles for the sandboxed UI
 */
const styles = `
  .p21-sandbox-launcher {
    cursor: pointer;
    position: absolute;
    z-index: 100;
    border: none;
    background: transparent;
    padding: 0;
    border-radius: 4px;
    box-shadow: none;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .p21-sandbox-launcher:hover { transform: scale(1.1); }
  .p21-sandbox-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.2);
    display: flex; justify-content: center; align-items: center;
    z-index: 20000;
  }
  .p21-sandbox-modal {
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    width: 500px;
    max-width: 95%;
    height: 450px;
    border: 1px solid #ddd;
    display: flex;
    flex-direction: column;
  }
  .p21-sandbox-header {
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .p21-sandbox-close {
    cursor: pointer;
    font-size: 24px;
    color: #999;
  }
  .p21-sandbox-iframe {
    flex: 1;
    border: none;
    width: 100%;
  }
`;

const getApiKey = (): Promise<string> => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Optimization: Check if the key was already embedded in the meta tag for synchronous retrieval
  const meta = document.querySelector('meta[name="places-api-injected"]');
  const embeddedKey = meta?.getAttribute('data-api-key');
  if (embeddedKey) return Promise.resolve(embeddedKey);

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('Timed out waiting for API key from extension storage'));
    }, 3000);

    function handleResponse(event: MessageEvent) {
      // Relax source check for P21 compatibility; identify via type and requestId
      if (!event.data || event.data.type !== 'P21_EXT_API_KEY_RESPONSE' || event.data.requestId !== requestId) return;

      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleResponse);

      if (typeof event.data.apiKey === 'string' && event.data.apiKey.trim()) {
        resolve(event.data.apiKey.trim());
      } else {
        reject(new Error(event.data.error || 'Google Maps API key not found in extension storage'));
      }
    }

    window.addEventListener('message', handleResponse);
    window.postMessage({ type: 'P21_EXT_REQUEST_API_KEY', requestId }, '*');
  });
};

/**
 * Attaches a Google Map marker button next to the specified input.
 */
export const attachSandboxLauncher = (input: HTMLInputElement, containerSelector: string, includeName: boolean, getValue?: () => string) => {
  if (!input || !input.isConnected || input.dataset.sandboxAttached) return;

  if (!document.getElementById('p21-sandbox-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'p21-sandbox-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  const btn = document.createElement('button');
  btn.className = 'p21-sandbox-launcher';
  btn.type = 'button';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="width: 16px; height: 16px;">
      <path fill="#CC3C25" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
    </svg>`;
  btn.title = 'Open Sandboxed Address Search';

  // Position the button specifically relative to the input's vertical center
  const alignButton = () => {
    if (!input.isConnected) {
      cleanup();
      return;
    }

    // P21 uses absolute positioning on inputs relative to DataWindow containers.
    // We place the button as a sibling using the same coordinate system
    // to ensure zero interference with the input's own box model or flow.
    const btnSize = input.offsetHeight;
    const overlap = 1; // Pixels to tuck the icon inside the right border

    btn.style.height = `${btnSize}px`;
    btn.style.width = `${btnSize}px`;
    btn.style.top = `${input.offsetTop}px`;
    btn.style.left = `${input.offsetLeft + input.offsetWidth - btnSize - overlap}px`;
  };

  let observer: MutationObserver | null = null;
  const cleanup = () => {
    window.removeEventListener('resize', alignButton);
    observer?.disconnect();
    observer = null;
    btn.remove();
  };

  console.log('[P21 EXT] Initiating attachment for:', input);

  input.after(btn);
  alignButton();
  input.dataset.sandboxAttached = 'true';

  // Handle potential P21 layout shifts
  window.addEventListener('resize', alignButton);

  // Use MutationObserver to track Prophet 21's dynamic positioning changes (ng-style)
  // and keep the button locked to the input field's edge.
  observer = new MutationObserver(alignButton);
  observer.observe(input, { attributes: true, attributeFilter: ['style', 'class'] });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSandbox(containerSelector, includeName, getValue ? getValue() : input.value);
  });
};

export const openSandbox = async (containerSelector: string, includeName: boolean, initialValue: string = '') => {
  // Prevent multiple modals from opening simultaneously
  if (document.querySelector('.p21-sandbox-overlay')) return;

  const meta = document.querySelector('meta[name="places-api-injected"]');
  const sandboxUrl = meta?.getAttribute('data-sandbox-url');

  if (!sandboxUrl) {
    console.error('[P21 EXT] Sandbox URL not found. Ensure content script injected it correctly.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'p21-sandbox-overlay';
  overlay.innerHTML = `
    <div class="p21-sandbox-modal">
      <div class="p21-sandbox-header">
        <span style="font-family: sans-serif; font-size: 14px; font-weight: bold; color: #333;">Google Address Search</span>
        <span class="p21-sandbox-close">&times;</span>
      </div>
      <div class="p21-iframe-container" style="flex: 1; display: flex;"></div>
      <p style="font-size: 10px; color: #999; margin: 8px 0 0 0;">Secure extension sandbox mode active.</p>
    </div>
  `;

  // Listen for the selection message from the iframe
  const messageHandler = async (event: MessageEvent) => {
    if (event.data?.type === 'P21_PLACE_SELECTED') {
      window.removeEventListener('message', messageHandler);
      const place = event.data.place as P21AddressUpdateValue;

      console.log('[P21 EXT] Received selection from sandbox:', place);
      await updateAddressFields(containerSelector, place, includeName);
      close();
    }
  };

  window.addEventListener('message', messageHandler);

  document.body.appendChild(overlay);
  const close = () => {
    window.removeEventListener('message', messageHandler);
    document.body.removeChild(overlay);
  };

  const iframeContainer = overlay.querySelector('.p21-iframe-container');
  const iframe = document.createElement('iframe');
  iframe.className = 'p21-sandbox-iframe';
  iframe.onload = () => {
    getApiKey()
      .then((apiKey) => {
        // We remove iframe.focus() to avoid "Blocked autofocusing" warnings in cross-origin frames.
        // The user will interact with the search box directly.
        iframe.contentWindow?.postMessage({ type: 'INIT_SANDBOX', apiKey, initialValue }, '*');
      })
      .catch((error) => {
        console.error('[P21 EXT] Failed to load Google Maps API key:', error);
        close();
      });
  };
  iframe.src = sandboxUrl;
  iframeContainer?.appendChild(iframe);

  overlay.querySelector('.p21-sandbox-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
};
