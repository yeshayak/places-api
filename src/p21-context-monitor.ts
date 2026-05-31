import type { P21DesignResponse, P21DataContextUpdatedDetail } from './types/p21-types';
import { trackActiveContext } from './state-store';
import { isAddressRelated } from './endpoint-router';

interface P21ContextMonitorWindow extends Window {
  __p21ContextMonitorInstalled?: boolean;
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
    window.dispatchEvent(
      new CustomEvent<P21DataContextUpdatedDetail>('p21-ext:data-context-updated', {
        detail: {
          response,
          url: detail.url,
          method: detail.method,
          isAddressRelated: isAddressRelated(response),
          isStructuralRescan: detail.url.includes('/design') || Boolean(response.Result),
          isHistoryNavigation: detail.url.includes('/history'),
        },
      }),
    );
  });
};

installP21ContextMonitor();
