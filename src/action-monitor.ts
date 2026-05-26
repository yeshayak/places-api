import type { P21DesignResponse, P21EventData } from './utils/p21-session';

/**
 * Action Monitor: Intercepts DOM and AngularJS events to map P21 lifecycles.
 */

interface ActionMonitorWindow extends Window {
  __p21ActionMonitorInstalled?: boolean;
  __p21ActionMonitor?: {
    fire: typeof fireP21Action;
    trigger: typeof triggerDomEvent;
    inspect: typeof inspectElement;
  };
  angular?: any;
}

const monitorWindow = window as unknown as ActionMonitorWindow;
const LOG_PREFIX = '[P21 ACTION]';

interface P21ActionEvent {
  source: 'DOM' | 'Angular' | 'Server';
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
  // Action Monitor captures system-wide activity (observations).
  // To keep "Relevant" logs focused on Extension actions, we move these to "Full".
  const shouldLog = localStorage.getItem('p21ExtDebugFull') === 'true';

  if (shouldLog) {
    console.log(`${LOG_PREFIX} [${event.source}] ${event.name}`, event);
  }

  // Dispatch a custom event for other modules (like automation-rules) to consume
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
  const eventsToTrack = ['click', 'dblclick', 'change', 'input', 'keydown', 'keyup', 'focus', 'blur', 'compositionstart', 'compositionupdate', 'compositionend'];

  eventsToTrack.forEach((type) => {
    window.addEventListener(
      type,
      (event) => {
        const target = event.target as HTMLElement;
        if (!target || !target.tagName) return;

        const controllers: Record<string, { methods: string[]; isInherited: boolean }> = {};
        if (monitorWindow.angular) {
          const el = monitorWindow.angular.element(target);

          // P21 Native Controller Discovery
          const p21CoreControllers = ['ngModel', 'p21Datawindow', 'p21Form', 'p21Grid', 'p21Input'];
          p21CoreControllers.forEach((name) => {
            const ctrl = el.inheritedData(`$${name}Controller`);
            if (ctrl) {
              controllers[name] = {
                methods: Object.keys(ctrl).filter((k) => typeof ctrl[k] === 'function' && !k.startsWith('$')),
                isInherited: !el.data(`$${name}Controller`),
              };
            }
          });

          // Also look for any local controllers on this element
          const data = el.data() || {};
          if (data) {
            Object.keys(data).forEach((key) => {
              if (key.startsWith('$') && key.endsWith('Controller')) {
                const cleanName = key.substring(1, key.length - 10);
                if (controllers[cleanName]) return;

                const ctrl = data[key];
                controllers[cleanName] = {
                  methods: Object.keys(ctrl).filter((k) => typeof ctrl[k] === 'function' && !k.startsWith('$')),
                  isInherited: false,
                };
              }
            });
          }
        }

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
            controllers,
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
 * Hooks into the AngularJS $rootScope to monitor internal messaging.
 */
const patchAngularEvents = () => {
  const ng = monitorWindow.angular;
  if (!ng) return;

  const tryHook = () => {
    const rootElement = document.querySelector('.p21-main-container, [ng-app], body');
    if (!rootElement) return false;

    const $rootScope = ng.element(rootElement).scope()?.$root;
    if (!$rootScope) return false;

    // Prevent double-patching if the script is re-injected
    if (($rootScope as any).__p21Patched) return true;
    ($rootScope as any).__p21Patched = true;

    const originalBroadcast = $rootScope.$broadcast;
    const originalEmit = $rootScope.$emit;

    $rootScope.$broadcast = function patchedBroadcast(name: string, ...args: any[]) {
      const scope = this as any;
      logAction({
        source: 'Angular',
        name: `$broadcast:${name}`,
        target: scope.$id ? `Scope(${scope.$id})` : 'RootScope',
        data: args,
        timestamp: Date.now(),
      });
      return originalBroadcast.apply(scope, [name, ...args]);
    };

    $rootScope.$emit = function patchedEmit(name: string, ...args: any[]) {
      const scope = this as any;
      logAction({
        source: 'Angular',
        name: `$emit:${name}`,
        target: scope.$id ? `Scope(${scope.$id})` : 'RootScope',
        data: args,
        timestamp: Date.now(),
      });
      return originalEmit.apply(scope, [name, ...args]);
    };

    // Monitor internal navigation which often signifies record or tab changes
    $rootScope.$on('$locationChangeSuccess', (_ev: any, newUrl: string, oldUrl: string) => {
      logAction({
        source: 'Angular',
        name: 'Navigation',
        data: { newUrl, oldUrl },
        timestamp: Date.now(),
      });
    });

    console.log(LOG_PREFIX, 'Angular event interception active.');
    return true;
  };

  // Retry until Angular is fully bootstrapped
  const interval = setInterval(() => {
    if (tryHook()) clearInterval(interval);
  }, 500);
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
      const data = (p21Event.EventData || {}) as P21EventData;

      // Extract target hierarchy from the event data for better context (e.g. "Order Entry > Ship To > Address1")
      const targetParts = [data.window_classname, data.tabpagename, data.datawindowname, data.dwproperty_column].filter(Boolean);

      logAction({
        source: 'Server',
        name: p21Event.Name || 'UnknownEvent',
        target: targetParts.length > 0 ? targetParts.join(' > ') : p21Event.Publisher,
        data: p21Event,
        timestamp: Date.now(),
      });
    });
  });
};

/**
 * Helper to inspect the Angular state of any element via the console.
 */
export const inspectElement = (selector: string | HTMLElement) => {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!element || !monitorWindow.angular) return;

  const el = monitorWindow.angular.element(element);
  console.log(`${LOG_PREFIX} Inspecting:`, element);
  console.log('Scope:', el.scope());
  console.log('Data/Controllers:', el.data());

  const dw = el.inheritedData('$p21DatawindowController');
  if (dw) {
    console.log('Parent DataWindow Controller:', dw);
  }
};

/**
 * Manually triggers a DOM event on an element.
 * Useful for simulating user input to trigger P21's internal listeners.
 */
export const triggerDomEvent = (selector: string, eventType: string = 'change', newValue?: any) => {
  const element = document.querySelector(selector) as HTMLElement;
  if (!element) {
    console.warn(`${LOG_PREFIX} Element not found for selector: ${selector}`);
    return;
  }
  const jQuery = (window as any).jQuery;
  const ng = monitorWindow.angular;

  console.log(`${LOG_PREFIX} [Manual Trigger] Initiating native sequence on ${selector}${newValue !== undefined ? ` (value: "${newValue}")` : ''}`);

  if (jQuery) {
    const $el = jQuery(element);

    // 1. Focus the element to start the native P21 interaction state
    $el.trigger('focus');

    // 2. Set the value using jQuery's .val() - P21's ngModel wraps this
    if (newValue !== undefined) {
      $el.val(newValue);
      $el.trigger('input'); // Notifies internal Angular listeners of typing
    }

    // 3. Trigger the primary action event (usually 'change')
    $el.trigger(eventType);

    // 4. Trigger 'blur' - This is the "Commit" signal discovered in the logs
    // This specifically kicks off the P21 network sync lifecycle.
    $el.trigger('blur');

    // Neutralize focus to ensure the P21 controller processes the completion
    const looper = document.querySelector('#tabLooperEnd') || document.body;
    jQuery(looper).trigger('focus');
  } else {
    // Fallback for standard DOM if jQuery isn't found
    if (newValue !== undefined && element instanceof HTMLInputElement) element.value = newValue;
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Final Angular digest to ensure view-model consistency
  if (ng) {
    const scope = ng.element(element).scope();
    if (scope) scope.$apply();
  }
};

/**
 * Manually triggers a P21 Angular event.
 * Useful for testing full lifecycles (e.g., forcing a save or refresh).
 */
export const fireP21Action = (eventName: string, data: any = {}) => {
  const ng = monitorWindow.angular;
  const rootElement = document.querySelector('.p21-main-container, [ng-app], body');
  if (ng && rootElement) {
    const $rootScope = ng.element(rootElement).scope()?.$root;
    if ($rootScope) {
      logAction({
        source: 'Angular',
        name: `ManualTrigger:${eventName}`,
        data,
        timestamp: Date.now(),
      });
      $rootScope.$broadcast(eventName, data);
      $rootScope.$apply();
    }
  }
};

if (!monitorWindow.__p21ActionMonitorInstalled) {
  monitorWindow.__p21ActionMonitorInstalled = true;
  setupDomObservation();
  patchAngularEvents();
  setupResponseObservation();

  monitorWindow.__p21ActionMonitor = {
    fire: fireP21Action,
    trigger: triggerDomEvent,
    inspect: inspectElement,
  };
}
