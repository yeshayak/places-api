var tabListHeader = document.querySelector('#p21TabsetDir ul')
let root = angular.element('#contextWindow').scope()

let pickupMessage = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TABPAGE_1') {
    console.log('initialize pickupMessage')
    // const myHeaders = new Headers()
    // myHeaders.append('Content-Type', 'application/json')
    // myHeaders.append('Authorization', 'Basic WjRPQkpMSDRFVkNWMldJV0lOR0g2UVY1NzRXVTVUVE06WXVGOGJFbTFUYVpiSkM1YmRyOXpjcVFhWUltSVVDR3h2aGJBSTdoRWxUQQ==')

    // const raw = JSON.stringify({
    //   text: 'Your package is ready for pickup!',
    //   from: '+17326554339',
    //   to: '+18483738096',
    //   status_callback: 'https://www.toptal.com/developers/postbin/abc-123',
    //   tags: ['order_pickup'],
    // })

    // const requestOptions = {
    //   method: 'POST',
    //   headers: myHeaders,
    //   body: raw,
    //   redirect: 'follow',
    // }

    // fetch('https://gatorps.prokeep.com/rest/v1/messages', requestOptions)
    //   .then((response) => response.text())
    //   .then((result) => console.log(result))
    //   .catch((error) => console.error(error))
  }
}

tabListHeader?.addEventListener('click', () => {
  setTimeout(() => {}, 250)
})
