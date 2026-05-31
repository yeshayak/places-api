import type { P21DesignResponse, P21ActiveContext, P21DataWindowProperties, P21FieldProperty } from './types/p21-types';

const LOG_PREFIX = '[P21 STATE]';

interface FieldMetadata {
  visible: boolean;
  enabled: boolean;
}

const state = {
  activeContext: {} as P21ActiveContext,
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> Set<fields>
  dataWindowSchemas: new Map<string, Map<string, Map<string, Set<string>>>>(),
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> rows[]
  allDataWindows: new Map<string, Map<string, Map<string, Record<string, unknown>[]>>>(),
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> Field -> Metadata
  windowFieldProperties: new Map<string, Map<string, Map<string, Map<string, FieldMetadata>>>>(),
};

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true' || localStorage.getItem('p21ExtDebugFull') === 'true';

/**
 * Determines which P21 layout container (tab_1, tab_2) a DataWindow belongs to.
 */
const getTabIdForDw = (dwKey: string): string => {
  if (!dwKey.includes('.')) return 'global';
  const tabName = dwKey.split('.')[0].toUpperCase();

  for (const [containerId, tabMap] of state.dataWindowSchemas.entries()) {
    if (containerId === 'unknown' || containerId === 'global') continue;
    if (tabMap.has(tabName)) return containerId;
  }

  // Fallback to active context if mapping is unknown
  return state.activeContext.p21TabId || 'unknown';
};

/**
 * Moves data from the 'unknown' bucket to correct containers once mappings are established.
 */
const rebucketData = (): void => {
  const unknownSchemas = state.dataWindowSchemas.get('unknown');
  if (unknownSchemas) {
    for (const [tabName, dwMap] of unknownSchemas.entries()) {
      for (const [dwName, schema] of dwMap.entries()) {
        const fullKey = tabName === 'ROOT' ? dwName : `${tabName}.${dwName}`;
        const newTabId = getTabIdForDw(fullKey);
        if (newTabId !== 'unknown') {
          if (!state.dataWindowSchemas.has(newTabId)) state.dataWindowSchemas.set(newTabId, new Map());
          const bucket = state.dataWindowSchemas.get(newTabId)!;
          if (!bucket.has(tabName)) bucket.set(tabName, new Map());
          bucket.get(tabName)!.set(dwName, schema);
          dwMap.delete(dwName);
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `Re-bucketed schema: ${fullKey} -> ${newTabId}`);
        }
      }
    }
  }

  const unknownData = state.allDataWindows.get('unknown');
  if (unknownData) {
    for (const [tabName, dwMap] of unknownData.entries()) {
      for (const [dwName, rows] of dwMap.entries()) {
        const fullKey = tabName === 'ROOT' ? dwName : `${tabName}.${dwName}`;
        const newTabId = getTabIdForDw(fullKey);
        if (newTabId !== 'unknown') {
          if (!state.allDataWindows.has(newTabId)) state.allDataWindows.set(newTabId, new Map());
          const bucket = state.allDataWindows.get(newTabId)!;
          if (!bucket.has(tabName)) bucket.set(tabName, new Map());
          bucket.get(tabName)!.set(dwName, rows);
          dwMap.delete(dwName);
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `Re-bucketed data: ${fullKey} -> ${newTabId}`);
        }
      }
    }
  }

  const unknownProps = state.windowFieldProperties.get('unknown');
  if (unknownProps) {
    for (const [tabName, dwMap] of unknownProps.entries()) {
      for (const [dwName, fields] of dwMap.entries()) {
        const fullKey = tabName === 'ROOT' ? dwName : `${tabName}.${dwName}`;
        const newTabId = getTabIdForDw(fullKey);
        if (newTabId !== 'unknown') {
          if (!state.windowFieldProperties.has(newTabId)) state.windowFieldProperties.set(newTabId, new Map());
          const bucket = state.windowFieldProperties.get(newTabId)!;
          if (!bucket.has(tabName)) bucket.set(tabName, new Map());
          bucket.get(tabName)!.set(dwName, fields);
          dwMap.delete(dwName);
          if (isDebugEnabled()) console.debug(LOG_PREFIX, `Structure: Re-bucketed metadata: ${fullKey} -> ${newTabId}`);
        }
      }
    }
  }
};

/**
 * Authority for P21 record data and schemas.
 */
export const trackActiveContext = (response: P21DesignResponse | any, _url: string): void => {
  if (isDebugEnabled()) console.debug(LOG_PREFIX, `Context Update: Processing inbound response from ${_url}`);

  if (!response) return;

  // 0. Handle Structural Preferences (Layout discovery)
  const prefs = Array.isArray(response) ? response : undefined;
  if (prefs && _url.toLowerCase().includes('/window/multiprefs')) {
    if (isDebugEnabled()) console.info(LOG_PREFIX, 'Structure: Processing window layout manifest (multiprefs).');

    prefs.forEach((p: any) => {
      if (p.PreferenceName === 'tab.pageorder' && typeof p.PreferenceValue === 'string') {
        const containerId = p.ObjectName;
        const tabs = p.PreferenceValue.split(',').map((t: string) => t.trim().toUpperCase());

        if (!state.dataWindowSchemas.has(containerId)) state.dataWindowSchemas.set(containerId, new Map());
        if (!state.allDataWindows.has(containerId)) state.allDataWindows.set(containerId, new Map());

        const schemaBucket = state.dataWindowSchemas.get(containerId)!;
        const dataBucket = state.allDataWindows.get(containerId)!;

        tabs.forEach((tabName: string) => {
          if (!schemaBucket.has(tabName)) schemaBucket.set(tabName, new Map());
          if (!dataBucket.has(tabName)) dataBucket.set(tabName, new Map());
        });

        if (isDebugEnabled()) console.debug(LOG_PREFIX, `Structure: Container "${containerId}" initialized with ${tabs.length} tabs.`);
      }
    });
    rebucketData();
    deriveP21TabId();
    return;
  }

  if (typeof response !== 'object') return;

  const { Result, Data } = response;

  // 1. Extract Window Name
  if (!state.activeContext.windowName) {
    try {
      const urlObj = new URL(_url, window.location.href);
      const wn = urlObj.searchParams.get('wn');
      if (wn && wn.startsWith('w_')) {
        state.activeContext.windowName = wn;
      }
    } catch {
      /* ignore */
    }
  }

  if (Result?.Name && Result.Name !== 'page' && Result.Name.startsWith('w_')) {
    state.activeContext.windowName = Result.Name;
  }

  // 2. Track DataWindow Schemas and Values
  const dataSource = Data || {};
  Object.entries(dataSource as Record<string, unknown>).forEach(([dwKey, value]) => {
    if (!value || typeof value !== 'object') return;

    const p21TabId = getTabIdForDw(dwKey);
    const parts = dwKey.split('.');
    const tabName = parts.length > 1 ? parts[0] : 'ROOT';
    const dwName = parts.length > 1 ? parts[1] : parts[0];

    // Ensure bucket exists in nested maps
    if (!state.dataWindowSchemas.has(p21TabId)) state.dataWindowSchemas.set(p21TabId, new Map());
    if (!state.allDataWindows.has(p21TabId)) state.allDataWindows.set(p21TabId, new Map());

    const bucketSchemas = state.dataWindowSchemas.get(p21TabId) as Map<string, Map<string, Set<string>>>;
    const bucketData = state.allDataWindows.get(p21TabId) as Map<string, Map<string, Record<string, unknown>[]>>;

    if (!bucketSchemas.has(tabName)) bucketSchemas.set(tabName, new Map());
    if (!bucketData.has(tabName)) bucketData.set(tabName, new Map());

    const tabSchemas = bucketSchemas.get(tabName) as Map<string, Set<string>>;
    const tabData = bucketData.get(tabName) as Map<string, Record<string, unknown>[]>;

    const sample = Array.isArray(value) ? value[0] : value;
    if (sample) {
      tabSchemas.set(dwName, new Set(Object.keys(sample)));
    }

    if (Array.isArray(value)) {
      const existingRows = (tabData.get(dwName) || []) as Record<string, unknown>[];
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
      tabData.set(dwName, mergedRows as Record<string, unknown>[]);
    } else {
      const rows = (tabData.get(dwName) || [{}]) as Record<string, unknown>[];
      rows[0] = { ...rows[0], ...(value as Record<string, unknown>) };
      tabData.set(dwName, rows);
    }
  });

  // 3. Track Active Tab/DW
  if (Result?.TabDefinition?.UniqueName) {
    state.activeContext.tabName = Result.TabDefinition.UniqueName;
  }

  const relevantKey = Object.keys(dataSource).find((key) => key.includes('.'));
  if (relevantKey) {
    const [tn, dw] = relevantKey.split('.');
    state.activeContext.tabName = tn;
    state.activeContext.dataWindow = dw;
  }

  deriveP21TabId();

  // 4. Process field properties
  if (Result?.PropertiesSet) {
    const path = state.activeContext.tabName && state.activeContext.dataWindow ? `${state.activeContext.tabName}.${state.activeContext.dataWindow}` : '';
    processDataWindowProperties(Result.PropertiesSet, path);
  }
  if (Result?.Properties) {
    Object.entries(Result.Properties).forEach(([path, props]) => {
      processDataWindowProperties(props as P21DataWindowProperties, path);
    });
  }
};

const deriveP21TabId = () => {
  if (state.activeContext.tabName) {
    const tabName = state.activeContext.tabName.toUpperCase();
    for (const [containerId, tabMap] of state.dataWindowSchemas.entries()) {
      if (containerId === 'unknown' || containerId === 'global') continue;
      if (tabMap.has(tabName)) {
        state.activeContext.p21TabId = containerId;
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `State: p21TabId derived as "${containerId}" for tab "${state.activeContext.tabName}".`);
        return;
      }
    }
  }
};

const processDataWindowProperties = (propertiesContainer: P21DataWindowProperties, dwPath: string) => {
  // Process modern property arrays
  propertiesContainer.visible?.forEach((entry) => updateMetadata(entry, 'visible', dwPath));
  propertiesContainer.enabled?.forEach((entry) => updateMetadata(entry, 'enabled', dwPath));

  // Process legacy/combined property array (often used in history/design responses)
  propertiesContainer.Properties?.forEach((entry) => updateMetadata(entry, 'generic', dwPath));
};

const updateMetadata = (propEntry: P21FieldProperty, type: 'visible' | 'enabled' | 'generic', dwPath: string) => {
  // Relaxed indexing: Form-level metadata often omits index;
  // P21 uses '1' or '0' for header/schema properties.
  const rowIndex = propEntry._internalrowindex;
  if (rowIndex !== undefined && rowIndex !== null && String(rowIndex) !== '1' && String(rowIndex) !== '0') return;

  // Prioritize internal metadata pathing over the inferred dwPath
  const path = (propEntry.tabpagename && propEntry.dwname ? `${propEntry.tabpagename}.${propEntry.dwname}` : dwPath) || '';
  if (!path) return;

  const containerId = getTabIdForDw(path);
  const parts = path.split('.');
  const tabName = parts.length > 1 ? parts[0] : 'ROOT';
  const dwName = parts.length > 1 ? parts[1] : parts[0];

  // Ensure hierarchy exists
  if (!state.windowFieldProperties.has(containerId)) {
    state.windowFieldProperties.set(containerId, new Map());
  }
  const containerMap = state.windowFieldProperties.get(containerId)!;

  if (!containerMap.has(tabName)) {
    containerMap.set(tabName, new Map());
  }
  const tabMap = containerMap.get(tabName)!;

  if (!tabMap.has(dwName)) tabMap.set(dwName, new Map());
  const fieldMap = tabMap.get(dwName)!;

  for (const fieldName in propEntry) {
    if (['_internalrowindex', 'Properties_Id', 'dwname', 'tabpagename'].includes(fieldName)) continue;

    if (!fieldMap.has(fieldName)) fieldMap.set(fieldName, { visible: true, enabled: true });

    const val = propEntry[fieldName];
    const isTrue = val === 'true' || val === true || val === '1' || val === 1;

    const metadata = fieldMap.get(fieldName)!;
    if (type === 'visible') metadata.visible = isTrue;
    else if (type === 'enabled') metadata.enabled = isTrue;
    else {
      // Generic/Legacy entries usually denote visibility
      metadata.visible = isTrue;
    }
  }
};

export const getActiveContext = () => {
  if (isDebugEnabled()) {
    // Convert Maps and Sets to Objects/Arrays so they serialize in the console
    const loggableState = {
      ...state,
      dataWindowSchemas: Object.fromEntries(
        Array.from(state.dataWindowSchemas.entries()).map(([container, tabs]) => [
          container,
          Object.fromEntries(Array.from(tabs.entries()).map(([tab, dws]) => [tab, Object.fromEntries(Array.from(dws.entries()).map(([dw, fields]) => [dw, Array.from(fields)]))])),
        ]),
      ),
      allDataWindows: Object.fromEntries(Array.from(state.allDataWindows.entries()).map(([container, tabs]) => [container, Object.fromEntries(Array.from(tabs.entries()).map(([tab, dws]) => [tab, Object.fromEntries(dws)]))])),
      windowFieldProperties: Object.fromEntries(
        Array.from(state.windowFieldProperties.entries()).map(([container, tabs]) => [
          container,
          Object.fromEntries(Array.from(tabs.entries()).map(([tab, dws]) => [tab, Object.fromEntries(Array.from(dws.entries()).map(([dw, fields]) => [dw, Object.fromEntries(fields)]))])),
        ]),
      ),
    };
    console.debug(LOG_PREFIX, 'Query: Retrieving complete state:', loggableState);
  }
  return { ...state.activeContext };
};

export const getDataWindowSchema = (dwKey: string) => {
  const parts = dwKey.split('.');
  const tabName = parts.length > 1 ? parts[0] : 'ROOT';
  const dwName = parts.length > 1 ? parts[1] : parts[0];

  let schema: Set<string> | undefined;
  for (const container of state.dataWindowSchemas.values()) {
    const tab = container.get(tabName);
    if (tab?.has(dwName)) {
      schema = tab.get(dwName);
      if (schema) break;
    }
  }

  if (isDebugEnabled()) console.debug(LOG_PREFIX, `Query: Fetching schema for ${dwKey}:`, schema ? Array.from(schema) : 'None');
  return schema;
};

export const getDataWindowSchemaCount = () => {
  const entries = getDataWindowSchemaEntries();
  if (isDebugEnabled()) console.debug(LOG_PREFIX, `Query: Schema count for active container: ${entries.length}`);
  return entries.length;
};

export const getDataWindowSchemaEntries = () => {
  const { p21TabId, tabName: activeTabName } = state.activeContext;
  const entries: [string, Set<string>][] = [];

  // Aggregate entries from global, unknown, and the specific active container,
  // but filter by the active tab page to prevent cross-tab contamination.
  ['global', 'unknown', p21TabId].forEach((bucketId) => {
    if (!bucketId) return;
    const container = state.dataWindowSchemas.get(bucketId);
    if (container) {
      for (const [tabName, dws] of container.entries()) {
        if (tabName !== 'ROOT' && activeTabName && tabName !== activeTabName) continue;

        for (const [dwName, fields] of dws.entries()) {
          entries.push([tabName === 'ROOT' ? dwName : `${tabName}.${dwName}`, fields]);
        }
      }
    }
  });

  if (isDebugEnabled()) {
    console.debug(LOG_PREFIX, `Query: Listing aggregated schema entries for context "${p21TabId || 'none'}":`, entries);
  }
  return entries;
};

export const getP21Value = (fieldName: string) => {
  let result: any = undefined;
  if (isDebugEnabled()) console.debug(LOG_PREFIX, `Query: Searching DataWindows for field value: ${fieldName}`);

  for (const container of state.allDataWindows.values()) {
    for (const tab of container.values()) {
      for (const rows of tab.values()) {
        for (const row of rows) {
          if (row && typeof row === 'object' && fieldName in row) {
            const val = (row as any)[fieldName];
            if (val !== undefined && val !== null && val !== '') {
              result = val;
              break;
            }
          }
        }
        if (result !== undefined) break;
      }
      if (result !== undefined) break;
    }
    if (result !== undefined) break;
  }

  if (isDebugEnabled()) console.debug(LOG_PREFIX, `Query: Search result for "${fieldName}":`, result);
  return result;
};

export const getFieldMetadata = (dwKey: string, fieldName: string) => {
  const parts = dwKey.split('.');
  const dwName = parts.length > 1 ? parts[1] : parts[0];
  let metadata: FieldMetadata | undefined;

  // Search all containers and tabPages for the DW
  for (const containerMap of state.windowFieldProperties.values()) {
    for (const tabMap of containerMap.values()) {
      if (tabMap.has(dwName)) {
        metadata = tabMap.get(dwName)?.get(fieldName);
        if (metadata) break;
      }
    }
    if (metadata) break;
  }

  if (isDebugEnabled()) {
    console.debug(LOG_PREFIX, `Query: Retrieving field properties for: ${dwKey}.${fieldName}. Result:`, metadata);
  }

  return metadata;
};

window.addEventListener('p21-ext:transaction-reset', (event: any) => {
  const { identity } = event.detail;
  state.activeContext = {
    windowName: state.activeContext.windowName,
  };
  state.allDataWindows.clear();
  state.windowFieldProperties.clear();
  state.dataWindowSchemas.clear();

  if (isDebugEnabled()) {
    console.info(LOG_PREFIX, `Transaction Reset: Wiping transient state for identity "${identity}"`);
  }
});

const win = window as any;
win.__p21StateStore = {
  trackActiveContext,
  getActiveContext,
  getDataWindowSchema,
  getDataWindowSchemaCount,
  getDataWindowSchemaEntries,
  getP21Value,
  getFieldMetadata,
};
