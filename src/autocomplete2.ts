// Fix for TypeScript: declare window.initMap
declare global {
  interface Window {
    initMap: () => void;
  }
}

interface PlaceDetails {
  name?: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
}

/**
 * Get the Google Maps API key from localStorage
 */
export const getGoogleMapsApiKey = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const apiKey = localStorage.getItem('gatorPlacesApiKey');
      if (apiKey && apiKey.trim()) {
        resolve(apiKey);
      } else {
        reject(new Error('Google Maps API key not found in localStorage'));
      }
    } catch (err) {
      reject(new Error('Error accessing localStorage: ' + (err instanceof Error ? err.message : String(err))));
    }
  });
};

/**
 * Fetch autocomplete predictions from Google Places REST API
 */
async function fetchPredictions(input: string, apiKey: string): Promise<Array<{ description: string; place_id: string }>> {
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${encodeURIComponent(apiKey)}&components=country:us`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Autocomplete API error: ${res.status}`);

  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Autocomplete API error: ${data.status} - ${data.error_message || ''}`);
  }

  return data.predictions || [];
}

/**
 * Fetch place details from Google Places REST API
 */
async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${encodeURIComponent(apiKey)}&fields=address_component,name`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place Details API error: ${res.status}`);

  const data = await res.json();

  if (data.status !== 'OK') {
    console.error('Place Details API error:', data.status, data.error_message);
    return null;
  }

  const result = data.result;
  if (!result || !result.address_components) return null;

  const place: PlaceDetails = {
    name: result.name ?? '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal_code: '',
  };

  result.address_components.forEach((component: any) => {
    const value = component.short_name;
    if (!component.types) return;

    if (component.types.includes('street_number')) {
      place.address1 = value;
    } else if (component.types.includes('route')) {
      place.address1 = place.address1 ? `${place.address1} ${value}` : value;
    } else if (component.types.includes('subpremise')) {
      place.address2 = value;
    } else if (component.types.includes('locality') || component.types.includes('sublocality_level_1')) {
      place.city = value;
    } else if (component.types.includes('administrative_area_level_1')) {
      place.state = value;
    } else if (component.types.includes('postal_code')) {
      place.postal_code = value;
    }
  });

  return place;
}

/**
 * Update AngularJS form fields inside containerSelector with place data
 */
async function updateAngularFields(containerSelector: string, place: PlaceDetails, includeName: boolean = false) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.warn(`Container ${containerSelector} not found`);
    return;
  }

  for (const [component, value] of Object.entries(place)) {
    if (component === 'name' && !includeName) continue;

    const field = container.querySelector<HTMLInputElement>(`[id$=${component}]:not([disabled])`);
    if (!field) {
      console.warn(`Field for component "${component}" not found.`);
      continue;
    }

    // AngularJS scope
    const angularScope = angular.element(field).scope() as any;
    const fieldName = field.id.split('.')[1];

    await new Promise<void>((resolve) => {
      angularScope.$apply(() => {
        if (angularScope.record) {
          angularScope.record[fieldName] = value;
          console.log(`Updated field "${fieldName}" with value:`, value);
        }
        resolve();
      });
    });

    if (angularScope.onChange) {
      try {
        await angularScope.onChange();
      } catch (err) {
        console.error('Error in onChange handler:', err);
      }
    }
  }
}

/**
 * Setup a custom autocomplete input field with dropdown UI and AngularJS integration
 * @param inputSelector - The input element selector
 * @param containerSelector - The container selector holding the address fields
 * @param includeName - Whether to include the place name in fields
 */
export async function setupCustomAutocomplete(inputSelector: string, containerSelector: string, includeName: boolean = false) {
  const inputEl = document.querySelector<HTMLInputElement>(inputSelector);
  if (!inputEl) {
    console.error(`Input element ${inputSelector} not found`);
    return;
  }
  // Set placeholder text
  inputEl.placeholder = 'Start typing an address...';
  console.log(`Input element ${inputSelector} found`);

  // Load API key
  let apiKey: string;
  try {
    apiKey = await getGoogleMapsApiKey();
  } catch (err) {
    console.error(err);
    return;
  }

  // Create dropdown container
  const dropdown = document.createElement('ul');
  dropdown.style.position = 'absolute';
  dropdown.style.zIndex = '9999';
  dropdown.style.border = '1px solid #ccc';
  dropdown.style.background = '#fff';
  dropdown.style.listStyle = 'none';
  dropdown.style.padding = '0';
  dropdown.style.margin = '0';
  dropdown.style.width = inputEl.offsetWidth + 'px';
  dropdown.style.maxHeight = '250px';
  dropdown.style.overflowY = 'auto';
  dropdown.style.cursor = 'pointer';

  inputEl.parentElement?.appendChild(dropdown);

  let debounceTimer: number | null = null;

  inputEl.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const inputValue = inputEl.value.trim();

    if (!inputValue) {
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = window.setTimeout(async () => {
      try {
        const predictions = await fetchPredictions(inputValue, apiKey);
        dropdown.innerHTML = '';

        if (predictions.length === 0) {
          const noResultItem = document.createElement('li');
          noResultItem.textContent = 'No results found';
          noResultItem.style.padding = '8px';
          dropdown.appendChild(noResultItem);
          return;
        }

        predictions.forEach((prediction) => {
          const item = document.createElement('li');
          item.textContent = prediction.description;
          item.style.padding = '8px';

          item.addEventListener('mousedown', async (e) => {
            // Prevent losing focus before click
            e.preventDefault();

            inputEl.value = prediction.description;
            dropdown.innerHTML = '';

            const place = await fetchPlaceDetails(prediction.place_id, apiKey);
            if (place) {
              await updateAngularFields(containerSelector, place, includeName);
            }
          });

          dropdown.appendChild(item);
        });
      } catch (error) {
        console.error('Autocomplete fetch error:', error);
        dropdown.innerHTML = '';
      }
    }, 300);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (event.target !== inputEl && !dropdown.contains(event.target as Node)) {
      dropdown.innerHTML = '';
    }
  });

  // Optional: prevent form submit on Enter if dropdown visible
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && dropdown.children.length > 0) {
      e.preventDefault();
    }
  });
}
