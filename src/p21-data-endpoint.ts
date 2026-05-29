/// <reference types="angular" />
import type { P21DesignResponse, P21DataWindowProperties, P21FieldProperty } from './utils/p21-session';
import { ADDR1_REGEX } from './address-field-patterns';

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

export interface P21ActiveContext {
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
  __p21DataEndpoint?: {
    buildAddressUpdates: typeof buildAddressUpdates;
    triggerFieldUpdates: typeof triggerFieldUpdates;
    trackActiveContext: typeof trackActiveContext;
    getP21Value: typeof getP21Value;
  };
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

const dataEndpointWindow = window as P21DataEndpointWindow;

/**
 * Extracts and tracks the active P21 context from a design response.
 */
export const trackActiveContext = (response: P21DesignResponse, url: string): void => {
  if (!response || typeof response !== 'object') return;

  // Only clear metadata when receiving a fresh design or data-information response.
  // We now only clear the global data state if the Window Class actually changes,
  // which prevents losing the Header data (Customer ID) when switching tabs.
  // We use broader string matching to catch various URL path formats for tool actions.
  // We clear record data on Clear/Save/History actions, but retain structural state (schemas/context).
  const isDataReset = url.includes('Quick.Clear') || url.includes('Quick.Save') || url.includes('/window/history');

  if (isDataReset) {
    // Reset active focus to prevent stale context during the transition
    state.activeContext = { windowName: state.activeContext.windowName };
    state.allDataWindows.clear();
    state.windowFieldProperties.clear();
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'State: Record Data Reset (Structural Context Retained)');
  }

  const { Result, Data } = response;

  // 1. Extract Window Name
  if (Result?.Name && Result.Name !== 'page' && Result.Name.startsWith('w_')) {
    state.activeContext.windowName = Result.Name;
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'State: windowName updated:', state.activeContext.windowName);
  } else {
    try {
      const pathSegments = url.split('/');
      const designIdx = pathSegments.indexOf('design');
      if (designIdx !== -1) {
        const potentialWn = pathSegments[designIdx - 1];
        if (potentialWn && potentialWn !== 'page' && potentialWn.startsWith('w_')) {
          state.activeContext.windowName = potentialWn;
          if (isDebugEnabled()) console.warn(LOG_PREFIX, 'State: windowName inferred from URL path:', state.activeContext.windowName);
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Track DataWindow Schemas and Values (Comprehensive Record)
  // We focus exclusively on the 'Data' segment to maintain a persistent state of the entire record across tabs.
  const dataSource = Data || {};
  Object.entries(dataSource as Record<string, unknown>).forEach(([dwKey, value]) => {
    if (!value || typeof value !== 'object') return;

    // Update Schemas: ensure we know which fields exist in this DataWindow
    const sample = Array.isArray(value) ? value[0] : value;
    if (sample) {
      state.dataWindowSchemas.set(dwKey, new Set(Object.keys(sample)));
    }

    // Update Values: merge new data into the persistent record state
    if (Array.isArray(value)) {
      const existingRows = state.allDataWindows.get(dwKey) || [];
      const mergedRows = [...existingRows];

      value.forEach((newRow: any) => {
        if (newRow && typeof newRow === 'object') {
          const rowIndex = parseInt(newRow._internalrowindex, 10);
          if (!isNaN(rowIndex) && rowIndex > 0) {
            const idx = rowIndex - 1;
            mergedRows[idx] = { ...mergedRows[idx], ...newRow };
          } else if (mergedRows.length === 0 || value.length === 1) {
            mergedRows[0] = { ...mergedRows[0], ...newRow };
          }
        }
      });
      state.allDataWindows.set(dwKey, mergedRows as Record<string, unknown>[]);
    } else {
      // Handle single-object updates (common for some form-based DataWindows)
      const existingRows = state.allDataWindows.get(dwKey) || [{}];
      existingRows[0] = { ...existingRows[0], ...(value as any) };
      state.allDataWindows.set(dwKey, existingRows);
    }

    if (isDebugEnabled()) console.debug(LOG_PREFIX, `State: DataWindow "${dwKey}" updated (Schema & Values)`);
  });

  // 4. Track Active Context (Tab and DataWindow) - More robust extraction

  // Extract tabName
  if (Result?.TabDefinition?.UniqueName) {
    state.activeContext.tabName = Result.TabDefinition.UniqueName;
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'State: tabName updated:', state.activeContext.tabName);
  } else {
    // Fallback to Data keys if TabDefinition is not present
    const contextSource = Data || {};
    const relevantKey = Object.keys(contextSource).find((key) => key.includes('.'));
    if (relevantKey) {
      const [tn] = relevantKey.split('.');
      state.activeContext.tabName = tn;
      if (isDebugEnabled()) console.warn(LOG_PREFIX, 'State: tabName updated via key-split fallback:', state.activeContext.tabName);
    }
  }

  // Extract dataWindow
  // Prioritize from Data keys as this directly relates to what's in state.dataWindowSchemas
  const contextSource = Data || {};
  const relevantKey = Object.keys(contextSource).find((key) => key.includes('.'));
  if (relevantKey) {
    const [, dw] = relevantKey.split('.');
    state.activeContext.dataWindow = dw;
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'State: dataWindow updated:', state.activeContext.dataWindow);
  }

  // Fallback to Result.TabDefinition.Sections if not found in Data
  if (!state.activeContext.dataWindow && Result?.TabDefinition?.Sections) {
    // Find the first section that has a Dataobject or Name
    const primarySection = Result.TabDefinition.Sections.find((s) => s.Dataobject || s.Name);
    if (primarySection) {
      state.activeContext.dataWindow = primarySection.Dataobject || primarySection.Name;
      if (isDebugEnabled()) console.warn(LOG_PREFIX, 'State: dataWindow updated via Section fallback:', state.activeContext.dataWindow);
    }
  }

  // 5. Process field properties (visibility, enabled state, etc.)
  if (Result?.PropertiesSet) {
    processDataWindowProperties(Result.PropertiesSet);
  }
  if (Result?.Properties) {
    Object.values(Result.Properties).forEach(processDataWindowProperties);
  }

  // 6. Comprehensive Debug Logging of the full record state
  if (isDebugEnabled() || isFullDebugEnabled()) {
    console.debug(LOG_PREFIX, 'Full State Updated:', {
      activeContext: state.activeContext,
      record: Object.fromEntries(Array.from(state.allDataWindows.entries()).map(([dw, rows]) => [dw, rows.length === 1 ? rows[0] : rows])),
      schemas: Object.fromEntries(Array.from(state.dataWindowSchemas.entries()).map(([dw, fields]) => [dw, Array.from(fields)])),
    });
  }
};

/**
 * Returns the currently active tab name tracked from XHR context.
 */
export const getActiveTabName = (): string | undefined => state.activeContext.tabName;

export const getActiveContext = (): P21ActiveContext => ({ ...state.activeContext });

export const getDataWindowSchema = (dwKey: string): Set<string> | undefined => state.dataWindowSchemas.get(dwKey);

export const getDataWindowSchemaEntries = (): Array<[string, Set<string>]> => Array.from(state.dataWindowSchemas.entries());

export const getDataWindowSchemaCount = (): number => state.dataWindowSchemas.size;

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
    for (const row of rows) {
      if (row && typeof row === 'object' && fieldName in row) {
        const val = (row as Record<string, unknown>)[fieldName];
        if (val !== undefined && val !== null && val !== '') return val;
      }
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

/**
 * Checks if the given response contains data or events related to address fields.
 */
export const isAddressRelated = (response: P21DesignResponse): boolean => {
  if (!response) return false;

  // Check if any DataWindow in the response contains address1 candidates
  const hasAddressData = response.Data && Object.values(response.Data).some((rows) => Array.isArray(rows) && rows.length > 0 && rows[0] && Object.keys(rows[0]).some((k) => ADDR1_REGEX.test(k)));

  // Check if any Events mention address1 candidates in property updates
  const hasAddressEvents = response.Events?.some((e) => ADDR1_REGEX.test(e.EventData?.dwproperty_column || ''));

  return !!(hasAddressData || hasAddressEvents);
};

/**
 * Checks if the currently active UI context is known to have address fields based on tracked schemas.
 */
export const isAddressContextActive = (): boolean => {
  // Scan all schemas in the current window state, not just the active context
  return Array.from(state.dataWindowSchemas.values()).some((schema) => Array.from(schema).some((field) => ADDR1_REGEX.test(field)));
};

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
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'State: windowFieldProperties map initialized for', currentWindowName);
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

  if (preferredDwPath && state.dataWindowSchemas.has(preferredDwPath)) {
    const schema = state.dataWindowSchemas.get(preferredDwPath)!;
    if (findAddr1(schema)) {
      targetDwPath = preferredDwPath;
    }
  }

  if (!targetDwPath) {
    const trackedSchemas = Array.from(state.dataWindowSchemas.entries()).reverse();
    for (const [dwPath, schema] of trackedSchemas) {
      if (findAddr1(schema)) {
        targetDwPath = dwPath;
        break;
      }
    }
  }

  if (!targetDwPath) {
    if (state.activeContext.dataWindow) {
      targetDwPath = state.activeContext.tabName ? `${state.activeContext.tabName}.${state.activeContext.dataWindow}` : state.activeContext.dataWindow;
    } else if (preferredDwPath) {
      targetDwPath = preferredDwPath;
    }
  }

  // Extract prefix from the identified address1 field in the target schema
  const targetSchema = targetDwPath ? state.dataWindowSchemas.get(targetDwPath) : undefined;
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
        fieldName = uniqueCandidates.find((c) => targetSchema.has(c)) || Array.from(targetSchema).find((f) => f.toLowerCase().endsWith(suffix) || f.toLowerCase().endsWith(component)) || uniqueCandidates[0];
      } else {
        // Strategy B: DOM Probe (Fallback for initial loads)
        if (isDebugEnabled()) console.warn(LOG_PREFIX, `Strategy B: Schema metadata unavailable for "${targetDwPath}". Falling back to DOM probe for candidate matching.`);

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

      if (isDebugEnabled() || isFullDebugEnabled()) {
        console.log(LOG_PREFIX, `[${i + 1}/${fields.length}] Triggering sequence for: ${field.fieldName} -> ${field.value}`);
      }

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
      console.warn(LOG_PREFIX, `Field "${targetId}" not found, disabled, or read-only. Skipping. (Selector: ${fieldSelector}, Container: ${containerSelector})`);
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
  getP21Value, // Export getP21Value for use in sandbox.ts
};

// Process field properties from Result.PropertiesSet or Result.Properties
if (dataEndpointWindow.__p21DataEndpoint) {
  // This part will be called by the XHR monitor when a response comes in.
  // The trackActiveContext function will then call processDataWindowProperties internally.
  // No need to call it directly here.
}
