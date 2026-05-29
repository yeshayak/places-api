import {} from './p21-context-monitor';
import { attachSandboxLauncher, openSandbox } from './address-sandbox-launcher';
import { ADDR1_REGEX, ADDR_NAME_REGEX } from './address-field-patterns';
import { getActiveContext, getContainerSelector, getDataWindowSchema, getDataWindowSchemaCount, getP21Value, isAddressContextActive, isFieldEnabled } from './p21-data-endpoint';
import { duplicateCheck } from './utils/duplicate-check';
import type { P21DataContextUpdatedDetail } from './p21-context-monitor.js';

interface AddressAutocompleteWindow extends Window {
  __p21AddressHotkeyBound?: boolean;
  __p21AddressAutocompleteListenersInstalled?: boolean;
}

const LOG_PREFIX = '[P21 EXT]';
const addressWindow = window as AddressAutocompleteWindow;

let isInitializingUI = false;
let discoveryTimeout: number | null = null;

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';

/**
 * Global discovery: finds address-related inputs and attaches search launchers.
 */
export const discoverAndAttachAddressUI = (retryCount = 0): void => {
  if (discoveryTimeout) window.clearTimeout(discoveryTimeout);

  discoveryTimeout = window.setTimeout(
    async () => {
      if (isInitializingUI) {
        discoveryTimeout = null;
        return;
      }

      try {
        isInitializingUI = true;
        attachDuplicateCheckListeners();

        const anchor = findAnchorInput();
        const context = getActiveContext();
        const schemaCount = getDataWindowSchemaCount();

        if (anchor && (isAddressContextActive() || schemaCount === 0)) {
          if ((anchor as HTMLElement).dataset.sandboxAttached) return;

          const container = getContainerSelector(anchor);

          if (ADDR_NAME_REGEX.test(anchor.id)) {
            const nameInput = anchor as HTMLInputElement;
            // Look for the corresponding Address1 field to ensure we are in a valid address block
            const addr1 = Array.from(document.querySelectorAll('input')).find((i) => ADDR1_REGEX.test(i.id) && isFieldEnabled(i) && i.isConnected && i.getClientRects().length > 0);

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

const attachDuplicateCheckListeners = (): void => {
  const allInputs = Array.from(document.querySelectorAll('input'));
  allInputs.forEach((input) => {
    if (ADDR1_REGEX.test(input.id) && !input.dataset.duplicateCheckAttached) {
      if (isDebugEnabled()) console.debug(LOG_PREFIX, `Attaching duplicate check listener to: ${input.id}`);
      input.addEventListener('blur', () => {
        const value = input.value.trim();
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `Blur detected on address1. Value: "${value}". Context Active: ${isAddressContextActive()}, Schemas: ${getDataWindowSchemaCount()}`);

        if (value && (isAddressContextActive() || getDataWindowSchemaCount() === 0)) {
          const customerId = getP21Value('customer_id');
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `Triggering duplicate check for: ${value} (Customer: ${customerId})`);
          duplicateCheck(value, customerId as string);
        }
      });
      input.dataset.duplicateCheckAttached = 'true';
    }
  });
};

const findAnchorInput = (): HTMLElement | null => {
  const { tabName, dataWindow } = getActiveContext();
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

      // Requirement: Only attach to Name if Address1 exists in schema
      const hasAddress1InSchema = schemaFields.some((field) => ADDR1_REGEX.test(field));
      let anchorFieldName: string | undefined;

      if (hasAddress1InSchema) {
        anchorFieldName = schemaFields.find((field) => ADDR_NAME_REGEX.test(field)) || schemaFields.find((field) => ADDR1_REGEX.test(field));
      }

      if (anchorFieldName) {
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Anchor field name identified from schema: ${anchorFieldName}`);
        // P21 uses short datawindow name in DOM IDs (e.g., 'shipto.fieldname', not 'TP_SHIPTO.shipto.fieldname')
        const preciseId = `${dataWindow}.${anchorFieldName}`;
        let element = document.getElementById(preciseId);
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Attempting to find element by precise ID: ${preciseId}. Found:`, !!element);
        if (!element) {
          const dwContainer = document.querySelector(`[id="${dataWindow}"]`);
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Direct ID not found. Searching within container [id="${dataWindow}"]. Found container:`, !!dwContainer);
          element = dwContainer?.querySelector(`input[id$=".${anchorFieldName}"]`) as HTMLElement;
          if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: Found element within container:', !!element);
        }

        if (element instanceof HTMLInputElement && isFieldEnabled(element) && element.isConnected && element.getClientRects().length > 0) {
          if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: XHR-prioritized anchor input found and enabled:', element, '(Source: XHR)');
          return element;
        }
      } else if (isDebugEnabled()) {
        console.debug(LOG_PREFIX, `findAnchorInput: No anchor field name found in schema for ${fullDwName} using address regexes.`);
      }
    } else if (isDebugEnabled()) {
      console.debug(LOG_PREFIX, `findAnchorInput: No schema found for ${fullDwName}.`);
    }
  } else if (isDebugEnabled()) {
    console.debug(LOG_PREFIX, 'findAnchorInput: No active XHR context. Falling back to DOM scan.');
  }

  const allInputs = Array.from(document.querySelectorAll('input')).filter((input) => isFieldEnabled(input) && input.isConnected && input.getClientRects().length > 0);
  const addr1Input = allInputs.find((input) => ADDR1_REGEX.test(input.id));

  if (addr1Input) {
    const nameInput = allInputs.find((input) => ADDR_NAME_REGEX.test(input.id));
    const anchor = nameInput || addr1Input;
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

  window.addEventListener('p21-ext:data-context-updated', (event) => {
    const detail = (event as CustomEvent<P21DataContextUpdatedDetail>).detail;
    if (!(detail.isAddressRelated || detail.isStructuralRescan || detail.isHistoryNavigation)) return;

    if (detail.isStructuralRescan) {
      window.setTimeout(() => discoverAndAttachAddressUI(), 300);
    } else {
      discoverAndAttachAddressUI();
    }
  });

  window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
    const { name } = event.detail;
    if (name?.includes('selectionchanged')) {
      discoverAndAttachAddressUI();
    }
  });
};
