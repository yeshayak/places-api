import { root } from './w_order_entry_sheet'
import angular from 'angular'

export async function paymentLink() {
  if (root.windowMetadata.Sections.top.ActivePage === 'TP_REMITTANCES') {
    console.log('initialize paymentLink')
    let recalculateTotals = document.querySelector(`[id='remittotals.recalculate_t'`)
    let orderRecord = angular.element(document.querySelector(`[id='order.order_no'`)).scope().record
    let paymentRecord = angular.element(document.querySelector(`[id='remittotals.cf_balance'`)).scope().record
    let contactRecord = angular.element(document.querySelector(`[id='tp_contacts.contact_id'`)).scope()?.record
    let customerRecord = window.angular.element(document.querySelector(`[id='tp_customer.email_address'`)).scope()?.record
    let linkTextArea = document.querySelector(`[id='remittotals.cf_usersd22bd'`)
    let copyTextButton = document.querySelector(`[id='remittotals.cb_usersd23fc'`)
    let sendEmailButton = document.querySelector(`[id='remittotals.cb_usersd66af'`)
    let balance = paymentRecord?.cf_balance.toFixed(2)

    let companyString
    if (orderRecord.company_id == 'WHB') {
      companyString = 'wavehomeandbath'
    } else if (orderRecord.company_id == 'GPS') {
      companyString = 'gatorplumbingsupply'
    }
    linkTextArea.classList.remove('ng-hide')
    copyTextButton.classList.remove('ng-hide')
    sendEmailButton.classList.remove('ng-hide')
    linkTextArea.value = `https://secure.cardknox.com/${companyString}?xAmount=${balance}&xInvoice=${orderRecord.order_no}&xCustom01=${orderRecord.customer_id}`

    console.log(`Balance: ${balance}, Order: ${orderRecord.order_no}, Customer: ${orderRecord.customer_id}, Company: ${orderRecord.company_id}`)
    console.log(`https://secure.cardknox.com/${companyString}?xAmount=${balance}&xInvoice=${orderRecord.order_no}&xCustom01=${orderRecord.customer_id}`)

    let sendEmail = (linkTextArea) => {
      console.log('email clicked')
      let link = encodeURIComponent(linkTextArea.value)
      window.location = `mailto:${contactRecord?.email_address}?subject=Payment%20Link&body=See%20below%20link%20to%20pay%20for%20your%20order%3A%0A%0A${link}`
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
    recalculateTotals?.addEventListener('click', () => {
      paymentLink()
    })
  }
}
