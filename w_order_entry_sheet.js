if (typeof tabListHeader === 'undefined') {
  var tabListHeader = document.querySelector('.tab-list-header-container>ul')
  var autocomplete

  let initializeAutocomplete = () => {
    if (
      tabListHeader.querySelector('li.active>a').innerHTML === 'Ship To'
      // &&
      // !document.getElementById('shipto.ship_to_id').value
    ) {
      console.log('initializeAutoComplete')
      let autocompleteInput = document.querySelectorAll(`div.tab-pane.ng-scope.active`)[1].querySelector(`[id*='name']`)
      autocomplete = new window.google.maps.places.Autocomplete(autocompleteInput, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'name'],
      })
      autocompleteInput.onfocus = () => {
        autocompleteInput.autocomplete = 'new-password'
      }
      google.maps.event.addListener(autocomplete, 'place_changed', handlePlaceSelect)
    }
  }

  let handlePlaceSelect = async () => {
    console.log(autocomplete.getPlace())
    const addressObject = autocomplete.getPlace()
    const place = {
      name: addressObject.name,
      address1: '',
      address2: '',
    }
    addressObject.address_components.forEach((component) => {
      component.types.includes('street_number') ? (place.address1 = `${component.short_name} `) : ''
      component.types.includes('route') ? (place.address1 += `${component.short_name}`) : ''
      component.types.includes('subpremise') ? (place.address2 = component.short_name) : ''
      component.types.includes('locality') ? (place.city = component.short_name) : ''
      component.types.includes('sublocality_level_1') ? (place.city = component.short_name) : ''
      component.types.includes('administrative_area_level_1') ? (place.state = component.short_name) : ''
      component.types.includes('postal_code') ? (place.postal_code = component.short_name) : ''
    })

    //Loop through all the components and update the field that contains that name
    for (component in place) {
      console.log(component, document.querySelector(`[id=shipto]`).querySelector(`[id$=${component}]`).id)
      let id = document.querySelector(`[id=shipto]`).querySelector(`[id$=${component}]`).id
      let fieldName = id.split('.')[1]
      console.log(id, fieldName)
      window.angular
        .element(document.getElementById(id))
        .scope()
        .$apply(({ record }) => {
          record[fieldName] = place[component]
        })
      await window.angular
        .element(document.getElementById(id))
        .scope()
        .onChange()
        .then(() => {})
        .catch((error) => {
          console.log(error)
        })
    }
  }

  let paymentLink = async () => {
    if (tabListHeader.querySelector('li.active>a').innerHTML === 'Remittances') {
      console.log('initialize paymentLink')
      let recalculateTotals = document.querySelector(`[id='remittotals.recalculate_t'`)
      let orderRecord = window.angular.element(document.querySelector(`[id='order.order_no'`)).scope().record
      let paymentRecord = window.angular.element(document.querySelector(`[id='remittotals.cf_balance'`)).scope().record
      let contactRecord = window.angular.element(document.querySelector(`[id='tp_contacts.contact_id'`)).scope()?.record
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

  initializeAutocomplete()
  paymentLink()

  tabListHeader?.addEventListener('click', () => {
    setTimeout(() => {
      initializeAutocomplete()
    }, 250)
    setTimeout(() => {
      paymentLink()
    }, 2000)
  })
}
