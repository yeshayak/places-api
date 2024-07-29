const injectScript = (file_path, tag) => {
  const node = document.getElementsByTagName(tag)[0]
  const script = document.createElement('script')
  script.setAttribute('type', 'text/javascript')
  script.setAttribute('src', file_path)
  node.appendChild(script)
}

injectScript(chrome.runtime.getURL('loadMap.js'), 'body')

chrome.runtime.onMessage.addListener((request) => {
  if (request.changeInfo.title?.includes('Order Entry:')) {
    injectScript(chrome.runtime.getURL('w_order_entry_sheet.js'), 'body')
  } else if (request.changeInfo.title?.includes('Ship To Maintenance:')) {
    injectScript(chrome.runtime.getURL('w_ship_to_sheet.js'), 'body')
  } else if (request.changeInfo.title?.includes('Customer Maintenance:')) {
    injectScript(chrome.runtime.getURL('w_customer_maint_sheet.js'), 'body')
  } else if (request.changeInfo.title?.includes('Customer Master Inquiry:')) {
    injectScript(chrome.runtime.getURL('w_customer_master_inquiry.js'), 'body')
  }
})
