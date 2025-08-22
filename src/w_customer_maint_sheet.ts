import { AutocompleteElement, handlePlaceSelect } from './autocomplete';

// Using global AngularScope
type CustomScope = AngularScope;

// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
let autocomplete: google.maps.places.Autocomplete | null;
let autocomplete2: google.maps.places.Autocomplete | null;

// Initialize Google Places Autocomplete
const initializeAutoComplete = async (): Promise<void> => {
  if ((tabListHeader?.querySelector('.active') as HTMLElement)?.dataset.menuItem === 'TABPAGE_1') {
    console.log('initializeAutoComplete');

    // Autocomplete for Customer Name
    autocomplete = await AutocompleteElement(`[id*='customer_name']`);
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete!, '[id*=tp_1_dw_1]', true);
      });
    }

    // Autocomplete for Address
    autocomplete2 = await AutocompleteElement(`[id*='address1']`);
    if (autocomplete2) {
      google.maps.event.addListener(autocomplete2, 'place_changed', () => {
        handlePlaceSelect(autocomplete2!, '[id*=tp_1_dw_1]', false);
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
