if (typeof tabListHeader === 'undefined') {
  var autocomplete
  let initializeAutocomplete = () => {
    if (
      tabListHeader.querySelector('li.active a').innerHTML === 'Physical Address'
      // &&
      // !document.getElementById('shipto.ship_to_id').value
    ) {
      console.log('initializeAutoComplete')
      let autocompleteInput = document.querySelector(`[id*='physical_address.phys_address1']`)
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
    if (!addressObject) {
      throw new Error('No place selected')
    }
    const place = {
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
    console.log(place)
    for (let component in place) {
      let id = document.querySelector(`[id=physical_address]`).querySelector(`[id$=${component}]`).id
      let fieldName = id.split('.')[1]
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
  var tabListHeader = document.querySelector('#bottomSectionDiv ul')

  initializeAutocomplete()
  paymentLink()

  tabListHeader?.addEventListener('click', () => {
    setTimeout(() => {
      initializeAutocomplete()
    }, 250)
    setTimeout(() => {
      paymentLink()
    }, 250)
  })
}
