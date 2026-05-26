import { AutocompleteElement, handlePlaceSelect } from './autocomplete';
import type { P21DesignResponse } from './utils/p21-session';
import { trackActiveContext } from './p21-data-endpoint';

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
  TAB_HEADER: '#p21TabsetDir ul',
  ADDRESS_NAME_INPUT: '[id*="address_name"]',
  ADDRESS1_INPUT: '[id*="address1"]',
  CONTAINER: '[id*=shipto]',
};

const state = {
  autocompleteAddressName: null as google.maps.places.Autocomplete | null,
  autocompleteAddressNameListener: null as google.maps.MapsEventListener | null,
  autocompleteAddress1: null as google.maps.places.Autocomplete | null,
  autocompleteAddress1Listener: null as google.maps.MapsEventListener | null,
  isInitializing: false,
};

// Initialize Google Places Autocomplete
const initializeAutocomplete = async (retryCount = 0): Promise<void> => {
  if (state.isInitializing && retryCount === 0) return;

  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  const isTabPage1Active = activeTab?.dataset.menuItem === 'TABPAGE_1';

  if (isTabPage1Active) {
    state.isInitializing = true;
    console.log(`${LOG_PREFIX} Initializing Autocomplete for Ship To Sheet.`);

    // Autocomplete for Address Name
    if (state.autocompleteAddressNameListener) {
      google.maps.event.removeListener(state.autocompleteAddressNameListener);
      state.autocompleteAddressNameListener = null;
    }
    state.autocompleteAddressName = await AutocompleteElement(SELECTORS.ADDRESS_NAME_INPUT);
    if (state.autocompleteAddressName) {
      state.autocompleteAddressNameListener = google.maps.event.addListener(state.autocompleteAddressName, 'place_changed', () => {
        if (state.autocompleteAddressName) {
          handlePlaceSelect(state.autocompleteAddressName, SELECTORS.CONTAINER, true);
        }
      });

      console.log(`${LOG_PREFIX} Autocomplete (Address Name): Place changed listener attached.`);
    } else {
      console.warn(`${LOG_PREFIX} Autocomplete (Address Name): Could not initialize for input: ${SELECTORS.ADDRESS_NAME_INPUT}.`);
      state.autocompleteAddressName = null;
      state.autocompleteAddressNameListener = null;
    }

    // Autocomplete for Address1
    if (state.autocompleteAddress1Listener) {
      google.maps.event.removeListener(state.autocompleteAddress1Listener);
      state.autocompleteAddress1Listener = null;
    }
    state.autocompleteAddress1 = await AutocompleteElement(SELECTORS.ADDRESS1_INPUT);
    if (state.autocompleteAddress1) {
      state.autocompleteAddress1Listener = google.maps.event.addListener(state.autocompleteAddress1, 'place_changed', () => {
        if (state.autocompleteAddress1) {
          handlePlaceSelect(state.autocompleteAddress1, SELECTORS.CONTAINER, false);
        }
      });

      console.log(`${LOG_PREFIX} Autocomplete (Address1): Place changed listener attached.`);
    } else {
      if (retryCount < 5) {
        setTimeout(() => initializeAutocomplete(retryCount + 1), 200);
        return;
      }
      console.warn(`${LOG_PREFIX} Autocomplete (Address1): Failed after retries.`);
    }
    state.isInitializing = false;
  }
};

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; url: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  trackActiveContext(response, detail.url);

  // Assuming 'TABPAGE_1' is the relevant tab for ship to sheet address fields
  const isTabPage1Related = response?.Result?.TabDefinition?.UniqueName === 'TABPAGE_1' || response?.Events?.some((e) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'TABPAGE_1');

  if (isTabPage1Related) {
    setTimeout(() => initializeAutocomplete(), 100);
  }
});

// Initialize Functions
initializeAutocomplete();

// Add Event Listeners
document.querySelector(SELECTORS.TAB_HEADER)?.addEventListener('click', () => {
  setTimeout(() => initializeAutocomplete(), 250);
});
