/// <reference types="google.maps" />
import { loadGoogleMaps } from './utils/load-map';

/**
 * This script runs inside the extension iframe.
 * It handles the Google Places interaction and sends data back to the P21 page.
 */
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'INIT_SANDBOX' && event.data.apiKey) {
    await initAutocomplete(event.data.apiKey, event.data.initialValue);
  }
});

/**
 * Initializes the modern Google Places Autocomplete element and sets up event listeners.
 * @param apiKey - The Google Maps API key provided by the parent window.
 */
async function initAutocomplete(apiKey: string, initialValue?: string): Promise<void> {
  await loadGoogleMaps(apiKey);

  // Import the modern Places library
  const { PlaceAutocompleteElement } = (await google.maps.importLibrary('places')) as any;

  const container = document.querySelector<HTMLElement>('.container');
  const oldInput = document.getElementById('autocomplete-input');

  // Create the modern input element using the class constructor
  const autocompleteElement = new PlaceAutocompleteElement();
  autocompleteElement.restrictions = { country: 'us' };

  if (oldInput) {
    oldInput.replaceWith(autocompleteElement);
  } else {
    container?.appendChild(autocompleteElement);
  }

  // If an initial value was provided, inject it into the internal input of the web component
  if (initialValue) {
    let attempts = 0;
    const injectValue = () => {
      const internalInput = (autocompleteElement as any).shadowRoot?.querySelector('input');
      if (internalInput) {
        internalInput.value = initialValue;
        // Trigger input event so the Google component acknowledges the value change
        internalInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Focus the input to prepare for user interaction
        internalInput.focus();
      } else if (attempts < 10) {
        attempts++;
        setTimeout(injectValue, 100);
      }
    };

    setTimeout(injectValue, 200);
  }

  // Shift focus from the old placeholder to the new Google component.
  // We use a small timeout to ensure the component is connected and ready.
  setTimeout(() => autocompleteElement.focus(), 50);

  console.log('[Sandbox] PlaceAutocompleteElement attached to DOM.');

  // Modern API uses the gmp-select event
  autocompleteElement.addEventListener('gmp-select', async (event: { placePrediction: any }) => {
    const { placePrediction } = event;

    if (!placePrediction) {
      console.warn('[Sandbox] Selection event fired without placePrediction data.');
      return;
    }

    // Convert the prediction to a Place object
    const place = placePrediction.toPlace();

    console.log('[Sandbox] Selection confirmed. Fetching place details...', place.id);

    try {
      await place.fetchFields({
        fields: ['id', 'addressComponents', 'displayName', 'formattedAddress', 'types'],
      });
    } catch (error) {
      console.error('[Sandbox] Failed to fetch place details:', error);
      return;
    }

    if (!place.addressComponents) {
      console.warn('[Sandbox] No address components found after fetchFields');
      return;
    }

    const addressData = {
      name: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postal_code: '',
    };

    let streetNumber = '';
    let route = '';
    let premise = '';

    // Note: Modern components use camelCase properties (shortText, longText)
    place.addressComponents.forEach((c: any) => {
      const val = c.shortText;
      const types = c.types as string[];

      if (types.includes('street_number')) {
        streetNumber = val;
      } else if (types.includes('route')) {
        route = val;
      } else if (types.includes('premise')) {
        premise = val;
      } else if (types.includes('subpremise')) {
        addressData.address2 = val;
      } else if (types.includes('locality') || types.includes('sublocality_level_1')) {
        addressData.city = val;
      } else if (types.includes('administrative_area_level_1')) {
        addressData.state = val;
      } else if (types.includes('postal_code')) {
        addressData.postal_code = val;
      }
    });

    // Construct Address1: Prioritize Street Number + Route. Fallback to Premise.
    const streetAddress = [streetNumber, route].filter(Boolean).join(' ');
    addressData.address1 = streetAddress || premise || '';

    // Construct Name: Use displayName if available, otherwise use Address1
    const establishmentName = place.displayName?.text || (typeof place.displayName === 'string' ? place.displayName : '');
    addressData.name = establishmentName || addressData.address1;

    console.log('[Sandbox] Sending address data back to P21:', addressData);

    // Send message back to the parent window (Content Script)
    window.parent.postMessage(
      {
        type: 'P21_PLACE_SELECTED',
        place: addressData,
      },
      '*',
    );
  });
}
