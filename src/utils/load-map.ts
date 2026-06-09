/// <reference types="google.maps" />
// Fix for TypeScript: declare window.initMap
declare global {
  interface Window {
    initMap: () => void;
    google: any;
  }
}

let loadPromise: Promise<void> | null = null;

/**
 * Load Google Maps API and return a promise that resolves when it's ready.
 */
export const loadGoogleMaps = (apiKey: string): Promise<void> => {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  if (!apiKey.trim()) {
    return Promise.reject(new Error('Google Maps API key is required'));
  }

  loadPromise = new Promise((resolve, reject) => {
    // Note: We no longer include 'libraries: places' here because
    // we use google.maps.importLibrary('places') in the sandbox.
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: apiKey,
      v: 'beta',
      loading: 'async',
      callback: 'initMap',
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-gmaps-loader', 'true');

    window.initMap = () => {
      console.log('Google Maps API loaded successfully');
      resolve();
    };

    script.onerror = () => {
      loadPromise = null; // Allow retry on failure
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
};
