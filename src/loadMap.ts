declare global {
  interface Window {
    initMap: () => void;
    google: typeof google;
  }
}

import { GOOGLE_MAPS_API_KEY } from './config';

/**
 * Load Google Maps API and return a promise that resolves when it's ready
 */
export const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    // Create the script tag
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;

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

// Auto-load when this module is imported
loadGoogleMaps().catch((error) => {
  console.error('Error loading Google Maps API:', error);
});
