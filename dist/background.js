"use strict";
console.log('Service Worker: Background script loaded');
// Listen for service worker installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Service Worker: Installed');
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
    if (!tabInfo.url)
        return;
    // Only inject for Prophet 21 windows
    if (!(tabInfo.url.includes('/window/w_order_entry_sheet') ||
        tabInfo.url.includes('/window/w_ship_to_sheet') ||
        tabInfo.url.includes('/window/w_customer_maint_sheet') ||
        tabInfo.url.includes('/window/w_customer_master_inquiry') ||
        tabInfo.url.includes('/window/w_ship_sheet') ||
        tabInfo.url.includes('/window/w_purchase_order_entry_sheet'))) {
        return;
    }
    // Check if we have permission for this origin
    let origin;
    try {
        origin = new URL(tabInfo.url).origin + '/*';
    }
    catch {
        return;
    }
    chrome.permissions.contains({ origins: [origin] }, (granted) => {
        if (!granted)
            return;
        // Check if the tab still exists
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                // Tab doesn't exist, skip
                return;
            }
            // Check for meta tag in the tab
            chrome.scripting.executeScript({
                target: { tabId },
                func: () => !!document.head.querySelector('meta[name="places-api-injected"]'),
            }, (results) => {
                if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
                    // Not injected yet, so inject content.js
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content.js'],
                    }, () => {
                        // Ignore errors here too (tab may have closed)
                    });
                }
            });
        });
    });
    // Existing Prophet 21 logic (send message, log, etc.)
    if (changeInfo.title && changeInfo.title != 'Prophet 21') {
        chrome.tabs.sendMessage(tabId, { changeInfo: changeInfo });
        console.log('Updated tab: ' + tabId);
        console.log('Changed attributes: ');
        console.log(changeInfo);
        console.log('New tab Info: ');
        console.log(tabInfo);
    }
});
