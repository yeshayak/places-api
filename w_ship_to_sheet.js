if (typeof tabListHeader === 'undefined') {
  var autocomplete
  let initializeAutocomplete = () => {
    if (
      tabListHeader.querySelector('li.active>a').innerHTML === 'Ship To'
      // &&
      // !document.getElementById('shipto.ship_to_id').value
    ) {
      console.log('initializeAutoComplete')
      let autocompleteInput = document.querySelectorAll(`div.tab-pane.ng-scope.active`)[1].querySelector(`[id*='address_name']`)
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
      address_name: addressObject.name,
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
    for (component in place) {
      let id = document.querySelector(`[id*=shipto]`).querySelector(`[id$=${component}]`).id
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

  var tabListHeader = document.querySelector('.tab-list-header-container>ul')

  initializeAutocomplete()

  tabListHeader?.addEventListener('click', () => {
    setTimeout(() => {
      initializeAutocomplete()
    }, 250)
  })
}
