// Handles saving and loading API key from extension storage and requesting site permissions
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const form = document.getElementById('config-form') as HTMLFormElement;
  const enableBtn = document.getElementById('enable-site-btn') as HTMLButtonElement | null;
  const enabledMsg = document.getElementById('site-enabled-msg') as HTMLElement | null;
  const enableContainer = document.getElementById('site-enable-container') as HTMLElement | null;
  const togglePassword = document.getElementById('togglePassword') as HTMLButtonElement;

  const featureToggles = {
    address: document.getElementById('feat-address') as HTMLInputElement,
    payment: document.getElementById('feat-payment') as HTMLInputElement,
    cost: document.getElementById('feat-cost') as HTMLInputElement,
    one_time_price: document.getElementById('feat-one-time-price') as HTMLInputElement,
  };

  // Load saved API key from chrome.storage.local (authoritative)
  chrome.storage.local.get(['apiKey', 'feat_address', 'feat_payment', 'feat_cost', 'feat_one_time_price'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;

    // Default features to true if not set
    featureToggles.address.checked = result.feat_address !== false;
    featureToggles.payment.checked = result.feat_payment !== false;
    featureToggles.cost.checked = result.feat_cost !== false;
    featureToggles.one_time_price.checked = result.feat_one_time_price !== false;
  });

  // Auto-save features on toggle change
  const saveFeatures = () => {
    const settings = {
      feat_address: featureToggles.address.checked,
      feat_payment: featureToggles.payment.checked,
      feat_cost: featureToggles.cost.checked,
      feat_one_time_price: featureToggles.one_time_price.checked,
    };
    chrome.storage.local.set(settings);

    statusDiv.textContent = 'Updating features...';
    statusDiv.style.color = '#1976d2';
    setTimeout(() => (statusDiv.textContent = ''), 1000);
  };

  Object.values(featureToggles).forEach((toggle) => {
    toggle.addEventListener('change', saveFeatures);
  });

  // Handle password visibility toggle
  togglePassword?.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
  });

  /**
   * Updates the visibility of the "Enable site" UI based on current permissions.
   */
  const updatePermissionUI = (url?: string) => {
    if (!url || !url.startsWith('http')) {
      if (enableContainer) enableContainer.classList.add('hide');
      return;
    }

    try {
      const origin = new URL(url).origin + '/*';
      chrome.permissions.contains({ origins: [origin] }, (granted) => {
        if (granted) {
          enableBtn?.classList.add('hide');
          enabledMsg?.style.setProperty('display', 'block');
        } else {
          enableBtn?.classList.remove('hide');
          enabledMsg?.style.setProperty('display', 'none');
        }
        enableContainer?.classList.remove('hide');
      });
    } catch (e) {
      if (enableContainer) enableContainer.classList.add('hide');
    }
  };

  // Check initial permission state for the active tab context
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) updatePermissionUI(tabs[0].url);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    const settings = {
      apiKey,
      feat_address: featureToggles.address.checked,
      feat_payment: featureToggles.payment.checked,
      feat_cost: featureToggles.cost.checked,
      feat_one_time_price: featureToggles.one_time_price.checked,
    };

    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Error saving key.';
        statusDiv.style.color = 'red';
        return;
      }

      statusDiv.textContent = 'Settings saved!';
      statusDiv.style.color = 'green';
      setTimeout(() => (statusDiv.textContent = ''), 2000);
    });
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
              updatePermissionUI(url);
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
