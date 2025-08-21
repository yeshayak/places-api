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

  // Get API key from background script and make it available globally
  const setupApiKey = async (): Promise<void> => {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      // Type guard to ensure response is an object with apiKey property
      const apiKey = response && typeof response === 'object' && 'apiKey' in response ? (response as { apiKey: string }).apiKey : undefined;

      if (apiKey) {
        // Use postMessage to send API key to page context
        window.postMessage({ type: 'GATOR_API_KEY', apiKey: apiKey }, '*');

        console.log('API key sent to page context via postMessage');

        // Inject scripts in dependency order
        try {
          // Then inject loadMap (core functionality)
          await injectScript(chrome.runtime.getURL('loadMap.js'), 'body');

          console.log('Core scripts loaded successfully');
        } catch (error) {
          console.error('Error loading core scripts:', error);
        }
      } else {
        console.error('Failed to get API key:', response || 'Unknown error');
      }
    } catch (error) {
      console.error('Error getting API key:', error);
    }
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

  // Listen for messages and inject the appropriate script
  chrome.runtime.onMessage.addListener((request: { changeInfo: { title?: string } }) => {
    const scriptKey = Object.keys(scriptMapping).find((key) => request.changeInfo.title?.startsWith(key));

    if (scriptKey) {
      // Inject the specific window script
      injectScript(chrome.runtime.getURL(scriptMapping[scriptKey]), 'body')
        .then(() => console.log(`Loaded ${scriptMapping[scriptKey]}`))
        .catch((error) => console.error(`Failed to load ${scriptMapping[scriptKey]}:`, error));
    }
  });
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
