chrome.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  if (
    (tabInfo.url.includes('/window/w_order_entry_sheet') ||
      tabInfo.url.includes('/window/w_ship_to_sheet') ||
      tabInfo.url.includes('/window/w_customer_maint_sheet') ||
      tabInfo.url.includes('/window/w_customer_master_inquiry') ||
      tabInfo.url.includes('/window/w_ship_sheet')) &&
    changeInfo.title
  ) {
    chrome.tabs.sendMessage(tabId, { changeInfo: changeInfo })

    console.log('Updated tab: ' + tabId)
    console.log('Changed attributes: ')
    console.log(changeInfo)
    console.log('New tab Info: ')
    console.log(tabInfo)
  }
})

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'postMessage') {
//     const myHeaders = new Headers()
//     myHeaders.append('Content-Type', 'application/json')
//     myHeaders.append('Authorization', 'Basic WjRPQkpMSDRFVkNWMldJV0lOR0g2UVY1NzRXVTVUVE06WXVGOGJFbTFUYVpiSkM1YmRyOXpjcVFhWUltSVVDR3h2aGJBSTdoRWxUQQ==')

//     const raw = JSON.stringify({
//       text: 'Your package is ready for pickup!',
//       from: '+17326554339',
//       to: '+18483738096',
//       status_callback: 'https://www.toptal.com/developers/postbin/abc-123',
//       tags: ['order_pickup'],
//     })

//     const requestOptions = {
//       method: 'POST',
//       headers: myHeaders,
//       body: raw,
//       redirect: 'follow',
//     }

//     fetch('https://gatorps.prokeep.com/rest/v1/messages', requestOptions)
//       .then((response) => response.text())
//       .then((result) => sendResponse({ result }))
//       .catch((error) => sendResponse({ error }))

//     return true // Will respond asynchronously
//   }
// })
