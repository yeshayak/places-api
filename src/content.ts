(() => {
  // Prevent duplicate injection using a meta tag
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
      window.postMessage(
        apiKey
          ? { type: 'P21_EXT_API_KEY_RESPONSE', requestId, apiKey }
          : { type: 'P21_EXT_API_KEY_RESPONSE', requestId, error: 'Google Maps API key not found in extension storage' },
        '*',
      );
    });
  });

  // Mapping for dynamic script injection based on page titles
  const scriptMapping: Record<string, string> = {
    'Order Entry:': 'w_order_entry_sheet.js',
    'Ship To Maintenance:': 'w_ship_to_sheet.js',
    'Customer Maintenance:': 'w_customer_maint_sheet.js',
    'Customer Master Inquiry:': 'w_customer_master_inquiry.js',
    'Purchase Order Entry:': 'w_purchase_order_entry_sheet.js',
  };

  const injectForTitle = (title: string | undefined): void => {
    if (!title || !isContextValid()) return;

    const scriptKey = Object.keys(scriptMapping).find((key) => title.startsWith(key));
    if (!scriptKey) return;

    const scripts = ['xhr-monitor.js', 'action-monitor.js', scriptMapping[scriptKey]];

    scripts
      .reduce((chain, script) => {
        return chain.then(() => {
          if (!isContextValid()) return Promise.resolve();
          return injectScript(chrome.runtime.getURL(script), 'body');
        });
      }, Promise.resolve())
      .then(() => console.log(`[P21 EXT] Context scripts loaded for: ${scriptKey}`))
      .catch((error) => {
        // Filter out context invalidated errors to clean up the console
        if (!error.message?.includes('context invalidated')) {
          console.error(`[P21 EXT] Injection failed:`, error);
        }
      });
  };

  injectForTitle(document.title);

  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => injectForTitle(document.title));
    titleObserver.observe(titleElement, { childList: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.changeInfo?.title) {
      injectForTitle(msg.changeInfo.title);
    }
  });
})();
