import { initializeAutocomplete, handlePlaceSelect } from './autocomplete.js';

// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
const root = angular.element('#contextWindow').scope();
let autocomplete;
let autocomplete2;

// Initialize Google Places Autocomplete
const initializeAutoComplete = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TABPAGE_1') {
    console.log('initializeAutoComplete');

    // Autocomplete for Customer Name
    autocomplete = await initializeAutocomplete(`[id*='customer_name']`);
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete, '[id*=tp_1_dw_1]', true, root);
      });
    }

    // Autocomplete for Address
    autocomplete2 = await initializeAutocomplete(`[id*='address1']`);
    if (autocomplete2) {
      google.maps.event.addListener(autocomplete2, 'place_changed', () => {
        handlePlaceSelect(autocomplete2, '[id*=tp_1_dw_1]', false, root);
      });
    }
  }
};

// Initialize Functions
initializeAutoComplete();

// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
  setTimeout(() => initializeAutoComplete(), 250);
});
