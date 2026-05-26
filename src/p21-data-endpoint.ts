/// <reference types="angular" />
import type { P21DesignResponse, P21DataWindowProperties, P21FieldProperty } from './utils/p21-session';

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

// New state to store field properties
interface FieldMetadata {
  visible: boolean;
  enabled: boolean;
}

// Map: fullDwName (e.g., 'TP_ITEMS.items') -> fieldName -> FieldMetadata
type DataWindowFieldMetadataMap = Map<string, Map<string, FieldMetadata>>;

interface P21DataEndpointWindow extends Window {
  __p21DataEndpoint?: { buildAddressUpdates: typeof buildAddressUpdates; triggerFieldUpdates: typeof triggerFieldUpdates; trackActiveContext: typeof trackActiveContext };
}

const state = {
  activeContext: {} as P21ActiveContext,
  dataWindowSchemas: new Map<string, Set<string>>(),
  allDataWindows: new Map<string, Record<string, unknown>[]>(), // Stores all DataWindows from the last design response
  // Map: windowName -> DataWindowFieldMetadataMap
  windowFieldProperties: new Map<string, DataWindowFieldMetadataMap>(), // New state to store field properties
};

const LOG_PREFIX = '[P21 EXT]';
const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';
const isFullDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebugFull') === 'true';

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
    state.windowFieldProperties.clear(); // Clear new state
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

  // 5. Process field properties (visibility, enabled state, etc.)
  if (Result?.PropertiesSet) {
    processDataWindowProperties(Result.PropertiesSet);
  }
  if (Result?.Properties) {
    Object.values(Result.Properties).forEach(processDataWindowProperties);
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
 * Standardized utility to retrieve an Angular scope with optional polling.
 * Useful for P21's dynamic loading where elements might exist but scope isn't bound yet.
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

// New helper to get field metadata
export const getFieldMetadata = (fullDwName: string, fieldName: string): FieldMetadata | undefined => {
  const windowName = state.activeContext.windowName;
  if (!windowName) return undefined;
  return state.windowFieldProperties.get(windowName)?.get(fullDwName)?.get(fieldName);
};

/**
 * Processes P21DataWindowProperties to extract and store field metadata.
 * @param propertiesContainer The P21DataWindowProperties object (e.g., Result.PropertiesSet or an entry from Result.Properties)
 */
const processDataWindowProperties = (propertiesContainer: P21DataWindowProperties) => {
  const currentWindowName = state.activeContext.windowName;
  if (!currentWindowName) return;

  let dataWindowFieldMetadataMap = state.windowFieldProperties.get(currentWindowName);
  if (!dataWindowFieldMetadataMap) {
    dataWindowFieldMetadataMap = new Map();
    state.windowFieldProperties.set(currentWindowName, dataWindowFieldMetadataMap);
  }

  // Step 1: Build a map from dwname to its fullDwName (e.g., "items" -> "TP_ITEMS.items")
  const dwNameToFullDwNameMap = new Map<string, string>();
  propertiesContainer.Properties?.forEach((prop: P21FieldProperty) => {
    if (prop.dwname && prop.tabpagename) {
      dwNameToFullDwNameMap.set(prop.dwname, `${prop.tabpagename}.${prop.dwname}`);
    }
  });

  // Helper to update metadata for a specific field
  const updateFieldMetadata = (fullDwName: string, fieldName: string, propType: 'visible' | 'enabled', value: string | number | boolean) => {
    if (!dataWindowFieldMetadataMap!.has(fullDwName)) {
      dataWindowFieldMetadataMap!.set(fullDwName, new Map());
    }
    const fieldMap = dataWindowFieldMetadataMap!.get(fullDwName)!;
    if (!fieldMap.has(fieldName)) {
      fieldMap.set(fieldName, { visible: false, enabled: false });
    }
    const metadata = fieldMap.get(fieldName)!;
    if (propType === 'visible') metadata.visible = value === 'true' || value === true;
    if (propType === 'enabled') metadata.enabled = value === 'true' || value === true;
  };

  // Step 2: Process 'visible' and 'enabled' properties
  for (const propType of ['visible', 'enabled'] as const) {
    propertiesContainer[propType]?.forEach((propEntry: P21FieldProperty) => {
      if (propEntry._internalrowindex === '1') {
        for (const fieldName in propEntry) {
          if (fieldName !== '_internalrowindex' && fieldName !== 'Properties_Id' && fieldName !== 'dwname' && fieldName !== 'tabpagename') {
            let targetFullDwName: string | undefined;

            // Try to infer the data window from the active context first
            if (state.activeContext.dataWindow && state.activeContext.tabName) {
              targetFullDwName = `${state.activeContext.tabName}.${state.activeContext.dataWindow}`;
            }

            // If not found, try to match the fieldName to a schema to find its data window
            if (!targetFullDwName) {
              for (const [dwKey, schema] of state.dataWindowSchemas.entries()) {
                if (schema.has(fieldName)) {
                  targetFullDwName = dwKey;
                  break;
                }
              }
            }

            // If still not found, try to use the dwNameToFullDwNameMap
            if (!targetFullDwName) {
              for (const [_, fullDwNameFromMap] of dwNameToFullDwNameMap.entries()) {
                const schema = state.dataWindowSchemas.get(fullDwNameFromMap);
                if (schema?.has(fieldName)) {
                  targetFullDwName = fullDwNameFromMap;
                  break;
                }
              }
            }

            if (targetFullDwName) {
              updateFieldMetadata(targetFullDwName, fieldName, propType, propEntry[fieldName]!);
            } else {
              if (isDebugEnabled() || isFullDebugEnabled()) {
                console.warn(LOG_PREFIX, `Could not determine DataWindow for field "${fieldName}" in "${propType}" properties.`);
              }
            }
          }
        }
      }
    });
  }
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

export const updateAddressFields = async (containerSelector: string, place: P21AddressUpdateValue, includeName: boolean): Promise<P21DataEndpointUpdateResult> => {
  const fields = buildAddressUpdates(containerSelector, place, includeName);

  if (isDebugEnabled() || isFullDebugEnabled()) {
    console.log(LOG_PREFIX, `Mapped ${fields.length} target fields for update.`, fields);
  }

  return triggerFieldUpdates(fields, containerSelector);
};

export const triggerFieldUpdates = async (fields: P21FieldUpdate[], containerSelector?: string): Promise<P21DataEndpointUpdateResult> => {
  if (fields.length === 0) {
    return {
      ok: false,
      status: 0,
      fields,
      error: 'No P21 fields were available for data endpoint update.',
    };
  }

  if (isDebugEnabled() || isFullDebugEnabled()) {
    console.log(LOG_PREFIX, `Performing DOM update for ${fields.length} fields.`, fields);
  }

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    // Construct selector to find the specific field.
    // Prophet 21 usually suffixes IDs or data-keys with the field name.
    const fieldSelector = `[id$=".${field.fieldName}"], [id="${field.fieldName}"], [data-key$=".${field.fieldName}"]`;
    const element = containerSelector ? document.querySelector(containerSelector)?.querySelector(fieldSelector) : document.querySelector(fieldSelector);

    if (element instanceof HTMLElement && !(element as any).disabled && !(element as any).readOnly) {
      // Skip if value is already correct to reduce P21 sync noise
      if (element instanceof HTMLInputElement && element.value === field.value) {
        continue;
      }

      if (isDebugEnabled() || isFullDebugEnabled()) {
        console.log(LOG_PREFIX, `[${i + 1}/${fields.length}] Triggering sequence for: ${field.fieldName} -> ${field.value}`);
      }

      const jQuery = (window as any).jQuery;

      // Focus and notify start of interaction
      element.focus();
      if (jQuery) {
        const $el = jQuery(element);
        $el.trigger('focus').trigger('mouseenter').trigger('mousedown');
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
  const container = document.querySelector('#contextWindow, [window_classname]');
  if (!container) return;

  getP21Scope(container, 1).then((scope) => {
    const rootScope = scope?.$root;
    if (rootScope) {
      const phase = rootScope.$$phase;
      if (phase !== '$apply' && phase !== '$digest') {
        if (isDebugEnabled() || isFullDebugEnabled()) console.log(LOG_PREFIX, 'Triggering UI synchronization.');
        rootScope.$broadcast('p21:data_changed');
        rootScope.$broadcast('p21:retrieve');
        rootScope.$apply();
      }
    }
  });
};
dataEndpointWindow.__p21DataEndpoint = {
  buildAddressUpdates,
  triggerFieldUpdates,
  trackActiveContext,
};

// Process field properties from Result.PropertiesSet or Result.Properties
if (dataEndpointWindow.__p21DataEndpoint) {
  // This part will be called by the XHR monitor when a response comes in.
  // The trackActiveContext function will then call processDataWindowProperties internally.
  // No need to call it directly here.
}

const getAddressFieldCandidates = (component: string): string[] => ADDRESS_COMPONENT_FIELD_CANDIDATES[component as keyof P21AddressUpdateValue] ?? [component];

// Initial processing of properties if available (e.g., for initial page load)
if (dataEndpointWindow.__p21DataEndpoint) {
  // This is handled by trackActiveContext when it's called by the XHR monitor.
}
