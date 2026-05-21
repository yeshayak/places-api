import type { P21DesignResponse } from './p21-session';

export interface P21FieldUpdate {
  dwName: string;
  fieldName: string;
  value: string;
}

export interface P21AddressUpdateValue {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface P21DataEndpointUpdateResult {
  ok: boolean;
  status: number;
  fields: P21FieldUpdate[];
  error?: string;
}

interface P21ActiveContext {
  windowName?: string;
  tabName?: string;
  dataWindow?: string;
}

interface P21DataEndpointWindow extends Window {
  __p21DataEndpoint?: {
    buildAddressUpdates: typeof buildAddressUpdates;
    putFieldUpdates: typeof putFieldUpdates;
    trackActiveContext: typeof trackActiveContext;
  };
}

const state = {
  activeContext: {} as P21ActiveContext,
  dataWindowSchemas: new Map<string, Set<string>>(),
  allDataWindows: new Map<string, Record<string, unknown>[]>(), // Stores all DataWindows from the last design response
};

const LOG_PREFIX = '[P21 EXT]';
const ADDRESS_COMPONENT_FIELD_CANDIDATES: Record<keyof P21AddressUpdateValue, string[]> = {
  name: ['ship_to_name', 'address_name', 'customer_name', 'name'],
  address1: ['phys_address1', 'mail_address1', 'address1'],
  address2: ['phys_address2', 'mail_address2', 'address2'],
  city: ['phys_city', 'mail_city', 'city'],
  state: ['phys_state', 'mail_state', 'state'],
  postal_code: ['phys_postal_code', 'mail_postal_code', 'postal_code', 'zip_code', 'zip'],
};
const dataEndpointWindow = window as P21DataEndpointWindow;

/**
 * Extracts and tracks the active P21 context from a design response.
 */
export const trackActiveContext = (response: P21DesignResponse, url: string): void => {
  if (!response || typeof response !== 'object') return;

  // Only clear metadata when receiving a fresh design or data-information response.
  // Incremental data updates (PUT/PATCH) must preserve existing schemas and records.
  const isDesign = url.includes('/design') || Boolean(response.Result) || Boolean(response.DataInformation);
  if (isDesign) {
    state.activeContext = {};
    state.dataWindowSchemas.clear();
    state.allDataWindows.clear();
  }

  const { Result, Data, DataInformation } = response;

  // 1. Extract Window Name
  if (Result?.Name && Result.Name !== 'page' && Result.Name.startsWith('w_')) {
    state.activeContext.windowName = Result.Name;
  } else {
    try {
      const pathSegments = url.split('/');
      const designIdx = pathSegments.indexOf('design');
      if (designIdx !== -1) {
        const potentialWn = pathSegments[designIdx - 1];
        if (potentialWn && potentialWn !== 'page' && potentialWn.startsWith('w_')) {
          state.activeContext.windowName = potentialWn;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Track DataWindow Schemas from Data
  if (Data && typeof Data === 'object') {
    Object.entries(Data).forEach(([key, rows]) => {
      if (Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
        state.dataWindowSchemas.set(key, new Set(Object.keys(rows[0])));
      }
    });
  }

  // 3. Store all DataWindows from the latest Data object
  if (Data && typeof Data === 'object') {
    Object.entries(Data).forEach(([dwKey, rows]) => {
      if (Array.isArray(rows)) {
        state.allDataWindows.set(dwKey, rows as Record<string, unknown>[]);
      }
    });
  }

  // 4. Track Active Context (Tab and DataWindow) from Data or DataInformation
  const contextSource = Data || DataInformation || {}; // Prioritize Data, then DataInformation
  const relevantKey = Object.keys(contextSource).find((key) => key.includes('.')); // Find a key with dot notation
  if (relevantKey) {
    const [tn, dw] = relevantKey.split('.');
    state.activeContext.tabName = tn;
    state.activeContext.dataWindow = dw;
  }
};

/**
 * Retrieves a specific DataWindow's data from the last processed design response.
 * @param dwKey The full DataWindow key (e.g., 'TP_REMITTANCES.remittotals' or 'order').
 * @returns An array of records for the specified DataWindow, or undefined if not found.
 */
export const getP21DataWindow = (dwKey: string): Record<string, unknown>[] | undefined => state.allDataWindows.get(dwKey);

/**
 * Searches all tracked DataWindows for a specific field and returns its value from the first row.
 */
export const getP21Value = (fieldName: string): unknown => {
  for (const rows of state.allDataWindows.values()) {
    if (rows.length > 0 && rows[0] && typeof rows[0] === 'object' && fieldName in rows[0]) {
      return (rows[0] as Record<string, unknown>)[fieldName];
    }
  }
  return undefined;
};

/**
 * Builds field updates by discovering the correct DataWindow and field names
 * using tracked metadata schemas from previous design/data responses.
 */
export const buildAddressUpdates = (containerSelector: string, place: P21AddressUpdateValue, includeName: boolean): P21FieldUpdate[] => {
  // Identify a preferred DataWindow path from the container's DOM ID or selector string.
  let preferredDwPath = '';
  const containerElement = document.querySelector(containerSelector);

  if (containerElement?.id && containerElement.id.includes('.')) {
    // ID usually looks like "TP_SHIPTO.shipto" or "TP_SHIPTO.shipto.phys_address1"
    const parts = containerElement.id.split('.');
    preferredDwPath = `${parts[0]}.${parts[1]}`;
  } else {
    const dotMatch = containerSelector.match(/([A-Za-z0-9_]+\.[A-Za-z0-9_]+)/);
    if (dotMatch) preferredDwPath = dotMatch[0];
  }

  // Strategy: Identify the target DataWindow by looking for the existence of an "address1" field.
  // This helps distinguish between header DataWindows (like 'order') and actual address records.
  const address1Candidates = getAddressFieldCandidates('address1');
  let targetDwPath = '';

  if (preferredDwPath && state.dataWindowSchemas.has(preferredDwPath)) {
    const schema = state.dataWindowSchemas.get(preferredDwPath)!;
    if (address1Candidates.some((c) => schema.has(c))) {
      targetDwPath = preferredDwPath;
    }
  }

  if (!targetDwPath) {
    const trackedSchemas = Array.from(state.dataWindowSchemas.entries()).reverse();
    for (const [dwPath, schema] of trackedSchemas) {
      if (address1Candidates.some((c) => schema.has(c))) {
        targetDwPath = dwPath;
        break;
      }
    }
  }

  if (!targetDwPath && state.activeContext.dataWindow) {
    targetDwPath = state.activeContext.tabName ? `${state.activeContext.tabName}.${state.activeContext.dataWindow}` : state.activeContext.dataWindow;
  }

  return Object.entries(place)
    .filter(([component, value]) => value && (component !== 'name' || includeName))
    .map(([component, value]) => {
      const candidates = getAddressFieldCandidates(component);
      const schema = targetDwPath ? state.dataWindowSchemas.get(targetDwPath) : undefined;

      // Use the candidate found in the target schema, or fallback to first candidate
      const fieldName = schema ? candidates.find((c) => schema.has(c)) || candidates[0] : candidates[0];

      return {
        dwName: targetDwPath,
        fieldName,
        value: value as string,
      };
    })
    .filter((update): update is P21FieldUpdate => Boolean(update.dwName));
};

export const putAddressUpdates = async (containerSelector: string, place: P21AddressUpdateValue, includeName: boolean): Promise<P21DataEndpointUpdateResult> => {
  const fields = buildAddressUpdates(containerSelector, place, includeName);
  return putFieldUpdates(fields, containerSelector);
};

export const putFieldUpdates = async (fields: P21FieldUpdate[], containerSelector?: string): Promise<P21DataEndpointUpdateResult> => {
  if (fields.length === 0) {
    return {
      ok: false,
      status: 0,
      fields,
      error: 'No P21 fields were available for data endpoint update.',
    };
  }

  console.log(LOG_PREFIX, `Performing DOM update for ${fields.length} fields.`, fields);

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    // Construct selector to find the specific field.
    // Prophet 21 usually suffixes IDs or data-keys with the field name.
    const fieldSelector = `[id$=".${field.fieldName}"], [id="${field.fieldName}"], [data-key$=".${field.fieldName}"]`;
    const element = containerSelector ? document.querySelector(containerSelector)?.querySelector(fieldSelector) : document.querySelector(fieldSelector);

    if (element instanceof HTMLElement && !(element as any).disabled && !(element as any).readOnly) {
      console.log(LOG_PREFIX, `[${i + 1}/${fields.length}] Triggering sequence for: ${field.fieldName} -> ${field.value}`);

      const jQuery = (window as any).jQuery;
      if (jQuery) {
        const $el = jQuery(element);
        $el.trigger('focus').trigger('mouseenter').trigger('mousedown');
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          $el.val(field.value);
          $el.trigger('input'); // Notifies Angular ngModel of typing
        }
        $el.trigger('change').trigger('blur'); // Kicks off the P21 network sync
      } else {
        element.focus();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          (element as HTMLInputElement).value = field.value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    } else {
      console.warn(LOG_PREFIX, `Field ${field.fieldName} not found, disabled, or read-only. Skipping.`);
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

/**
 * Forces the Prophet 21 UI to refresh by triggering an Angular digest cycle.
 */
const triggerAngularRefresh = (): void => {
  const ng = (window as any).angular;
  const container = document.querySelector('#contextWindow, [window_classname]');

  if (ng && container) {
    const scope = ng.element(container).scope();
    const rootScope = scope?.$root;

    if (rootScope) {
      console.log(LOG_PREFIX, 'Triggering UI synchronization.');

      // Safe apply: Check if digest is already in progress
      const phase = rootScope.$$phase;
      if (phase !== '$apply' && phase !== '$digest') {
        rootScope.$broadcast('p21:data_changed');
        rootScope.$broadcast('p21:retrieve');
        rootScope.$apply();
      }
    }
  }
};

dataEndpointWindow.__p21DataEndpoint = {
  buildAddressUpdates,
  putFieldUpdates,
  trackActiveContext,
};

const getAddressFieldCandidates = (component: string): string[] => ADDRESS_COMPONENT_FIELD_CANDIDATES[component as keyof P21AddressUpdateValue] ?? [component];
