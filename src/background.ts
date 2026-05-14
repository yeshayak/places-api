console.log('Service Worker: Background script loaded');

// Listen for service worker installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Service Worker: Installed');
});

const p21WindowPaths = [
  '/window/w_order_entry_sheet',
  '/window/w_ship_to_sheet',
  '/window/w_customer_maint_sheet',
  '/window/w_customer_master_inquiry',
  '/window/w_ship_sheet',
  '/window/w_purchase_order_entry_sheet',
];

const p21WindowTitles = [
  'Order Entry:',
  'Ship To Maintenance:',
  'Customer Maintenance:',
  'Customer Master Inquiry:',
  'Purchase Order Entry:',
];

const isP21WindowUrl = (url: string | undefined): boolean => Boolean(url && p21WindowPaths.some((path) => url.includes(path)));

const isP21WindowTitle = (title: string | undefined): boolean =>
  Boolean(title && title !== 'Prophet 21' && p21WindowTitles.some((prefix) => title.startsWith(prefix)));

const sendTabMessage = (tabId: number, message: unknown): void => {
  chrome.tabs.sendMessage(tabId, message, () => {
    // A P21 tab can emit title updates before content.js has finished injecting.
    // Reading lastError prevents Chrome from surfacing that expected race as uncaught.
    void chrome.runtime.lastError;
  });
};

const ensureContentScript = (tabId: number, url: string, onReady?: () => void): void => {
  let origin: string;
  try {
    origin = new URL(url).origin + '/*';
  } catch {
    return;
  }

  chrome.permissions.contains({ origins: [origin] }, (granted) => {
    if (!granted) {
      console.warn('Service Worker: Missing host permission for ' + origin);
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => !!document.head?.querySelector('meta[name="places-api-injected"]'),
        },
        (results) => {
          if (chrome.runtime.lastError) {
            void chrome.runtime.lastError;
            return;
          }

          if (results?.[0]?.result) {
            onReady?.();
            return;
          }

          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: ['content.js'],
            },
            () => {
              if (chrome.runtime.lastError) {
                void chrome.runtime.lastError;
                return;
              }

              onReady?.();
            }
          );
        }
      );
    });
  });
};

// Listen for messages (e.g., from the popup) to wake/verify the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let isAsync = false;

  if (message.type === 'STORE_KEY') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        sendTabMessage(tabs[0].id, { type: 'INJECT_KEY', apiKey: message.apiKey });
      }
    });
  } else if (message?.type === 'GET_API_KEY') {
    console.log('Service Worker: Received API key request');
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      const apiKey = result.apiKey;
      sendResponse(typeof apiKey === 'string' && apiKey.trim() ? { apiKey } : { error: 'Google Maps API key not found in storage' });
    });
    isAsync = true;
  }

  return isAsync;
});

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tabInfo: chrome.tabs.Tab): void => {
  if (!tabInfo.url) return;

  const title = changeInfo.title ?? tabInfo.title;
  const shouldInject = isP21WindowUrl(tabInfo.url) || isP21WindowTitle(title);
  if (!shouldInject) return;

  ensureContentScript(tabId, tabInfo.url, () => {
    if (isP21WindowTitle(title)) {
      sendTabMessage(tabId, { changeInfo: { ...changeInfo, title } });
    }

    console.log('Updated P21 tab: ' + tabId);
    console.log('Changed attributes: ');
    console.log(changeInfo);
    console.log('New tab Info: ');
    console.log(tabInfo);
  });
});
