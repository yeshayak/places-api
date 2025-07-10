// Handles saving and loading API key and base URL from chrome.storage.sync

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const form = document.getElementById('config-form') as HTMLFormElement;

  // Load saved values
  chrome.storage.sync.get(['apiKey', 'baseUrl'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.baseUrl) baseUrlInput.value = result.baseUrl;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    const baseUrl = baseUrlInput.value.trim();
    chrome.storage.sync.set({ apiKey, baseUrl }, () => {
      statusDiv.textContent = 'Settings saved!';
      setTimeout(() => (statusDiv.textContent = ''), 2000);
    });
  });
});
