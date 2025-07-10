import { AutocompleteElement, handlePlaceSelect } from "./autocomplete.js";
console.log('Loaded w_ship_to_sheet.js');
// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
let autocomplete;
let autocomplete2;
// Initialize Google Places Autocomplete
const initializeAutocomplete = async () => {
    if (tabListHeader?.querySelector('.active')?.dataset.menuItem === 'TABPAGE_1') {
        console.log('Initializing Autocomplete');
        // Autocomplete for Address Name
        autocomplete = await AutocompleteElement('[id*="address_name"]');
        if (autocomplete) {
            google.maps.event.addListener(autocomplete, 'place_changed', () => {
                handlePlaceSelect(autocomplete, '[id*=shipto]', true);
            });
        }
        // Autocomplete for Address1
        autocomplete2 = await AutocompleteElement('[id*="address1"]');
        if (autocomplete2) {
            google.maps.event.addListener(autocomplete2, 'place_changed', () => {
                handlePlaceSelect(autocomplete2, '[id*=shipto]', false);
            });
        }
    }
};
// Initialize Functions
initializeAutocomplete();
// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
    setTimeout(() => initializeAutocomplete(), 250);
});
