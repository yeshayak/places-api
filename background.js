function handleUpdated(tabId, changeInfo, tabInfo) {
  if (tabInfo.url.includes('/window/w_order_entry_sheet') || tabInfo.url.includes('/window/w_ship_to_sheet') || tabInfo.url.includes('/window/w_customer_maint_sheet') || tabInfo.url.includes('/window/w_customer_master_inquiry')) {
    chrome.tabs.sendMessage(tabId, { changeInfo: changeInfo })

    console.log('Updated tab: ' + tabId)
    console.log('Changed attributes: ')
    console.log(changeInfo)
    console.log('New tab Info: ')
    console.log(tabInfo)
  }
}

chrome.tabs.onUpdated.addListener(handleUpdated)
