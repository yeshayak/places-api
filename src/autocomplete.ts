/// <reference types="angular" />
/// <reference types="google.maps" />

import { duplicateCheck } from './utils/duplicateCheck';
import { loadGoogleMaps } from './utils/loadMap';
import { updateAddressFields, getP21Value, type P21AddressUpdateValue } from './p21-data-endpoint';

const autocompleteInstances = new WeakMap<HTMLInputElement, google.maps.places.Autocomplete>();
let isProcessingSelection = false;

/**
 * Initialize Google Places Autocomplete using the legacy Autocomplete API.
 * @param inputSelector - The CSS selector for the input element
 * @returns Promise resolving to the Autocomplete instance or null
 */
export const AutocompleteElement = async (inputSelector: string): Promise<google.maps.places.Autocomplete | null> => {
  try {
    // Wait for Google Maps API to be loaded
    await loadGoogleMaps();

    const autocompleteInput = await waitForElement<HTMLInputElement>(inputSelector, 1000);
    if (!autocompleteInput) {
      console.error(`Input element not found for selector: ${inputSelector}`);
      return null;
    }

    const existingAutocomplete = autocompleteInstances.get(autocompleteInput);
    if (existingAutocomplete) {
      console.log(`Autocomplete instance already exists for input: ${inputSelector}`);
      return existingAutocomplete;
    }

    const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'name', 'geometry.location', 'place_id'],
    });

    // Store the instance
    autocompleteInstances.set(autocompleteInput, autocomplete);
    console.log(`[P21 EXT] Autocomplete initialized for: ${inputSelector}`);
    return autocomplete;
  } catch (error) {
    console.error('Error initializing Places Autocomplete:', error);
    return null;
  }
};

const waitForElement = <T extends Element>(selector: string, timeoutMs: number): Promise<T | null> => {
  const existingElement = findUsableElement<T>(selector);
  if (existingElement) {
    return Promise.resolve(existingElement);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(findUsableElement<T>(selector));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const element = findUsableElement<T>(selector);
      if (!element) return;

      window.clearTimeout(timeout);
      observer.disconnect();
      resolve(element);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
};

const findUsableElement = <T extends Element>(selector: string): T | null => {
  const elements = document.querySelectorAll<T>(selector);
  return Array.from(elements).find(isUsableElement) ?? null;
};

const isUsableElement = (element: Element): boolean => {
  if (element instanceof HTMLInputElement && element.disabled) return false;
  return element.isConnected && element.getClientRects().length > 0;
};

/**
 * Handle place selection from the legacy Autocomplete widget
 * @param autocomplete - The Autocomplete instance
 * @param addressFields - The selector for address fields container
 * @param includeName - Whether to include the place name
 */
export const handlePlaceSelect = async (autocomplete: google.maps.places.Autocomplete, addressFields: string, includeName: boolean): Promise<void> => {
  if (!autocomplete) {
    console.error('[P21 EXT] handlePlaceSelect called without an autocomplete instance.');
    return;
  }

  if (isProcessingSelection) {
    console.warn('[P21 EXT] Autocomplete selection already in progress. Ignoring duplicate trigger.');
    return;
  }

  try {
    isProcessingSelection = true;
    const addressObject = await autocomplete.getPlace();
    if (!addressObject || !addressObject.address_components) {
      console.error('Invalid place selection.');
      return;
    }

    const place: P21AddressUpdateValue = {
      name: addressObject.name ?? '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postal_code: '',
    };

    addressObject.address_components.forEach((component: google.maps.GeocoderAddressComponent) => {
      const value = component.short_name;

      switch (true) {
        case component.types.includes('street_number'):
          place.address1 = value;
          break;
        case component.types.includes('route'):
          place.address1 = place.address1 ? `${place.address1} ${value}` : value;
          break;
        case component.types.includes('subpremise'):
          place.address2 = value;
          break;
        case component.types.includes('locality'):
        case component.types.includes('sublocality_level_1'):
          place.city = value;
          break;
        case component.types.includes('administrative_area_level_1'):
          place.state = value;
          break;
        case component.types.includes('postal_code'):
          place.postal_code = value;
          break;
      }
    });

    console.log('Selected Place:', place);

    const updateResult = await updateAddressFields(addressFields, place, includeName);
    if (!updateResult.ok) {
      console.error('P21 data endpoint address update failed:', updateResult);
      return;
    }

    // Check for duplicates if address1 is updated
    // Only run duplicate check if a customer ID is present in the current context
    if (place.address1 && getP21Value('customer_id')) {
      await duplicateCheck(place.address1);
    }
  } catch (error) {
    console.error('Error handling place selection:', error);
  } finally {
    isProcessingSelection = false;
  }
};
