// Handles saving and loading API key from chrome.storage.sync and requesting site permissions

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const form = document.getElementById('config-form') as HTMLFormElement;
  const enableBtn = document.getElementById('enable-site-btn') as HTMLButtonElement | null;


  // Load saved API key from localStorage
  const storedKey = localStorage.getItem('gatorPlacesApiKey');
  if (storedKey) apiKeyInput.value = storedKey;


  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    chrome.runtime.sendMessage({ type: 'STORE_KEY', apiKey });
    try {
      localStorage.setItem('gatorPlacesApiKey', apiKey);
      statusDiv.textContent = 'Settings saved!';
      setTimeout(() => (statusDiv.textContent = ''), 2000);
    } catch (err) {
      statusDiv.textContent = 'Error saving key.';
      statusDiv.style.color = 'red';
    }
  });

  // Handle "Enable on this site" button click to request host permissions
  if (enableBtn) {
    enableBtn.addEventListener('click', () => {
      if (statusDiv) {
        statusDiv.textContent = 'Requesting permission...';
        statusDiv.style.color = 'black';
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          if (statusDiv) {
            statusDiv.textContent = 'No active tab found.';
            statusDiv.style.color = 'red';
          }
          return;
        }
        const url = tabs[0].url;
        if (!url) {
          if (statusDiv) {
            statusDiv.textContent = 'Unable to get tab URL.';
            statusDiv.style.color = 'red';
          }
          return;
        }
        let origin;
        try {
          origin = new URL(url).origin + '/*';
        } catch (e) {
          if (statusDiv) {
            statusDiv.textContent = 'Invalid URL.';
            statusDiv.style.color = 'red';
          }
          return;
        }
        if (!chrome.permissions) {
          if (statusDiv) {
            statusDiv.textContent = 'chrome.permissions API not available.';
            statusDiv.style.color = 'red';
          }
          return;
        }
        chrome.permissions.request({ origins: [origin] }, (granted) => {
          if (statusDiv) {
            if (granted) {
              statusDiv.textContent = 'Permission granted for this site!';
              statusDiv.style.color = 'green';
            } else {
              statusDiv.textContent = 'Permission denied or already granted.';
              statusDiv.style.color = 'red';
            }
          }
        });
      });
    });
  }
});
