// Fix for TypeScript: declare window.initMap
declare global {
  interface Window {
    initMap: () => void;
  }
}

/**
 * Get the Google Maps API key from localStorage
 * Returns a Promise that resolves to the API key string, or rejects if not found.
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
 * Load Google Maps API and return a promise that resolves when it's ready.
 * This will fetch the API key from the injected page context.
 */
export const loadGoogleMaps = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    let apiKey: string;
    try {
      apiKey = await getGoogleMapsApiKey();
    } catch (err) {
      reject(new Error('Failed to get Google Maps API key: ' + (err instanceof Error ? err.message : String(err))));
      return;
    }

    // Avoid loading the script multiple times
    if (document.querySelector('script[data-gmaps-loader]')) {
      // Wait for the callback to be called
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    // Create the script tag
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-gmaps-loader', 'true');

    // Set up the callback
    window.initMap = () => {
      console.log('Google Maps API loaded successfully');
      resolve();
    };

    // Handle errors
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };

    // Append to head
    document.head.appendChild(script);
  });
};

// Optionally, you can auto-load here if desired, but it's better to let the consumer call loadGoogleMaps()
