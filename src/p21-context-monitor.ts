import type { P21DesignResponse } from './utils/p21-session';
import { isAddressRelated, trackActiveContext } from './p21-data-endpoint';

interface P21ContextMonitorWindow extends Window {
  __p21ContextMonitorInstalled?: boolean;
}

export interface P21DataContextUpdatedDetail {
  response: P21DesignResponse;
  url: string;
  method: string;
  isAddressRelated: boolean;
  isStructuralRescan: boolean;
  isHistoryNavigation: boolean;
}

const contextMonitorWindow = window as P21ContextMonitorWindow;

export const installP21ContextMonitor = (): void => {
  if (contextMonitorWindow.__p21ContextMonitorInstalled) return;
  contextMonitorWindow.__p21ContextMonitorInstalled = true;

  window.addEventListener('p21-ext:xhr-response', (event) => {
    const detail = (event as CustomEvent<{ responseValue?: unknown; url: string; method: string }>).detail;
    const response = detail.responseValue as P21DesignResponse;

    if (!response || typeof response !== 'object') return;
    if (detail.method === 'PUT' || detail.method === 'PATCH') return;

    trackActiveContext(response, detail.url);

    // P21 returns Result for many non-structural requests. We exclude them to reduce noise.
    const isStructuralRescan =
      detail.url.includes('Quick.Clear') || detail.url.includes('Quick.Save') || detail.url.includes('/design') || (Boolean(response.Result) && !detail.url.includes('fastedit/settings') && !detail.url.includes('/ui/common/v1/alerts'));

    window.dispatchEvent(
      new CustomEvent<P21DataContextUpdatedDetail>('p21-ext:data-context-updated', {
        detail: {
          response,
          url: detail.url,
          method: detail.method,
          isAddressRelated: isAddressRelated(response),
          isStructuralRescan,
          isHistoryNavigation: detail.url.includes('/history'),
        },
      }),
    );
  });
};

installP21ContextMonitor();
