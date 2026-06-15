/// <reference types="angular" />
import type { P21FieldUpdate, P21AddressUpdateValue, P21DataEndpointUpdateResult } from './types/p21-types';
import { getActiveContext, getDataWindowSchema, getFieldMetadata, getDataWindowSchemaEntries } from './state-store';

export const ADDR1_REGEX = /[a-z0-9_]*address1$/i;
export const ADDR_NAME_REGEX = /(^|.*_)(customer_name|address_name|ship_to_name|ship_to_id_name|name)$/i;

interface P21DataEndpointWindow extends Window {
  __p21DataEndpoint?: {
    buildAddressUpdates: typeof buildAddressUpdates;
    triggerFieldUpdates: typeof triggerFieldUpdates;
  };
}

const LOG_PREFIX = '[P21 EXT]';
const dataEndpointWindow = window as P21DataEndpointWindow;

/**
 * Checks if a field is considered enabled based on DOM properties and P21 metadata.
 */
export const isFieldEnabled = (element: HTMLElement): boolean => {
  if (!element) return false;
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false;
  if (element.disabled || element.readOnly) return false;

  if (element.id && element.id.includes('.')) {
    const parts = element.id.split('.');
    const fieldName = parts[parts.length - 1];
    const dwName = parts.slice(0, -1).join('.');

    if (dwName) {
      const metadata = getFieldMetadata(dwName, fieldName);
      if (metadata && !metadata.enabled) return false;
    }
  }

  return true;
};

/**
 * Standardized utility to resolve a container selector from an input element.
 */
export const getContainerSelector = (element: HTMLElement): string => {
  if (element.id && element.id.includes('.')) {
    const parts = element.id.split('.');
    const dwName = parts.slice(0, -1).join('.'); // Everything before the last dot is the DataWindow name
    return `[id="${dwName}"]`;
  }
  return '';
};

/**
 * Builds field updates by discovering the correct DataWindow and field names
 * using tracked metadata schemas from previous design/data responses.
 */
const buildAddressUpdates = (containerSelector: string, place: P21AddressUpdateValue, includeName: boolean): P21FieldUpdate[] => {
  // Identify a preferred DataWindow path from the container's DOM ID or selector string.
  let preferredDwPath = '';
  // The containerSelector is expected to be like `[id="TP_SHIPTO.shipto"]` or `[id="shipto"]`
  // We extract the ID directly from the selector string.
  const idMatch = containerSelector.match(/\[id="([^"]+)"\]/);
  if (idMatch && idMatch[1]) {
    preferredDwPath = idMatch[1]; // This extracts "TP_SHIPTO.shipto" or "shipto"
  }

  // Strategy: Identify the target DataWindow by looking for the existence of an "address1" field.
  // This helps distinguish between header DataWindows (like 'order') and actual address records.
  let targetDwPath = '';
  const findAddr1 = (s: Set<string>) => Array.from(s).find((f) => ADDR1_REGEX.test(f));

  if (preferredDwPath && getDataWindowSchema(preferredDwPath)) {
    const schema = getDataWindowSchema(preferredDwPath)!;
    if (findAddr1(schema)) {
      targetDwPath = preferredDwPath;
    }
  }

  if (!targetDwPath) {
    const trackedSchemas = getDataWindowSchemaEntries().reverse();
    for (const [dwPath, schema] of trackedSchemas) {
      if (findAddr1(schema as Set<string>)) {
        targetDwPath = dwPath;
        break;
      }
    }
  }

  if (!targetDwPath) {
    const activeCtx = getActiveContext();
    if (activeCtx.dataWindow) {
      targetDwPath = activeCtx.tabName ? `${activeCtx.tabName}.${activeCtx.dataWindow}` : activeCtx.dataWindow;
    } else if (preferredDwPath) {
      targetDwPath = preferredDwPath;
    }
  }

  // Extract prefix from the identified address1 field in the target schema
  const targetSchema = targetDwPath ? getDataWindowSchema(targetDwPath) : undefined;
  let prefix = '';
  if (targetSchema) {
    const addr1Field = findAddr1(targetSchema);
    if (addr1Field) {
      // If field is 'ship_to_address1', prefix is 'ship_to_'
      prefix = addr1Field.toLowerCase().replace('address1', '');
    }
  } else if (containerSelector) {
    // DOM-based prefix discovery fallback (useful for initial load before schemas are captured)
    const container = document.querySelector(containerSelector);
    const addr1El = container?.querySelector('input[id*="address1"]');
    if (addr1El && addr1El.id) {
      const idParts = addr1El.id.split('.');
      const fieldName = idParts[idParts.length - 1];
      prefix = fieldName.toLowerCase().replace('address1', '');
    }
  }

  return Object.entries(place)
    .filter(([component, value]) => value && (component !== 'name' || includeName))
    .map(([component, value]) => {
      const suffix = component === 'postal_code' ? 'postal_code' : component === 'name' ? 'address_name' : component;
      const altSuffix = component === 'postal_code' ? 'zip' : component === 'name' ? 'name' : '';

      // Generate a prioritized list of potential Prophet 21 field names
      const candidates = [
        prefix + suffix, // e.g., phys_postal_code
        suffix, // e.g., address_name (P21 names often ignore the prefix)
        prefix + component, // e.g., phys_postal_code (if suffix and component differ)
        component, // e.g., postal_code
      ];

      if (altSuffix) {
        candidates.push(prefix + altSuffix); // e.g., phys_zip
        candidates.push(altSuffix); // e.g., zip
      }

      // Remove duplicates from candidates
      const uniqueCandidates = Array.from(new Set(candidates));

      let fieldName: string;
      if (targetSchema) {
        // Strategy A: Use server-side schema metadata
        fieldName = uniqueCandidates.find((c: string) => targetSchema.has(c)) || Array.from(targetSchema).find((f: any) => f.toLowerCase().endsWith(suffix) || f.toLowerCase().endsWith(component)) || uniqueCandidates[0];
      } else {
        // Strategy B: DOM Probe (Fallback for initial loads)
        console.warn(LOG_PREFIX, `Discovery: Schema unavailable for "${targetDwPath}". Falling back to DOM probe for component matching.`);

        // Check which candidate actually exists in the current DOM
        fieldName =
          uniqueCandidates.find((c) => {
            const fullId = `${targetDwPath}.${c}`;
            const el = document.getElementById(fullId) || document.querySelector(`input[id$=".${c}"], [data-key$=".${c}"]`);
            return !!el;
          }) || uniqueCandidates[0];
      }

      return {
        dwName: targetDwPath,
        fieldName,
        value: value as string,
      };
    })
    .filter((update): update is P21FieldUpdate => Boolean(update.dwName));
};

export const updateAddressFields = async (containerSelector: string, place: P21AddressUpdateValue, includeName: boolean): Promise<P21DataEndpointUpdateResult> => {
  const fields = buildAddressUpdates(containerSelector, place, includeName);
  console.debug(LOG_PREFIX, `Sync: Mapped ${fields.length} fields for P21 update.`, fields);
  return triggerFieldUpdates(fields, containerSelector);
};

/**
 * Standardized utility to resolve an Angular scope with optional polling.
 */
export const getP21Scope = async <T = any>(selector: string | Element, maxRetries = 10): Promise<T | null> => {
  const ng = (window as any).angular;
  if (!ng) return null;

  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (element) {
        const scope = ng.element(element).scope();
        if (scope) return scope as T;
      }
    } catch (e) {
      /* Angular scope might not be ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    retryCount++;
  }
  return null;
};

/**
 * Forces the Prophet 21 UI to refresh by triggering an Angular digest cycle.
 */
const triggerAngularRefresh = (): void => {
  const container = document.querySelector('#contextWindow, [window_classname]');
  if (!container) return;

  getP21Scope(container, 1).then((scope: any) => {
    const rootScope = scope?.$root;
    if (rootScope) {
      const phase = rootScope.$$phase;
      if (phase !== '$apply' && phase !== '$digest') {
        rootScope.$broadcast('p21:data_changed');
        rootScope.$broadcast('p21:retrieve');
        rootScope.$apply();
      }
    }
  });
};

const triggerFieldUpdates = async (fields: P21FieldUpdate[], containerSelector?: string): Promise<P21DataEndpointUpdateResult> => {
  if (fields.length === 0) {
    return {
      ok: false,
      status: 0,
      fields,
      error: 'No P21 fields were available for data endpoint update.',
    };
  }

  console.debug(LOG_PREFIX, `Sync: Initiating DOM update sequence for ${fields.length} fields.`);

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const targetId = `${field.dwName}.${field.fieldName}`;

    // Combine dwName and fieldName for higher specificity as P21 IDs often follow 'dwName.fieldName'
    const fieldSelector = `[id="${targetId}"], [id$=".${field.fieldName}"], [id="${field.fieldName}"], [data-key$="${targetId}"]`;

    const container = containerSelector ? document.querySelector(containerSelector) : null;
    const element = container?.querySelector(fieldSelector) || document.querySelector(fieldSelector);

    if (element instanceof HTMLElement && isFieldEnabled(element)) {
      // Skip if value is already correct to reduce P21 sync noise
      if (element instanceof HTMLInputElement && element.value === field.value) {
        continue;
      }

      console.debug(LOG_PREFIX, `Sync: [${i + 1}/${fields.length}] Processing ${field.fieldName} -> "${field.value}"`);

      const jQuery = (window as any).jQuery;

      // Focus and notify start of interaction
      element.focus();
      if (jQuery) {
        const $el = jQuery(element);
        $el.trigger('focus');
      }

      // Update value
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = field.value;
        // Dispatch input event to notify Angular/React/Vue listeners
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Notify end of interaction to trigger P21 data synchronization
      if (jQuery) {
        jQuery(element).trigger('change').trigger('blur');
      } else {
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    } else {
      console.warn(LOG_PREFIX, `Sync: Field "${targetId}" is missing, disabled, or read-only. Skipping.`);
    }

    // P21's internal synchronization logic is sensitive to rapid-fire updates.
    // Adding a delay ensures each field update is processed by the Angular/jQuery listeners
    // before moving to the next one, preventing race conditions or canceled XHR requests.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // Commit interaction by focusing away (neutralizes the last field)
  const looper = document.querySelector('#tabLooperEnd') || document.body;
  if (looper instanceof HTMLElement) {
    const jQuery = (window as any).jQuery;
    if (jQuery) jQuery(looper).trigger('focus');
    else looper.focus();
  }

  // Programmatic UI Refresh: Access the Angular scope to trigger a digest cycle.
  triggerAngularRefresh();

  return {
    ok: true,
    status: 200,
    fields,
  };
};

dataEndpointWindow.__p21DataEndpoint = {
  buildAddressUpdates,
  triggerFieldUpdates,
};
