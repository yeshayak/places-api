/// <reference types="angular" />
import { duplicateCheck } from './utils/duplicateCheck';

interface CustomScope extends ng.IScope {
  record: Record<string, string>;
  onChange(): Promise<void>;
}

// Initialize Google Places Autocomplete
export const AutocompleteElement = async (inputSelector: string): Promise<google.maps.places.Autocomplete | null> => {
  const autocompleteInput = document.querySelector<HTMLInputElement>(inputSelector);

  if (!autocompleteInput) {
    console.error(`Input element not found for selector: ${inputSelector}`);
    return null;
  }

  const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
    componentRestrictions: { country: 'us' },
    fields: ['address_components', 'formatted_address', 'name'],
  });

  autocompleteInput.onfocus = () => {
    autocompleteInput.autocomplete = 'new-password';
  };

  console.log(`Autocomplete initialized for input: ${inputSelector}`);
  return autocomplete;
};

// Handle Place Selection
export const handlePlaceSelect = async (autocomplete: google.maps.places.Autocomplete, addressFields: string, includeName: boolean): Promise<void> => {
  if (!autocomplete) {
    console.error('Autocomplete is not initialized.');
    return;
  }

  const addressObject = autocomplete.getPlace();
  if (!addressObject) {
    console.error('No place selected.');
    return;
  }

  const place: Place = {
    name: addressObject.name,
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal_code: '',
  };

  // Extract address components
  addressObject.address_components?.forEach((component) => {
    if (component.types.includes('street_number')) place.address1 = `${component.short_name}`;
    if (component.types.includes('route')) place.address1 += ` ${component.short_name}`;
    if (component.types.includes('subpremise')) place.address2 = component.short_name;
    if (component.types.includes('locality')) place.city = component.short_name;
    if (component.types.includes('sublocality_level_1')) place.city = component.short_name;
    if (component.types.includes('administrative_area_level_1')) place.state = component.short_name;
    if (component.types.includes('postal_code')) place.postal_code = component.short_name;
  });
  console.log('Selected Place:', place);

  // Update Angular fields
  for (const component in place) {
    if (component === 'name' && !includeName) continue; // Skip updating name if includeName is false

    const fieldElement = document.querySelector(addressFields)?.querySelector(`[id$=${component}]`);

    if (!fieldElement) {
      console.warn(`Field for component "${component}" not found.`);
      continue;
    }

    const id = fieldElement.id;
    const fieldName = id.split('.')[1];

    const angularScope = angular.element(fieldElement).scope() as CustomScope;
    const value = place[component as keyof Place];

    if (value !== undefined) {
      angularScope.$apply(() => {
        if (angularScope.record) {
          angularScope.record[fieldName] = value;
          console.log(`Updated field "${fieldName}" with value:`, value);
        }
      });
    }

    try {
      await angularScope.onChange();
    } catch (error) {
      console.error(`Error updating field "${fieldName}":`, error);
    }
  }

  // Check for duplicates if address1 is updated
  if (place.address1) {
    duplicateCheck(place.address1);
  }
};
