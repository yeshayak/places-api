/// <reference types="google.maps" />
// Fix for TypeScript: declare window.initMap
declare global {
  interface Window {
    initMap: () => void;
    google: any;
  }
}

/**
 * Get the Google Maps API key from localStorage
 * Returns a Promise that resolves to the API key string, or rejects if not found.
 */
export const getGoogleMapsApiKey = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 1. Try LocalStorage (Authoritative for P21 Page Context)
      const apiKey = localStorage.getItem('gatorPlacesApiKey');
      if (apiKey && apiKey.trim()) {
        resolve(apiKey);
        return;
      }

      // 2. Try Chrome Storage (Fallback for Extension/Sandbox Context)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['apiKey'], (result) => {
          if (result.apiKey && result.apiKey.trim()) {
            resolve(result.apiKey);
          } else {
            reject(new Error('Google Maps API key not found in storage.'));
          }
        });
        return;
      }

      reject(new Error('Google Maps API key not found.'));
    } catch (err) {
      reject(new Error('Error accessing localStorage: ' + (err instanceof Error ? err.message : String(err))));
    }
  });
};

/**
 * Load Google Maps API and return a promise that resolves when it's ready.
 */
export const loadGoogleMaps = (apiKeyOverride?: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    let apiKey: string;
    if (apiKeyOverride) {
      apiKey = apiKeyOverride;
    } else {
      try {
        apiKey = await getGoogleMapsApiKey();
      } catch (err) {
        reject(new Error('Failed to get Google Maps API key: ' + (err instanceof Error ? err.message : String(err))));
        return;
      }
    }

    if (document.querySelector('script[data-gmaps-loader]')) {
      let attempts = 0;
      const maxAttempts = 100;
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Timed out waiting for Google Maps API to load'));
        } else {
          attempts++;
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async&callback=initMap`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-gmaps-loader', 'true');

    window.initMap = () => {
      console.log('Google Maps API loaded successfully');
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });
};
