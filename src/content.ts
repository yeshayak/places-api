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
  }
  document.head.appendChild(meta);

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
    if (event.source !== window || event.data?.type !== 'P21_EXT_REQUEST_API_KEY') return;
    if (!isContextValid()) return;

    const requestId = event.data.requestId;
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!isContextValid()) return;

      const apiKey = typeof result.apiKey === 'string' ? result.apiKey.trim() : '';
      window.postMessage(apiKey ? { type: 'P21_EXT_API_KEY_RESPONSE', requestId, apiKey } : { type: 'P21_EXT_API_KEY_RESPONSE', requestId, error: 'Google Maps API key not found in extension storage' }, '*');
    });
  });

  const ROUTER_CONFIG = {
    core: ['xhr-monitor.js', 'action-monitor.js'],
  };

  /**
   * Dynamically derives the sheet script name from the P21 window URL.
   * Example: /window/w_order_entry_sheet -> w_order_entry_sheet.js
   */
  const getWindowScript = (url: string): string | null => {
    const match = url.match(/\/window\/(w_[a-z0-9_]+)/i);
    return match ? `${match[1]}.js` : null;
  };

  const injectForContext = async (url: string): Promise<void> => {
    const sheetScript = getWindowScript(url);
    if (!sheetScript || !isContextValid()) return;

    const scripts = [...ROUTER_CONFIG.core, sheetScript];

    try {
      for (const script of scripts) {
        if (isContextValid()) await injectScript(chrome.runtime.getURL(script), 'body');
      }
    } catch (error: any) {
      if (!error.message?.includes('context invalidated')) console.error(`[P21 EXT] Context injection failed for ${sheetScript}:`, error);
    }
  };

  injectForContext(window.location.href);

  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => injectForContext(window.location.href));
    titleObserver.observe(titleElement, { childList: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.url) {
      injectForContext(msg.url);
    }
  });
})();
