import { initializeAutocomplete, handlePlaceSelect } from './autocomplete.js'

var tabListHeader = document.querySelector('#p21TabsetDir ul')
let root = angular.element('#contextWindow').scope()
var autocomplete
var autocomplete2

let initAutocomplete = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TABPAGE_1') {
    // console.log('initializeAutoComplete')
    autocomplete = await initializeAutocomplete(`[id*='customer_name']`)
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        // console.log('place_changed')
        handlePlaceSelect(autocomplete, '[id*=tp_1_dw_1]', true, root)
      })
    }

    autocomplete2 = await initializeAutocomplete(`[id*='address1']`)
    if (autocomplete2) {
      google.maps.event.addListener(autocomplete2, 'place_changed', () => {
        // console.log('place_changed')
        handlePlaceSelect(autocomplete2, '[id*=tp_1_dw_1]', false, root)
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
