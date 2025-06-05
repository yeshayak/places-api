'use strict';
console.log('Service Worker: Background script loaded');
// Listen for service worker installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Service Worker: Installed');
});
// Keep service worker active
chrome.runtime.onConnect.addListener(function (port) {
  console.log('Service Worker: Connected to port', port.name);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  if (
    (tabInfo.url?.includes('/window/w_order_entry_sheet') ||
      tabInfo.url?.includes('/window/w_ship_to_sheet') ||
      tabInfo.url?.includes('/window/w_customer_maint_sheet') ||
      tabInfo.url?.includes('/window/w_customer_master_inquiry') ||
      tabInfo.url?.includes('/window/w_ship_sheet') ||
      tabInfo.url?.includes('/window/w_purchase_order_entry_sheet')) &&
    changeInfo.title &&
    changeInfo.title != 'Prophet 21'
  ) {
    chrome.tabs.sendMessage(tabId, { changeInfo: changeInfo });
    console.log('Updated tab: ' + tabId);
    console.log('Changed attributes: ');
    console.log(changeInfo);
    console.log('New tab Info: ');
    console.log(tabInfo);
  }
});
