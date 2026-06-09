import type { P21DesignResponse, P21EventData } from './types/p21-types';

/**
 * Layer 1 - DOM Monitor: Intercepts interactions and broadcasts them as raw events.
 */

interface ActionMonitorWindow extends Window {
  __p21DomMonitorInstalled?: boolean;
  angular?: any;
}

const monitorWindow = window as unknown as ActionMonitorWindow;
const LOG_PREFIX = '[P21 DOM]';

interface P21ActionEvent {
  source: 'DOM' | 'Server';
  name: string;
  target?: string;
  data?: unknown;
  timestamp: number;
}

/**
 * Centralized logger for P21 actions.
 * Enforces the P21ActionEvent interface and handles output formatting.
 */
const logAction = (event: P21ActionEvent): void => {
  // Guard: Ensure action is not empty before processing or broadcasting.
  if (!event || !event.name) return;

  const shouldLog = localStorage.getItem('p21ExtDebugFull') === 'true';

  if (shouldLog) {
    console.log(`${LOG_PREFIX} [${event.source}] ${event.name}`, event);
  }

  window.dispatchEvent(
    new CustomEvent('p21-ext:action-monitor-event', {
      detail: event,
    }),
  );
};

/**
 * Sets up global event listeners to track user interactions without
 * interfering with the application's internal event registration.
 */
const setupDomObservation = () => {
  const eventsToTrack = ['click'];

  eventsToTrack.forEach((type) => {
    window.addEventListener(
      type,
      (event) => {
        const target = event.target as HTMLElement;
        if (!target || !target.tagName) return;

        // Detect jQuery Listeners (often where P21 hides its native logic)
        const jqListeners: Record<string, number> = {};
        const jQuery = (window as any).jQuery;
        if (jQuery && target) {
          const internalEvents = jQuery._data(target, 'events');
          if (internalEvents && internalEvents[type]) {
            jqListeners[type] = internalEvents[type].length;
          }
        }

        logAction({
          source: 'DOM',
          name: type,
          target: `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}`,
          data: {
            dataKey: target.getAttribute('data-key'),
            value: target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : undefined,
            hasScope: !!(monitorWindow.angular && monitorWindow.angular.element(target).scope()),
            jqListenerCount: jqListeners[type] || 0,
          },
          timestamp: Date.now(),
        });
      },
      true,
    ); // Use capture phase to ensure we see the event even if propagation is stopped
  });
};

/**
 * Monitors P21 server-side events that arrive in XHR response payloads.
 */
const setupResponseObservation = () => {
  window.addEventListener('p21-ext:xhr-response', (event: any) => {
    const detail = event.detail;
    const response = detail.responseValue as P21DesignResponse;

    if (!response || !Array.isArray(response.Events)) return;

    response.Events.forEach((p21Event: { EventData?: P21EventData; Name?: string; Publisher?: string }) => {
      // Filter out empty or unidentifiable server events
      if (!p21Event.Name) return;

      const data = (p21Event.EventData || {}) as P21EventData;

      // Extract target hierarchy from the event data for better context (e.g. "Order Entry > Ship To > Address1")
      const targetParts = [data.window_classname, data.tabpagename, data.datawindowname, data.dwproperty_column].filter(Boolean);

      logAction({
        source: 'Server',
        name: p21Event.Name,
        target: targetParts.length > 0 ? targetParts.join(' > ') : p21Event.Publisher,
        data: p21Event,
        timestamp: Date.now(),
      });
    });
  });
};

if (!monitorWindow.__p21DomMonitorInstalled) {
  monitorWindow.__p21DomMonitorInstalled = true;
  setupDomObservation();
  setupResponseObservation();
}
