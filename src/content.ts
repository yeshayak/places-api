(() => {
  /**
   * Content Entrypoint: Acts as the bridge between the Extension context
   * and the P21 page context.
   */
  if (document.head.querySelector('meta[name="places-api-injected"]')) {
    // Already injected, exit
    return;
  }
  const meta = document.createElement('meta');
  meta.name = 'places-api-injected';
  meta.content = 'true';

  // Safety check for extension context
  if (chrome.runtime?.id) {
    meta.setAttribute('data-sandbox-url', chrome.runtime.getURL('sandbox.html'));

    // Pre-cache the API key in the DOM so injected scripts can access it without a message round-trip
    chrome.storage.local.get(['apiKey'], (result) => {
      if (chrome.runtime?.id && typeof result.apiKey === 'string' && result.apiKey.trim()) {
        meta.setAttribute('data-api-key', result.apiKey.trim());
      }
    });
  }
  document.head.appendChild(meta);

  let lastTransactionIdentity = '';

  const isContextValid = () => !!chrome.runtime?.id;

  const injectScript = (filePath: string, tag: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${filePath}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const node = document.getElementsByTagName(tag)[0];
      const script = document.createElement('script');
      script.setAttribute('type', 'module');
      script.setAttribute('src', filePath);

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${filePath}`));

      node.appendChild(script);
    });
  };

  window.addEventListener('message', (event) => {
    // Relax source check for compatibility with P21/Angular polyfills
    if (event.data?.type !== 'P21_EXT_REQUEST_API_KEY') return;
    if (!isContextValid()) return;

    const requestId = event.data.requestId;
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!isContextValid()) return;

      const apiKey = typeof result.apiKey === 'string' ? result.apiKey.trim() : '';
      window.postMessage(apiKey ? { type: 'P21_EXT_API_KEY_RESPONSE', requestId, apiKey } : { type: 'P21_EXT_API_KEY_RESPONSE', requestId, error: 'Google Maps API key not found in extension storage' }, '*');
    });
  });

  const ROUTER_CONFIG = {
    core: ['network-monitor.js', 'action-monitor.js', 'state-store.js', 'endpoint-router.js'],
  };

  /**
   * Dynamically derives the sheet script name from the P21 window URL.
   * Example: /window/w_order_entry_sheet -> w_order_entry_sheet.js
   */
  const getWindowScript = (url: string): string | null => {
    const match = url.match(/\/window\/(w_[a-z0-9_]+)/i);
    return match ? `${match[1]}.js` : null;
  };

  const handlePageContextChange = async (url: string, title?: string): Promise<void> => {
    // Own lifecycle management: Detect transaction identity changes
    if (title) {
      const isDebug = localStorage.getItem('p21ExtDebug') === 'true' || localStorage.getItem('p21ExtDebugFull') === 'true';
      if (isDebug) {
        console.debug('[P21 EXT] Lifecycle: Observed page title:', title);
      }

      const identity = title.trim();
      if (identity !== lastTransactionIdentity) {
        lastTransactionIdentity = identity;
        window.dispatchEvent(new CustomEvent('p21-ext:transaction-reset', { detail: { identity } }));
      }
    }

    const sheetScript = getWindowScript(url);
    if (!sheetScript || !isContextValid()) return;

    try {
      // Load core infrastructure once
      const scripts = [...ROUTER_CONFIG.core, sheetScript];
      for (const script of scripts) {
        if (isContextValid()) await injectScript(chrome.runtime.getURL(script), 'body');
      }
    } catch (error: any) {
      if (!error.message?.includes('context invalidated')) console.error(`[P21 EXT] Context injection failed for ${sheetScript}:`, error);
    }
  };

  handlePageContextChange(window.location.href, document.title);

  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => handlePageContextChange(window.location.href, document.title));
    titleObserver.observe(titleElement, { childList: true });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'P21_PAGE_CONTEXT_CHANGE') {
      handlePageContextChange(message.url, message.title);
    }
  });
})();
