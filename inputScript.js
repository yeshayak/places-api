if (typeof tabListHeader === 'undefined') {
  var autocomplete
  let initializeAutocomplete = () => {
    if (
      tabListHeader.querySelector('li.active>a').innerHTML === 'Ship To'
      // &&
      // !document.getElementById('shipto.ship_to_id').value
    ) {
      const googleComponents = [
        // { googleComponent: `name`, id: `ship_to_name` },
        { googleComponent: `subpremise`, id: `phys_address2` },
        { googleComponent: `sublocality_level_1`, id: `phys_city` },
        { googleComponent: `locality`, id: `phys_city` },
        { googleComponent: `administrative_area_level_1`, id: `phys_state` },
        { googleComponent: `postal_code`, id: `phys_postal_code` },
      ]
      console.log('initializeAutoComplete')
      let autocompleteInput = document.querySelectorAll(`div.tab-pane.ng-scope.active`)[1].querySelector(`[id*='name']`)
      // getElementById('shipto.ship_to_name')
      //p21-editor-padding ng-pristine ng-valid ng-isolate-scope ng-empty ng-valid-required Char form-control Any pac-target-input ng-touched
      //p21-editor-padding ng-pristine ng-valid ng-isolate-scope ng-empty ng-valid-required Char form-control Any pac-target-input ng-touched
      autocomplete = new window.google.maps.places.Autocomplete(autocompleteInput, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'name'],
      })
      autocompleteInput.onfocus = () => {
        autocompleteInput.autocomplete = 'new-password'
      }
      google.maps.event.addListener(autocomplete, 'place_changed', handlePlaceSelect)
      // google.maps.event.addListener(autocomplete, 'place_changed', () => {
      //   console.log('place_changed')
      //   const place = autocomplete.getPlace()
      //   for (const component in googleComponents) {
      //     const addressComponents = place.address_components
      //     addressComponents.forEach((addressComponent) => {
      //       // console.log(googleComponents[component], addressComponent)
      //       populateFormElements(addressComponent, googleComponents[component])
      //     })
      //   }
      // })
      // async function populateFormElements(addressComponent, formMap) {
      //   const addressType = addressComponent.types[0]
      //   let formElement = window.angular.element(document.getElementById(`shipto.${formMap.id}`))
      //   if (formMap.googleComponent === 'name') {
      //   }
      //   if (formMap.googleComponent === addressType) {
      //     console.log(addressComponent, formMap.googleComponent)
      //     const formValue = addressComponent.short_name
      //     formElement.scope().$apply(({ record }) => {
      //       record[formMap.id] = formValue
      //     })
      //     await formElement
      //       .scope()
      //       .onChange()
      //       .then(() => {})
      //       .catch((error) => {
      //         console.log(error)
      //       })
      //   }
      // }

      // autoComplete.addListener(
      //   'place_changed',
      //   handlePlaceSelect
      // )
    }
  }

  let handlePlaceSelect = async () => {
    // console.log('Place Selected')
    const addressObject = autocomplete.getPlace()
    const place = {
      name: addressObject.name,
      address1: '',
      address2: '',
    }
    addressObject.address_components.forEach((component) => {
      switch (component.types[0]) {
        case 'street_number':
          place.address1 = `${component.short_name} `
          break
        case 'route':
          place.address1 += `${component.short_name}`
          break
        case 'subpremise':
          place.address2 = component.short_name
          break
        case 'locality':
          place.city = component.short_name
          break
        case 'sublocality_level_1':
          place.city = component.short_name
          break
        case 'administrative_area_level_1':
          place.state = component.short_name
          break
        case 'postal_code':
          place.postal_code = component.short_name
          break
        default:
          break
      }
    })

    // var ship_to_name = window.angular.element(document.getElementById('shipto.ship_to_name')).scope()
    // var address1 = window.angular.element(document.getElementById('shipto.phys_address1')).scope()
    // var address2 = window.angular.element(document.getElementById('shipto.phys_address2')).scope()
    // var city = window.angular.element(document.getElementById('shipto.phys_city')).scope()
    // var state = window.angular.element(document.getElementById('shipto.phys_state')).scope()
    // var postal_code = window.angular.element(document.getElementById('shipto.phys_postal_code')).scope()
    // ship_to_name.$apply(({ record }) => {
    //   record.ship_to_name = place.name
    //   record.phys_address1 = place.address1
    //   record.phys_address2 = place.address2
    //   record.phys_city = place.city
    //   record.phys_state = place.state
    //   record.phys_postal_code = place.postal_code
    // })

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
    }, 750)
  })
}
