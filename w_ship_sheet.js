var tabListHeader = document.querySelector('#p21TabsetDir ul')
let root = angular.element('#contextWindow').scope()

let pickupMessage = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TABPAGE_1') {
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
}

pickupMessage()
