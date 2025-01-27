const injectScript = (file_path, tag) => {
  const existingScript = document.querySelector(`script[src="${file_path}"]`)
  if (!existingScript) {
    const node = document.getElementsByTagName(tag)[0]
    const script = document.createElement('script')
    script.setAttribute('type', 'module')
    script.setAttribute('src', file_path)
    node.appendChild(script)
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.changeInfo.title?.includes('Order Entry:')) {
    injectScript(chrome.runtime.getURL('loadMap.js'), 'body')
    injectScript(chrome.runtime.getURL('w_order_entry_sheet.js'), 'body')
  } else if (request.changeInfo.title?.includes('Ship To Maintenance:')) {
    injectScript(chrome.runtime.getURL('w_ship_to_sheet.js'), 'body')
    injectScript(chrome.runtime.getURL('loadMap.js'), 'body')
  } else if (request.changeInfo.title?.includes('Customer Maintenance:')) {
    injectScript(chrome.runtime.getURL('loadMap.js'), 'body')
    injectScript(chrome.runtime.getURL('w_customer_maint_sheet.js'), 'body')
  } else if (request.changeInfo.title?.includes('Customer Master Inquiry:')) {
    injectScript(chrome.runtime.getURL('loadMap.js'), 'body')
    injectScript(chrome.runtime.getURL('w_customer_master_inquiry.js'), 'body')
  } else if (request.changeInfo.title?.includes('Shipping')) {
    console.log('initialize pickupMessage')
    let pickupButton = document.querySelector(`[id='tp_1_dw_1.cb_usersda77a'`)
    pickupButton.classList.remove('ng-hide')

    let postMessage = () => {
      console.log('pickup button clicked')

      chrome.runtime.sendMessage(
        {
          action: 'postMessage',
        },
        (response) => {
          if (response.error) {
            console.error('Error:', response.error)
          } else {
            console.log('Message sent:', response.result)
          }
        }
      )
    }

    pickupButton.addEventListener('click', postMessage)
  }
})
