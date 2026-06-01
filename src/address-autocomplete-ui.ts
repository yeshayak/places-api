import {} from './context-manager';
import { attachSandboxLauncher, openSandbox } from './address-sandbox-launcher';
import { ADDR1_REGEX, ADDR_NAME_REGEX, getContainerSelector, isFieldEnabled } from './p21-data-endpoint';
import { getActiveContext, getDataWindowSchema, getDataWindowSchemaCount, getP21Value } from './state-store';
import { isAddressContextActive } from './endpoint-router';
import { duplicateCheck } from './utils/duplicate-check';
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
 * Attaches listeners to Address1 fields to trigger duplicate checks on manual entry.
 */
const attachDuplicateCheckListeners = (): void => {
  const allInputs = Array.from(document.querySelectorAll('input'));
  allInputs.forEach((input) => {
    // Attach to Address1 fields that are enabled and haven't been tagged yet
    if (ADDR1_REGEX.test(input.id || '') && isFieldEnabled(input) && !input.dataset.duplicateCheckAttached) {
      if (isDebugEnabled()) console.debug(LOG_PREFIX, `Attaching duplicate check listener to: ${input.id}`);

      const handleUpdate = () => {
        const value = input.value.trim();
        // Prevent redundant checks for the same value (e.g., both blur and change firing)
        if (!value || value === input.dataset.lastCheckedValue) return;

        if (isAddressContextActive() || getDataWindowSchemaCount() === 0) {
          const customerId = getP21Value('customer_id');
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `Triggering duplicate check for manual change: ${value} (Customer: ${customerId})`);

          input.dataset.lastCheckedValue = value;
          duplicateCheck(value, customerId);
        }
      };

      // Listen for both blur (tab out) and change (programmatic or manual enter)
      input.addEventListener('blur', handleUpdate);
      input.addEventListener('change', handleUpdate);

      input.dataset.duplicateCheckAttached = 'true';
    }
  });
};

/**
 * Global discovery: finds address-related inputs and attaches search launchers.
 */
export const discoverAndAttachAddressUI = (retryCount = 0): void => {
  if (discoveryTimeout) window.clearTimeout(discoveryTimeout);

  // Always attempt to attach duplicate check listeners, bypassing the identity cache
  attachDuplicateCheckListeners();

  const { tabName, p21TabId, dataWindow } = getActiveContext();
  const currentIdentity = p21TabId || tabName || dataWindow; // More robust identity

  // Optimization: Use P21 Tab ID or tab name as authoritative identity.
  if (retryCount === 0 && currentIdentity && currentIdentity === lastTabName) {
    return;
  }

  discoveryTimeout = window.setTimeout(
    async () => {
      if (isInitializingUI) {
        discoveryTimeout = null;
        return;
      }

      try {
        isInitializingUI = true;

        if (isDebugEnabled() && currentIdentity !== lastTabName) {
          console.log(`${LOG_PREFIX} UI Context identity initiated: "${currentIdentity}"`);
        }

        lastTabName = currentIdentity;
        attachDuplicateCheckListeners();

        const context = getActiveContext();
        const anchor = findAnchorInput(context);
        const schemaCount = getDataWindowSchemaCount();

        if (anchor && (isAddressContextActive() || (schemaCount === 0 && context.windowName))) {
          if ((anchor as HTMLElement).dataset.sandboxAttached) return;

          const container = getContainerSelector(anchor);
          const containerElement = (container ? document.querySelector(container) : null) || document;

          if (ADDR_NAME_REGEX.test(anchor.id)) {
            const nameInput = anchor as HTMLInputElement;
            // Look for the corresponding Address1 field within the same container to ensure a valid, visible address block
            const addr1 = Array.from(containerElement.querySelectorAll('input')).find((i) => ADDR1_REGEX.test(i.id) && isFieldEnabled(i) && i.isConnected && i.getClientRects().length > 0);

            if (addr1) {
              attachSandboxLauncher(nameInput, container, true);
              attachSandboxLauncher(addr1 as HTMLInputElement, container, false, () => nameInput.value);
            }
          } else {
            attachSandboxLauncher(anchor as HTMLInputElement, container, false, () => (anchor as HTMLInputElement).value);
          }
        } else if ((isAddressContextActive() || (schemaCount === 0 && context.windowName)) && retryCount < 8) {
          // Only retry if we are in an address context OR we have a window name but no schemas yet (initial load)
          window.setTimeout(() => discoverAndAttachAddressUI(retryCount + 1), 300);
        }
      } finally {
        isInitializingUI = false;
        discoveryTimeout = null;
      }
    },
    retryCount > 0 ? 300 : 200,
  ); // Debounce to prevent overlapping scans from rapid XHRs
};

const bindAddressHotkey = (): void => {
  if (addressWindow.__p21AddressHotkeyBound) return;

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.altKey && event.key.toLowerCase() === 'a') {
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

/**
 * Resolves a P21 element by its precise ID or by searching within its DataWindow container.
 */
const findP21Element = (dwName: string, fieldName: string): HTMLElement | null => {
  const preciseId = `${dwName}.${fieldName}`;
  const element = document.getElementById(preciseId);
  if (element) return element;

  const dwContainer = document.querySelector(`[id="${dwName}"]`);
  return (dwContainer?.querySelector(`input[id$=".${fieldName}"]`) as HTMLElement) || null;
};

const findAnchorInput = (contextOverride?: ReturnType<typeof getActiveContext>): HTMLElement | null => {
  const { tabName, dataWindow } = contextOverride || getActiveContext();
  const schemaCount = getDataWindowSchemaCount();

  if (isDebugEnabled() && (tabName || schemaCount === 0)) {
    console.debug(LOG_PREFIX, 'findAnchorInput: Attempting to find anchor input...');
  }

  if (tabName && dataWindow) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: XHR context active: tabName=${tabName}, dataWindow=${dataWindow}`);
    const fullDwName = `${tabName}.${dataWindow}`;
    const schema = getDataWindowSchema(fullDwName);

    if (schema) {
      const schemaFields = Array.from(schema);
      if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Schema found for ${fullDwName}. Fields:`, schemaFields);

      // Requirement: Only attach if a valid Address1 field exists in the schema AND is visible in the DOM.
      // This prevents false positives in contexts like Contacts where address fields might be defined but not rendered.
      const hasVisibleAddress1 = schemaFields
        .filter((field) => ADDR1_REGEX.test(field))
        .some((field) => {
          const element = findP21Element(dataWindow, field);
          return element instanceof HTMLElement && isFieldEnabled(element) && element.isConnected && element.getClientRects().length > 0;
        });

      let anchorFieldName: string | undefined;

      if (hasVisibleAddress1) {
        anchorFieldName = schemaFields.find((field) => ADDR_NAME_REGEX.test(field)) || schemaFields.find((field) => ADDR1_REGEX.test(field));
      }

      if (anchorFieldName) {
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Anchor field name identified from schema: ${anchorFieldName}`);

        const element = findP21Element(dataWindow, anchorFieldName);

        if (element instanceof HTMLInputElement && isFieldEnabled(element) && element.isConnected && element.getClientRects().length > 0) {
          if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: XHR-prioritized anchor input found and enabled:', element, '(Source: XHR)');
          return element;
        }
      } else if (isDebugEnabled()) {
        console.debug(LOG_PREFIX, `findAnchorInput: No anchor field name found in schema for ${fullDwName} using address regexes.`);
      }

      // Optimization: If a schema is found for the active XHR context, it is the authoritative
      // map for the current view. If address fields aren't in the schema, we stop here
      // to prevent the DOM scan from picking up fields from inactive or background tabs.
      return null;
    } else if (isDebugEnabled()) {
      console.debug(LOG_PREFIX, `findAnchorInput: No schema found for ${fullDwName}.`);
    }
  } else if (isDebugEnabled()) {
    console.debug(LOG_PREFIX, 'findAnchorInput: No active XHR context. Falling back to DOM scan.');
  }

  // Optimization: Filter by ID patterns first, then check if enabled to reduce state store queries
  const allInputs = Array.from(document.querySelectorAll('input'));
  const addr1Input = allInputs.find((input) => ADDR1_REGEX.test(input.id) && isFieldEnabled(input) && input.isConnected && input.getClientRects().length > 0);

  if (addr1Input) {
    const nameInput = allInputs.find((input) => ADDR_NAME_REGEX.test(input.id) && isFieldEnabled(input) && input.isConnected && input.getClientRects().length > 0);
    const anchor = (nameInput || addr1Input) as HTMLElement;
    if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: DOM-based anchor input found (${nameInput ? 'Name' : 'Address1'} field):`, anchor, '(Source: DOM)');
    return anchor;
  }

  if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: No usable anchor input found via XHR or DOM scan.');
  return null;
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
    const { name } = event.detail;
    if (name?.includes('selectionchanged')) {
      discoverAndAttachAddressUI();
    }
  });

  // Initial scan to catch fields already present when the script loads
  discoverAndAttachAddressUI();
};
