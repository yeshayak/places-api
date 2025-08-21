window.addEventListener('message', function (event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'GATOR_API_KEY' && event.data.apiKey) {
    try {
      localStorage.setItem('gatorPlacesApiKey', event.data.apiKey);
      console.log('[Ext] API key successfully saved to localStorage');
    } catch (error) {
      console.error('[Ext] Error saving API key:', error);
    }
  }
});
