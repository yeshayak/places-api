import type { P21ActiveContext } from './types/p21-types';

const LOG_PREFIX = '[P21 STATE]';

interface FieldMetadata {
  visible: boolean;
  enabled: boolean;
}

interface P21State {
  activeContext: P21ActiveContext;
  dataWindowSchemas: Map<string, Map<string, Map<string, Set<string>>>>;
  allDataWindows: Map<string, Map<string, Map<string, Record<string, unknown>[]>>>;
  windowFieldProperties: Map<string, Map<string, Map<string, Map<string, FieldMetadata>>>>;
}

const state: P21State = {
  activeContext: {
    sectionActiveTabs: {},
  } as P21ActiveContext,
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> Set<fields>
  dataWindowSchemas: new Map<string, Map<string, Map<string, Set<string>>>>(),
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> rows[]
  allDataWindows: new Map<string, Map<string, Map<string, Record<string, unknown>[]>>>(),
  // Nested: Container (tab_1) -> TabPage (TABPAGE_1) -> DataWindow (shiptomain) -> Field -> Metadata
  windowFieldProperties: new Map<string, Map<string, Map<string, Map<string, FieldMetadata>>>>(),
};

type StateChangeSubscriber = (state: P21State) => void;
const subscribers = new Set<StateChangeSubscriber>();

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true' || localStorage.getItem('p21ExtDebugFull') === 'true';

const notifySubscribers = () => {
  subscribers.forEach((sub) => sub({ ...state }));
  window.dispatchEvent(new CustomEvent('p21-ext:state-updated', { detail: { state: getLoggableState() } }));
};

export const subscribe = (callback: StateChangeSubscriber) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

export const updateActiveContext = (context: Partial<P21ActiveContext>) => {
  state.activeContext = { ...state.activeContext, ...context };
  notifySubscribers();
};

export const updateSchemas = (containerId: string, tabName: string, dwName: string, fields: Set<string>) => {
  if (!state.dataWindowSchemas.has(containerId)) state.dataWindowSchemas.set(containerId, new Map());
  const container = state.dataWindowSchemas.get(containerId)!;
  if (!container.has(tabName)) container.set(tabName, new Map());
  const tab = container.get(tabName)!;
  const existing = tab.get(dwName) || new Set<string>();
  fields.forEach((f) => existing.add(f));
  tab.set(dwName, existing);
  notifySubscribers();
};

export const updateDataRows = (containerId: string, tabName: string, dwName: string, rows: Record<string, unknown>[]) => {
  if (!state.allDataWindows.has(containerId)) state.allDataWindows.set(containerId, new Map());
  const container = state.allDataWindows.get(containerId)!;
  if (!container.has(tabName)) container.set(tabName, new Map());
  container.get(tabName)!.set(dwName, rows);
  notifySubscribers();
};

export const updateFieldProperties = (containerId: string, tabName: string, dwName: string, fieldName: string, meta: FieldMetadata) => {
  if (!state.windowFieldProperties.has(containerId)) state.windowFieldProperties.set(containerId, new Map());
  const container = state.windowFieldProperties.get(containerId)!;
  if (!container.has(tabName)) container.set(tabName, new Map());
  const tab = container.get(tabName)!;
  if (!tab.has(dwName)) tab.set(dwName, new Map());
  tab.get(dwName)!.set(fieldName, meta);
  notifySubscribers();
};

/**
 * Interpretation logic formerly in trackActiveContext has moved to Context Manager.
 */
export const trackActiveContext = (_response: any, _url: string) => {
  console.warn(LOG_PREFIX, 'trackActiveContext is deprecated. Use Context Manager logic instead.');
};

export const getLoggableState = () => {
  return {
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
};

export const getActiveContext = () => {
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
  const { p21TabId, tabName: activeTabName, sectionActiveTabs } = state.activeContext;
  const entries: [string, Set<string>][] = [];

  // Iterate through all known sections (containers)
  for (const [containerId, container] of state.dataWindowSchemas.entries()) {
    const isPersistent = containerId === 'global' || containerId === 'unknown';

    // Determine the active tab for this section. Fallback to the primary active tab if it's the focused section.
    const activeTabForSection = sectionActiveTabs?.[containerId] || (containerId === p21TabId ? activeTabName : undefined);

    for (const [tabName, dws] of container.entries()) {
      // Rule: Include if it's a persistent bucket, a ROOT (header) DW,
      // or the specifically active tab for this section.
      const isActive = tabName === 'ROOT' || (activeTabForSection && tabName === activeTabForSection);

      if (isPersistent || isActive) {
        for (const [dwName, fields] of dws.entries()) {
          entries.push([tabName === 'ROOT' ? dwName : `${tabName}.${dwName}`, fields]);
        }
      }
    }
  }

  return entries;
};

export const getP21Value = (fieldName: string): any => {
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

const win = window as any;

if (!win.__p21StateStoreInstalled) {
  window.addEventListener('p21-ext:transaction-reset', (event: any) => {
    const { identity } = event.detail;
    state.activeContext = {
      windowName: state.activeContext.windowName,
      p21TabId: state.activeContext.p21TabId,
      sectionActiveTabs: {},
    };
    state.allDataWindows.clear();
    state.windowFieldProperties.clear();

    notifySubscribers();
    if (isDebugEnabled()) {
      console.info(LOG_PREFIX, `Transaction Reset: Wiping transient data/properties for identity "${identity}". Structural schemas preserved.`);
    }
  });
  win.__p21StateStoreInstalled = true;
}

win.__p21StateStore = {
  subscribe,
  updateActiveContext,
  updateSchemas,
  updateDataRows,
  updateFieldProperties,
  getActiveContext,
  getDataWindowSchema,
  getDataWindowSchemaCount,
  getDataWindowSchemaEntries,
  getP21Value,
  getFieldMetadata,
  getLoggableState,
};
