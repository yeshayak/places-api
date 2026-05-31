console.log('Service Worker: Background script loaded');

const P21_CONFIG = {
  paths: ['/window/w_order_entry_sheet', '/window/w_ship_to_sheet', '/window/w_customer_maint_sheet', '/window/w_customer_master_inquiry', '/window/w_ship_sheet', '/window/w_purchase_order_entry_sheet', '/window/w_vendor_sheet'],
};

const p21WindowPaths = P21_CONFIG.paths;

const isP21WindowUrl = (url: string | undefined): boolean => Boolean(url && p21WindowPaths.some((path) => url.includes(path)));

const sendTabMessage = (tabId: number, message: unknown): void => {
  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError;
  });
};

/**
 * Entrypoint: Ensures the core content script is injected into valid P21 tabs.
 * Utilizes a meta-tag check to prevent redundant executions and handles
 * host permission verification.
 */
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
            },
          );
        },
      );
    });
  });
};

/**
 * Main Event Listener: Orchestrates the hand-off to the content script
 * when a tab navigates or changes titles.
 */
const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tabInfo: chrome.tabs.Tab): void => {
  if (!changeInfo.title || !tabInfo.url || !isP21WindowUrl(tabInfo.url)) return;

  ensureContentScript(tabId, tabInfo.url, () => {
    sendTabMessage(tabId, {
      type: 'P21_PAGE_CONTEXT_CHANGE',
      title: changeInfo.title,
      url: tabInfo.url,
    });

    console.log('Updated P21 tab: ' + tabId);
    console.log('Changed attributes: ');
    console.log(changeInfo);
    console.log('New tab Info: ');
    console.log(tabInfo);
  });
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Service Worker: Installed');
});

chrome.tabs.onUpdated.addListener(handleTabUpdate);
