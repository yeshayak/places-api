import {} from './context-manager';
import { findAnchorInput } from './address-anchor-discovery';
import { attachDuplicateCheckListeners } from './address-duplicate-listeners';
import { attachSandboxLauncher, openSandbox } from './address-sandbox-launcher';
import { ADDR1_REGEX, ADDR_NAME_REGEX, getContainerSelector, isFieldEnabled } from './p21-data-endpoint';
import { getActiveContext, getDataWindowSchemaCount } from './state-store';
import { isAddressContextActive } from './active-address-context';
import { isFeatureEnabled } from './feature-flags';
import type { P21DataContextUpdatedDetail } from './types/p21-types';

interface AddressAutocompleteWindow extends Window {
  __p21AddressHotkeyBound?: boolean;
  __p21AddressAutocompleteListenersInstalled?: boolean;
}

const LOG_PREFIX = '[P21 EXT]';
const addressWindow = window as AddressAutocompleteWindow;

let isInitializingUI = false;
let discoveryTimeout: number | null = null;
let lastTabName: string | undefined = undefined;

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';

/**
 * Global discovery: finds address-related inputs and attaches search launchers.
 */
const discoverAndAttachAddressUI = (retryCount = 0): void => {
  if (discoveryTimeout) window.clearTimeout(discoveryTimeout);
  if (!isFeatureEnabled('address')) return;

  // Always attempt to attach duplicate check listeners, bypassing the identity cache
  attachDuplicateCheckListeners();

  const currentIdentity = getCurrentIdentity();
  if (retryCount === 0 && currentIdentity && currentIdentity === lastTabName) {
    return;
  }

  discoveryTimeout = window.setTimeout(() => runAddressDiscovery(currentIdentity, retryCount), retryCount > 0 ? 300 : 200);
};

const getCurrentIdentity = (): string | undefined => {
  const { tabName, p21TabId, dataWindow } = getActiveContext();
  return p21TabId || tabName || dataWindow;
};

const runAddressDiscovery = (currentIdentity: string | undefined, retryCount: number): void => {
  if (isInitializingUI) {
    discoveryTimeout = null;
    return;
  }

  try {
    isInitializingUI = true;
    logContextIdentity(currentIdentity);
    lastTabName = currentIdentity;
    attachDuplicateCheckListeners();

    const context = getActiveContext();
    const schemaCount = getDataWindowSchemaCount();
    const canAttach = isAddressContextActive() || (schemaCount === 0 && Boolean(context.windowName));
    const anchor = findAnchorInput(context);

    if (anchor && canAttach) {
      attachLaunchersForAnchor(anchor);
      return;
    }

    if (canAttach && retryCount < 8) {
      window.setTimeout(() => discoverAndAttachAddressUI(retryCount + 1), 300);
    }
  } finally {
    isInitializingUI = false;
    discoveryTimeout = null;
  }
};

const logContextIdentity = (currentIdentity: string | undefined): void => {
  if (isDebugEnabled() && currentIdentity !== lastTabName) {
    console.log(`${LOG_PREFIX} UI Context identity initiated: "${currentIdentity}"`);
  }
};

const attachLaunchersForAnchor = (anchor: HTMLElement): void => {
  if (anchor.dataset.sandboxAttached) return;

  const container = getContainerSelector(anchor);
  const containerElement = (container ? document.querySelector(container) : null) || document;

  // Case 1: The anchor is an address field, but not a 'name' field.
  if (!ADDR_NAME_REGEX.test(anchor.id)) {
    // Attach launcher, which will default to using the anchor's own value.
    attachSandboxLauncher(anchor as HTMLInputElement, container, false);
    return;
  }

  // Case 2: The anchor is a 'name' field. Attach launchers to both 'name' and 'address1'.
  const nameInput = anchor as HTMLInputElement;
  const addr1 = findEnabledAddressInput(containerElement);
  if (!addr1) return;

  attachSandboxLauncher(nameInput, container, true);
  attachSandboxLauncher(addr1, container, false);
};

const findEnabledAddressInput = (containerElement: ParentNode): HTMLInputElement | undefined => {
  return Array.from(containerElement.querySelectorAll('input')).find((input) => ADDR1_REGEX.test(input.id) && isFieldEnabled(input) && input.isConnected && input.getClientRects().length > 0);
};

const bindAddressHotkey = (): void => {
  if (addressWindow.__p21AddressHotkeyBound) return;

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.altKey && event.key.toLowerCase() === 'a') {
      if (!isFeatureEnabled('address')) return;

      const anchor = findAnchorInput();
      if (anchor) {
        event.preventDefault();
        const container = getContainerSelector(anchor);
        openSandbox(container, !anchor.id.toLowerCase().includes('address1'), (anchor as HTMLInputElement).value);
      }
    }
  });

  addressWindow.__p21AddressHotkeyBound = true;
};

export const installAddressAutocomplete = (): void => {
  if (addressWindow.__p21AddressAutocompleteListenersInstalled) return;
  addressWindow.__p21AddressAutocompleteListenersInstalled = true;

  bindAddressHotkey();

  window.addEventListener('p21-ext:transaction-reset', () => {
    lastTabName = undefined;
  });

  window.addEventListener('p21-ext:data-context-updated', (event) => {
    // Feature executes based on context update, decoupled from URL monitoring
    const { isAddressRelated, isStructuralRescan } = (event as CustomEvent<P21DataContextUpdatedDetail>).detail;

    if (isAddressRelated || isStructuralRescan) {
      discoverAndAttachAddressUI(isStructuralRescan ? 1 : 0);
    }
  });

  window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
    // Ensure action detail and name are not empty before triggering UI discovery
    if (!event.detail || !event.detail.name) return;

    const { name } = event.detail;
    if (name?.includes('selectionchanged')) {
      discoverAndAttachAddressUI();
    }
  });

  // Initial scan to catch fields already present when the script loads
  discoverAndAttachAddressUI();
};
