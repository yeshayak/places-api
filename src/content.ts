(() => {
  // Prevent duplicate injection using a meta tag
  if (document.head.querySelector('meta[name="places-api-injected"]')) {
    // Already injected, exit
    return;
  }
  const meta = document.createElement('meta');
  meta.name = 'places-api-injected';
  meta.content = 'true';
  document.head.appendChild(meta);

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

  // Get API key from localStorage, fallback to chrome.storage.local if missing/stale
  const setupApiKey = async (): Promise<void> => {
    let apiKey = localStorage.getItem('gatorPlacesApiKey');
    if (apiKey && apiKey.trim()) {
      window.postMessage({ type: 'GATOR_API_KEY', apiKey }, '*');
      console.log('[Content] API key loaded from localStorage');
    } else {
      // Fallback: request from chrome.storage.local
      chrome.storage.local.get(['apiKey'], (result) => {
        if (result.apiKey && result.apiKey.trim()) {
          localStorage.setItem('gatorPlacesApiKey', result.apiKey);
          window.postMessage({ type: 'GATOR_API_KEY', apiKey: result.apiKey }, '*');
          console.log('[Content] Healed localStorage from chrome.storage.local');
        } else {
          console.error('[Content] Failed to heal localStorage: API key not found in chrome.storage.local');
        }
      });
    }
    // ...existing code...
  };

  // Setup API key and inject core scripts
  setupApiKey();

  // Mapping for dynamic script injection based on page titles
  const scriptMapping: Record<string, string> = {
    'Order Entry:': 'w_order_entry_sheet.js',
    'Ship To Maintenance:': 'w_ship_to_sheet.js',
    'Customer Maintenance:': 'w_customer_maint_sheet.js',
    'Customer Master Inquiry:': 'w_customer_master_inquiry.js',
    'Purchase Order Entry:': 'w_purchase_order_entry_sheet.js',
  };

  // Unified message handler
  chrome.runtime.onMessage.addListener((msg) => {
    // Handle INJECT_KEY
    if (msg.type === 'INJECT_KEY' && msg.apiKey) {
      // Inject injectkey.js as a file
      injectScript(chrome.runtime.getURL('injectKey.js'), 'body')
        .then(() => {
          // Pass the API key to the injected script via window.postMessage
          window.postMessage({ type: 'GATOR_API_KEY', apiKey: msg.apiKey }, '*');
        })
        .catch((error) => {
          console.error('Failed to inject injectKey.js:', error);
        });
      return;
    }

    // Handle dynamic script injection by title
    if (msg.changeInfo?.title) {
      const scriptKey = Object.keys(scriptMapping).find((key) => msg.changeInfo?.title.startsWith(key));
      if (scriptKey) {
        injectScript(chrome.runtime.getURL(scriptMapping[scriptKey]), 'body')
          .then(() => console.log(`Loaded ${scriptMapping[scriptKey]}`))
          .catch((error) => console.error(`Failed to load ${scriptMapping[scriptKey]}:`, error));
      }
    }
  });
})();
