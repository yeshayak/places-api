import { initializeAutocomplete, handlePlaceSelect } from './autocomplete.js'

var tabListHeader = document.querySelector('#p21TabsetDir ul')
let root = angular.element('#contextWindow').scope()
var autocomplete
var autocomplete2

let initAutocomplete = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TABPAGE_1') {
    // console.log('initializeAutoComplete')
    // Search on address_name field
    autocomplete = await initializeAutocomplete('[id*="address_name"]')
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        // console.log('place_changed')
        handlePlaceSelect(autocomplete, '[id*=shipto]', true)
      })
    }
    // Search on address1 field
    autocomplete2 = await initializeAutocomplete('[id*="address1"]')
    if (autocomplete2) {
      google.maps.event.addListener(autocomplete2, 'place_changed', () => {
        // console.log('place_changed')
        handlePlaceSelect(autocomplete2, '[id*=shipto]', false)
      })
    }
  }
}

initAutocomplete()

tabListHeader?.addEventListener('click', () => {
  setTimeout(() => {
    initAutocomplete()
  }, 250)
})
