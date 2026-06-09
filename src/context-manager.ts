import type { P21DesignResponse, P21DataContextUpdatedDetail, P21DataWindowProperties, P21FieldProperty, P21ActiveContext } from './types/p21-types';
import type { P21XhrResponseEventDetail } from './types/request-types';
import { updateActiveContext, updateSchemas, updateDataRows, updateFieldProperties, getLoggableState, getActiveContext } from './state-store';
import { isAddressRelated } from './feature-router';

interface P21ContextMonitorWindow extends Window {
  __p21ContextMonitorInstalled?: boolean;
}

const contextMonitorWindow = window as P21ContextMonitorWindow;
const LOG_PREFIX = '[P21 CONTEXT]';

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';

/**
 * Interpretation Logic: Converts raw XHR responses into State Store updates.
 */
const interpretResponse = (response: any, url: string): void => {
  if (!response || typeof response !== 'object') return;

  // Guard: Skip non-normal states (checked/modified validation cycles)
  if (response.Result?.State && response.Result.State.toLowerCase() !== 'normal') return;

  const lowUrl = url.toLowerCase();
  const { Result, Data } = response;

  // 1. Identity Extraction
  let explicitTabName = '';
  try {
    const currentUrl = window.location.href;
    const urlObj = new URL(url, currentUrl);

    // Primary: Extract window name from current window location (most reliable for base context)
    const locMatch = currentUrl.match(/\/window\/(w_[a-z0-9_]+)/i);
    if (locMatch) updateActiveContext({ windowName: locMatch[1] });

    // Secondary: Extract window name from XHR path segments if present
    const pathSegments = urlObj.pathname.split('/');
    const windowSegment = pathSegments.find((s) => s.startsWith('w_') && s !== 'window');
    if (windowSegment) updateActiveContext({ windowName: windowSegment });

    // Tertiary: Extract from URL parameters
    const wn = urlObj.searchParams.get('wn');
    if (wn?.startsWith('w_')) updateActiveContext({ windowName: wn });

    // Extract dataWindow from grid state requests
    const dwNameParam = urlObj.searchParams.get('dwName');
    if (lowUrl.includes('/grid/') && dwNameParam) {
      updateActiveContext({ dataWindow: dwNameParam });
    }

    const tn = urlObj.searchParams.get('tn');
    if (lowUrl.includes('/data') && tn) explicitTabName = tn;
    if (lowUrl.includes('/design') && response.PageName) explicitTabName = response.PageName;

    if (explicitTabName) {
      updateActiveContext({ tabName: explicitTabName });
      deriveContainerId(explicitTabName);
    }
  } catch {
    /* ignore */
  }

  if (Result?.Name?.startsWith('w_') && Result.Name !== 'page') {
    updateActiveContext({ windowName: Result.Name });
  }

  // Extract tab identity from the Result object (standard for /design, /history, and /data)
  if (Result?.TabDefinition?.UniqueName) {
    const tabName = Result.TabDefinition.UniqueName;
    updateActiveContext({ tabName });
    deriveContainerId(tabName);
  }

  // 2. Structural Scanning (Multiprefs)
  if (Array.isArray(response) && lowUrl.includes('/window/multiprefs')) {
    response.forEach((p: any) => {
      if (p.PreferenceName === 'tab.pageorder' && typeof p.PreferenceValue === 'string') {
        const tabs = p.PreferenceValue.split(',').map((t: string) => t.trim().toUpperCase());
        // We update schemas for each tab found in the preference layout
        tabs.forEach((tab: string) => updateSchemas(p.ObjectName, tab, '_layout', new Set()));
      }
    });
    return;
  }

  // 3. Data & Schema Processing
  if (Data) {
    Object.entries(Data as Record<string, any>).forEach(([dwKey, value]) => {
      if (!value) return;
      const parts = dwKey.split('.');
      const tabName = parts.length > 1 ? parts[0] : 'ROOT';
      const dwName = parts.length > 1 ? parts[1] : parts[0];
      const containerId = deriveContainerId(tabName);

      const sample = Array.isArray(value) ? value[0] : value;
      if (sample) updateSchemas(containerId, tabName, dwName, new Set(Object.keys(sample)));

      const rows = Array.isArray(value) ? value : [value];
      updateDataRows(containerId, tabName, dwName, rows);
    });
  }

  // 4. Property Processing
  if (Result?.PropertiesSet) processProperties(Result.PropertiesSet, containerPath());
  if (Result?.Properties) {
    Object.entries(Result.Properties).forEach(([path, props]) => {
      processProperties(props as P21DataWindowProperties, path);
    });
  }
};

const containerPath = () => {
  const ctx = getActiveContext();
  return ctx.tabName && ctx.dataWindow ? `${ctx.tabName}.${ctx.dataWindow}` : '';
};

const deriveContainerId = (tabName: string): string => {
  const ctx = getActiveContext();
  if (!tabName) return ctx.p21TabId || 'unknown';

  const normalizedTab = tabName.toUpperCase();
  const internalState = getLoggableState();

  // Proactively search the registry to find which container (tab_1, tab_2) owns this tab name.
  for (const [containerId, tabs] of Object.entries(internalState.dataWindowSchemas)) {
    if (containerId === 'unknown' || containerId === 'global') continue;
    if ((tabs as any)[normalizedTab]) {
      const sectionActiveTabs = { ...(ctx.sectionActiveTabs || {}), [containerId]: normalizedTab };
      const updates: Partial<P21ActiveContext> = { sectionActiveTabs };

      if (ctx.tabName?.toUpperCase() === normalizedTab) {
        updates.p21TabId = containerId;
      } else if (!ctx.p21TabId && !ctx.tabName) {
        updates.tabName = normalizedTab;
        updates.p21TabId = containerId;
      }

      if (ctx.p21TabId !== updates.p21TabId || ctx.sectionActiveTabs?.[containerId] !== normalizedTab) {
        updateActiveContext(updates);
      }
      return containerId;
    }
  }

  return ctx.tabName?.toUpperCase() === normalizedTab ? ctx.p21TabId || 'unknown' : 'unknown';
};

const processProperties = (container: P21DataWindowProperties, path: string) => {
  const update = (entry: P21FieldProperty, type: string) => {
    const rowIndex = entry._internalrowindex;
    if (rowIndex !== undefined && String(rowIndex) !== '1' && String(rowIndex) !== '0') return;

    const fullPath = (entry.tabpagename && entry.dwname ? `${entry.tabpagename}.${entry.dwname}` : path) || '';
    const [tName, dName] = fullPath.split('.');

    Object.entries(entry).forEach(([field, val]) => {
      if (['_internalrowindex', 'Properties_Id', 'dwname', 'tabpagename'].includes(field)) return;
      const isTrue = val === 'true' || val === true || val === '1' || val === 1;
      updateFieldProperties(deriveContainerId(tName), tName, dName, field, {
        visible: type !== 'enabled' ? isTrue : true,
        enabled: type === 'enabled' ? isTrue : true,
      });
    });
  };

  container.visible?.forEach((e) => update(e, 'visible'));
  container.enabled?.forEach((e) => update(e, 'enabled'));
  container.Properties?.forEach((e) => update(e, 'generic'));
};

export const installP21ContextMonitor = (): void => {
  if (contextMonitorWindow.__p21ContextMonitorInstalled) return;
  contextMonitorWindow.__p21ContextMonitorInstalled = true;

  window.addEventListener('p21-ext:xhr-response', (event) => {
    const detail = (event as CustomEvent<P21XhrResponseEventDetail>).detail;
    const response = detail.responseValue as P21DesignResponse;
    if (!response || typeof response !== 'object') return;

    interpretResponse(detail.responseValue, detail.url);

    if (isDebugEnabled()) {
      console.log(`${LOG_PREFIX} State interpreted for: ${detail.url}`, getLoggableState());
    }

    window.dispatchEvent(
      new CustomEvent<P21DataContextUpdatedDetail>('p21-ext:data-context-updated', {
        detail: {
          response,
          url: detail.url,
          method: detail.method,
          isAddressRelated: isAddressRelated(response),
          isStructuralRescan: detail.url.includes('/design') || Boolean(response.Result) || detail.endpointKind === 'data',
          isHistoryNavigation: detail.url.includes('/history'),
        },
      }),
    );
  });
};

installP21ContextMonitor();
