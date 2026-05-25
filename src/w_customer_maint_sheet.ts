import { AutocompleteElement, handlePlaceSelect } from './autocomplete';
import type { P21DesignResponse } from './p21-session';
import { trackActiveContext } from './p21-data-endpoint';

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
  TAB_HEADER: '#p21TabsetDir ul',
  CUSTOMER_NAME_INPUT: `[id*='customer_name']`,
  ADDRESS1_INPUT: `[id*='address1']`,
  CONTAINER: '[id*=tp_1_dw_1]',
};

const state = {
  autocompleteCustomerName: null as google.maps.places.Autocomplete | null,
  autocompleteCustomerNameListener: null as google.maps.MapsEventListener | null,
  autocompleteAddress1: null as google.maps.places.Autocomplete | null,
  autocompleteAddress1Listener: null as google.maps.MapsEventListener | null,
};

// Initialize Google Places Autocomplete
const initializeAutoComplete = async (): Promise<void> => {
  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  const isTabPage1Active = activeTab?.dataset.menuItem === 'TABPAGE_1';

  if (isTabPage1Active) {
    console.log(`${LOG_PREFIX} Initializing Autocomplete for Customer Maintenance.`);

    // Autocomplete for Customer Name
    if (state.autocompleteCustomerNameListener) {
      google.maps.event.removeListener(state.autocompleteCustomerNameListener);
      state.autocompleteCustomerNameListener = null;
    }
    state.autocompleteCustomerName = await AutocompleteElement(SELECTORS.CUSTOMER_NAME_INPUT);
    if (state.autocompleteCustomerName) {
      state.autocompleteCustomerNameListener = google.maps.event.addListener(state.autocompleteCustomerName, 'place_changed', () => {
        if (state.autocompleteCustomerName) {
          handlePlaceSelect(state.autocompleteCustomerName, SELECTORS.CONTAINER, true);
        }
      });

      console.log(`${LOG_PREFIX} Autocomplete (Customer Name): Place changed listener attached.`);
    } else {
      console.warn(`${LOG_PREFIX} Autocomplete (Customer Name): Could not initialize for input: ${SELECTORS.CUSTOMER_NAME_INPUT}.`);
      state.autocompleteCustomerName = null;
      state.autocompleteCustomerNameListener = null;
    }

    // Autocomplete for Address
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
      console.warn(`${LOG_PREFIX} Autocomplete (Address1): Could not initialize for input: ${SELECTORS.ADDRESS1_INPUT}.`);
      state.autocompleteAddress1 = null;
      state.autocompleteAddress1Listener = null;
    }
  }
};

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; url: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  trackActiveContext(response, detail.url);

  // Assuming 'TABPAGE_1' is the relevant tab for customer maintenance address fields
  const isTabPage1Related = response?.Result?.TabDefinition?.UniqueName === 'TABPAGE_1' || response?.Events?.some((e) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'TABPAGE_1');

  if (isTabPage1Related) {
    setTimeout(() => initializeAutoComplete(), 100);
  }
});

// Initialize Functions
initializeAutoComplete();

// Add Event Listeners
document.querySelector(SELECTORS.TAB_HEADER)?.addEventListener('click', () => {
  setTimeout(() => initializeAutoComplete(), 250);
});
