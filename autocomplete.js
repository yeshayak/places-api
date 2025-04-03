// Initialize Google Places Autocomplete
export const initializeAutocomplete = async (inputSelector) => {
  const autocompleteInput = document.querySelector(inputSelector);

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
export const handlePlaceSelect = async (autocomplete, addressFields, includeName, root) => {
  if (!autocomplete) {
    console.error('Autocomplete is not initialized.');
    return;
  }

  const addressObject = autocomplete.getPlace();
  if (!addressObject) {
    console.error('No place selected.');
    return;
  }

  const place = {
    name: includeName ? addressObject.name || '' : '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal_code: '',
  };

  // Extract address components
  addressObject.address_components?.forEach((component) => {
    if (component.types.includes('street_number')) place.address1 = `${component.short_name} `;
    if (component.types.includes('route')) place.address1 += `${component.short_name}`;
    if (component.types.includes('subpremise')) place.address2 = component.short_name;
    if (component.types.includes('locality')) place.city = component.short_name;
    if (component.types.includes('sublocality_level_1')) place.city = component.short_name;
    if (component.types.includes('administrative_area_level_1')) place.state = component.short_name;
    if (component.types.includes('postal_code')) place.postal_code = component.short_name;
  });

  console.log('Selected Place:', place);

  // Update Angular fields
  for (const component in place) {
    const fieldElement = document.querySelector(addressFields)?.querySelector(`[id$=${component}]`);

    if (!fieldElement) {
      console.warn(`Field for component "${component}" not found.`);
      continue;
    }

    const id = fieldElement.id;
    const fieldName = id.split('.')[1];

    const angularScope = angular.element(fieldElement).scope();
    angularScope.$apply(() => {
      angularScope.record[fieldName] = place[component];
    });

    try {
      await angularScope.onChange();
    } catch (error) {
      console.error(`Error updating field "${fieldName}":`, error);
    }
  }

  // Check for duplicates if address1 is updated
  if (place.address1 && root?.windowData) {
    checkDuplicates(place.address1, root);
  }
};

// Check for Duplicate Addresses
const checkDuplicates = async (lookupName, root) => {
  const customerId = root.windowData['TABPAGE_1.order'][0]?.customer_id;
  const token = root.userSession?.token;

  if (!customerId || !token) {
    console.error('Customer ID or token is missing.');
    return;
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  try {
    const response = await fetch(`https://p21live.gatorps.com/odataservice/odata/view/ice_ship_to_address?$filter=delete_flag eq 'N' and customer_id eq ${customerId} and contains(phys_address1, '${lookupName}')&$count=true`, {
      method: 'GET',
      headers,
    });
    const result = await response.json();

    if (result.value.length > 0) {
      console.log('Duplicate Ship To:', result.value);
      alert('Duplicate Ship To');
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
  }
};
