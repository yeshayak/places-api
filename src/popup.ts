// Handles saving and loading API key from chrome.storage.sync or config.js

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const form = document.getElementById('config-form') as HTMLFormElement;
  const enableBtn = document.getElementById('enable-site-btn') as HTMLButtonElement;

  // Try to load config.js first
  let configLoaded = false;
  try {
    // Dynamic import of config.js (must use default export or named export)
    const configModule = await import(chrome.runtime.getURL('config.js'));
    const config = configModule.default || configModule;
    if (config && config.GOOGLE_MAPS_API_KEY) {
      apiKeyInput.value = config.GOOGLE_MAPS_API_KEY;
      apiKeyInput.disabled = true;
      form.querySelector('button')!.setAttribute('disabled', 'true');
      statusDiv.textContent = 'Loaded from config.js';
      configLoaded = true;
      form.style.display = 'none'; // Hide the form if config.js is present
    }
  } catch (e) {
    // config.js not found, fall back to chrome.storage
    form.style.display = '';
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (result.apiKey) apiKeyInput.value = result.apiKey;
    });
  }

  if (!configLoaded) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const apiKey = apiKeyInput.value.trim();
      chrome.storage.sync.set({ apiKey }, () => {
        statusDiv.textContent = 'Settings saved!';
        setTimeout(() => (statusDiv.textContent = ''), 2000);
      });
    });
  }

  // Enable on this site button logic
  enableBtn?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    const url = new URL(tab.url);
    const origin = url.origin + '/*';
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      if (granted) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js'],
        });
        statusDiv.textContent = 'Enabled on this site!';
        setTimeout(() => (statusDiv.textContent = ''), 2000);
      } else {
        statusDiv.textContent = 'Permission not granted.';
        setTimeout(() => (statusDiv.textContent = ''), 2000);
      }
    });
  });
});
