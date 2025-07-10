/// <reference types="angular" />
/// <reference types="google.maps" />
import { duplicateCheck } from "./utils/duplicateCheck.js";
import { loadGoogleMaps } from "./loadMap.js";
/**
 * Initialize Google Places Autocomplete with the new Places API
 * @param inputSelector - The CSS selector for the input element
 * @returns Promise resolving to the Autocomplete instance or null
 */
export const AutocompleteElement = async (inputSelector) => {
    try {
        // Wait for Google Maps API to be loaded
        await loadGoogleMaps();
        const autocompleteInput = document.querySelector(inputSelector);
        if (!autocompleteInput) {
            console.error(`Input element not found for selector: ${inputSelector}`);
            return null;
        }
        const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
            componentRestrictions: { country: 'us' },
            fields: ['address_components', 'formatted_address', 'name', 'geometry.location', 'place_id'],
        });
        // Prevent form submission on enter
        autocompleteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
        // Disable browser's autofill
        autocompleteInput.setAttribute('autocomplete', 'new-password');
        console.log(`Autocomplete initialized for input: ${inputSelector}`);
        return autocomplete;
    }
    catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
        return null;
    }
};
/**
 * Handle place selection from the Autocomplete widget
 * @param autocomplete - The Autocomplete instance
 * @param addressFields - The selector for address fields container
 * @param includeName - Whether to include the place name
 */
export const handlePlaceSelect = async (autocomplete, addressFields, includeName) => {
    if (!autocomplete) {
        console.error('Autocomplete is not initialized.');
        return;
    }
    try {
        const addressObject = await autocomplete.getPlace();
        if (!addressObject || !addressObject.address_components) {
            console.error('Invalid place selection.');
            return;
        }
        const place = {
            name: addressObject.name ?? '',
            address1: '',
            address2: '',
            city: '',
            state: '',
            postal_code: '',
        };
        // Extract address components using the new API format
        addressObject.address_components.forEach((component) => {
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
        // Update Angular fields
        for (const [component, value] of Object.entries(place)) {
            if (component === 'name' && !includeName)
                continue;
            const fieldElement = document.querySelector(addressFields)?.querySelector(`[id$=${component}]:not([disabled])`);
            if (!fieldElement) {
                console.warn(`Field for component "${component}" not found.`);
                continue;
            }
            const fieldName = fieldElement.id.split('.')[1];
            const angularScope = angular.element(fieldElement).scope();
            try {
                await new Promise((resolve) => {
                    angularScope.$apply(() => {
                        if (angularScope.record) {
                            angularScope.record[fieldName] = value;
                            console.log(`Updated field "${fieldName}" with value:`, value);
                        }
                        resolve();
                    });
                });
                await angularScope.onChange();
            }
            catch (error) {
                console.error(`Error updating field "${fieldName}":`, error);
            }
        }
        // Check for duplicates if address1 is updated
        if (place.address1) {
            await duplicateCheck(place.address1);
        }
    }
    catch (error) {
        console.error('Error handling place selection:', error);
    }
};
