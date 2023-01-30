const injectScript = (file_path, tag) => {
  const node = document.getElementsByTagName(tag)[0]
  const script = document.createElement('script')
  script.setAttribute('type', 'text/javascript')
  script.setAttribute('src', file_path)
  node.appendChild(script)
}

injectScript(chrome.runtime.getURL('inject-script.js'), 'body')

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.changeInfo.title?.includes('Order Entry:') || request.changeInfo.title?.includes('Ship To Maintenance:')) {
    // console.log(request.changeInfo)
    injectScript(chrome.runtime.getURL('inputScript.js'), 'body')
  }
})
