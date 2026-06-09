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

    // Pre-cache settings in the DOM for synchronous retrieval by injected modules
    chrome.storage.local.get(['apiKey', 'feat_address', 'feat_payment', 'feat_cost'], (result) => {
      if (!chrome.runtime?.id) return;
      if (result.apiKey) meta.setAttribute('data-api-key', result.apiKey.trim());

      // Map feature flags to data attributes
      meta.setAttribute('data-feat-address', String(result.feat_address !== false));
      meta.setAttribute('data-feat-payment', String(result.feat_payment !== false));
      meta.setAttribute('data-feat-cost', String(result.feat_cost !== false));
    });
  }
  document.head.appendChild(meta);

  // Watch for storage changes to update feature flags in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const keys = ['apiKey', 'feat_address', 'feat_payment', 'feat_cost'];
    keys.forEach((key) => {
      if (changes[key]) {
        const attrName = key === 'apiKey' ? 'data-api-key' : `data-${key.replace('_', '-')}`;
        const newValue = changes[key].newValue;
        if (newValue !== undefined) {
          meta.setAttribute(attrName, String(newValue));
        }
      }
    });
  });

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
    core: ['network-monitor.js', 'dom-monitor.js', 'state-store.js', 'feature-router.js'],
  };

  /**
   * Dynamically derives the sheet script name from the P21 window URL.
   * Example: /window/w_order_entry_sheet -> w_order_entry_sheet.js
   */
  const getWindowScript = (url: string): string | null => {
    const match = url.match(/\/window\/(w_[a-z0-9_]+)/i);
    return match ? `${match[1]}.js` : null;
  };

  const handlePageContextChange = async (title?: string, url?: string): Promise<void> => {
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

    try {
      for (const script of ROUTER_CONFIG.core) {
        if (isContextValid()) await injectScript(chrome.runtime.getURL(script), 'body');
      }

      // Inject window-specific script
      const windowScript = getWindowScript(url || window.location.href);
      if (windowScript && isContextValid()) {
        await injectScript(chrome.runtime.getURL(windowScript), 'body');
      }
    } catch (error: any) {
      if (!error.message?.includes('context invalidated')) console.error(`[P21 EXT] Core injection failed:`, error);
    }
  };

  handlePageContextChange(document.title, window.location.href);

  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => handlePageContextChange(document.title, window.location.href));
    titleObserver.observe(titleElement, { childList: true });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'P21_PAGE_CONTEXT_CHANGE') {
      handlePageContextChange(message.title, message.url);
    }
  });
})();
