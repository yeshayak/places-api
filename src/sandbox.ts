import { loadGoogleMaps } from './utils/loadMap';

/**
 * This script runs inside the extension iframe.
 * It handles the Google Places interaction and sends data back to the P21 page.
 */
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'INIT_SANDBOX' && event.data.apiKey) {
    await initAutocomplete(event.data.apiKey);
  }
});

/**
 * Initializes the modern Google Places Autocomplete element and sets up event listeners.
 * @param apiKey - The Google Maps API key provided by the parent window.
 */
async function initAutocomplete(apiKey: string): Promise<void> {
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
        fields: ['addressComponents', 'displayName', 'formattedAddress'],
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
      name: place.displayName?.text || place.formattedAddress || '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postal_code: '',
    };

    // Note: Modern components use camelCase properties (shortText, longText)
    place.addressComponents.forEach((c: any) => {
      const val = c.shortText;
      const types = c.types as string[];

      if (types.includes('street_number')) {
        addressData.address1 = val;
      } else if (types.includes('route')) {
        addressData.address1 = addressData.address1 ? `${addressData.address1} ${val}` : val;
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
