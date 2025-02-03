var tabListHeader = document.querySelector('#p21TabsetDir ul')
var autocomplete
var autocomplete2
let initializeAutocomplete = () => {
  if (tabListHeader.querySelector('li.active>a').innerHTML === 'Ship To') {
    console.log('initializeAutoComplete')
    //Search on address_name field
    let autocompleteInput = document.querySelector('#shiptomain').querySelector(`[id*='address_name']`)
    autocomplete = new window.google.maps.places.Autocomplete(autocompleteInput, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'name'],
    })
    autocompleteInput.onfocus = () => {
      autocompleteInput.autocomplete = 'new-password'
    }
    google.maps.event.addListener(autocomplete, 'place_changed', handlePlaceSelect)
    //Search on address1 field
    let autocompleteInput2 = document.querySelector('#shiptomain').querySelector(`[id*='address1']`)
    autocomplete2 = new window.google.maps.places.Autocomplete(autocompleteInput2, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'name'],
    })
    autocompleteInput2.onfocus = () => {
      autocompleteInput2.autocomplete = 'new-password'
    }
    google.maps.event.addListener(autocomplete2, 'place_changed', handlePlaceSelect2)
  }
}

let handlePlaceSelect = async () => {
  console.log(autocomplete.getPlace())
  const addressObject = autocomplete.getPlace()
  console.log(addressObject)
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
  for (let component in place) {
    console.log(component, document.querySelector(`[id*=shipto]`).querySelector(`[id$=${component}]`).id)
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
let handlePlaceSelect2 = async () => {
  console.log(autocomplete2.getPlace())
  const addressObject = autocomplete2.getPlace()
  console.log(addressObject)
  const place = {
    //address_name: addressObject.name,
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
    console.log(component, document.querySelector(`[id*=shipto]`).querySelector(`[id$=${component}]`).id)
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

initializeAutocomplete()

tabListHeader?.addEventListener('click', () => {
  setTimeout(() => {
    initializeAutocomplete()
  }, 250)
})
