import { initializeAutocomplete, handlePlaceSelect } from './autocomplete.js'

var tabListHeader = document.querySelector('#bottomSectionDiv ul')
let root = angular.element('#contextWindow').scope()
var autocomplete

let initAutocomplete = async () => {
  if (root.windowMetadata.Sections.bottom.ActivePage === 'PHYSICAL_ADDRESS') {
    // console.log('initializeAutoComplete')
    autocomplete = await initializeAutocomplete(`[id*='physical_address.phys_address1']`)
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        // console.log('place_changed')
        handlePlaceSelect(autocomplete, '[id=physical_address]', false)
      })
    }
  }
}

let paymentLink = async () => {
  if (tabListHeader.querySelector('li.active>a').innerHTML === 'Payment Account') {
    console.log('initialize paymentLink')
    let customerRecord = window.angular.element(document.querySelector(`[id='customer.customer_id'`)).scope()?.record
    let linkTextArea = document.querySelector(`[id='tp_paymentaccount.cf_usersd8fc2'`)
    let copyTextButton = document.querySelector(`[id='tp_paymentaccount.cb_usersd4e72'`)
    let sendEmailButton = document.querySelector(`[id='tp_paymentaccount.cb_usersd7da8'`)

    let companyString
    if (customerRecord.company_id == 'WHB') {
      companyString = 'wavehomeandbath'
    } else if (customerRecord.company_id == 'GPS') {
      companyString = 'gatorplumbingsupply'
    }
    linkTextArea.classList.remove('ng-hide')
    copyTextButton.classList.remove('ng-hide')
    sendEmailButton.classList.remove('ng-hide')
    linkTextArea.value = `https://secure.cardknox.com/${companyString}?xCustom01=${customerRecord.customer_id}`

    console.log(`Customer: ${customerRecord.customer_id}, Company: ${customerRecord.company_id}`)
    console.log(`https://secure.cardknox.com/${companyString}?xCustom01=${customerRecord.customer_id}`)

    let sendEmail = (linkTextArea) => {
      console.log('email clicked')
      let link = encodeURIComponent(linkTextArea.value)
      window.location = `mailto:?subject=Payment%20Link&body=See%20below%20link%20to%20pay%20for%20your%20order%3A%0A%0A${link}`
    }

    let copyToClipboard = (linkTextArea) => {
      // Copy the text inside the text field
      navigator.clipboard.writeText(linkTextArea.value)
    }

    sendEmailButton.addEventListener('click', () => {
      sendEmail(linkTextArea)
    })
    copyTextButton.addEventListener('click', () => {
      copyToClipboard(linkTextArea)
    })
  }
}

initAutocomplete()
paymentLink()

tabListHeader?.addEventListener('click', () => {
  setTimeout(() => {
    initAutocomplete()
  }, 250)
  setTimeout(() => {
    paymentLink()
  }, 250)
})
