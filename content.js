const injectScript = (filePath, tag) => {
  const existingScript = document.querySelector(`script[src="${filePath}"]`);
  if (!existingScript) {
    const node = document.getElementsByTagName(tag)[0];
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', filePath);
    node.appendChild(script);
  }
};

// Inject the initial script
injectScript(chrome.runtime.getURL('loadMap.js'), 'body');

// Mapping for dynamic script injection based on page titles
const scriptMapping = {
  'Order Entry:': 'w_order_entry_sheet.js',
  'Ship To Maintenance:': 'w_ship_to_sheet.js',
  'Customer Maintenance:': 'w_customer_maint_sheet.js',
  'Customer Master Inquiry:': 'w_customer_master_inquiry.js',
  'Purchase Order Entry:': 'w_purchase_order_entry_sheet.js',
};

// Listen for messages and inject the appropriate script
chrome.runtime.onMessage.addListener((request) => {
  const scriptKey = Object.keys(scriptMapping).find((key) => request.changeInfo.title?.startsWith(key));

  if (scriptKey) {
    injectScript(chrome.runtime.getURL(scriptMapping[scriptKey]), 'body');
  }
});
