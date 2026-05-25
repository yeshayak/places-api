import { evaluateAutomationRules } from './automation-rules';
import { isFollowUpXhr, subscribeFollowUpResult } from './follow-up-requests';
import { parseP21Payload, parseP21Request, type ParsedP21Payload } from './request-parser';

interface XhrWatcherOptions {
  debug?: boolean;
}

interface XhrContext {
  requestId: number;
  method: string;
  url: string;
  async?: boolean;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  isFollowUp?: boolean;
  shouldLog?: boolean;
}

interface WatcherWindow extends Window {
  __p21XhrWatcherInstalled?: boolean;
}

interface P21XhrResponseEventDetail {
  requestId: number;
  method: string;
  url: string;
  endpointKind: string;
  requestValue?: unknown;
  responseValue?: unknown;
}

const LOG_PREFIX = '[P21 EXT]';
const DEBUG_KEY = 'p21ExtDebug';
const DEBUG_FULL_KEY = 'p21ExtDebugFull';
const watcherWindow = window as WatcherWindow;

let nextRequestId = 1;

export const installXhrWatcher = (options: XhrWatcherOptions = {}): void => {
  if (watcherWindow.__p21XhrWatcherInstalled) {
    return;
  }

  watcherWindow.__p21XhrWatcherInstalled = true;

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const contexts = new WeakMap<XMLHttpRequest, XhrContext>();

  XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null): void {
    contexts.set(this, {
      requestId: nextRequestId++,
      method,
      url: String(url),
      async,
      requestHeaders: {},
    });

    return nativeOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  };

  const nativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: string): void {
    const context = contexts.get(this);
    if (context) {
      context.requestHeaders[name] = value;
    }

    return nativeSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const context = contexts.get(this);

    if (context) {
      context.requestBody = body;
      context.isFollowUp = isFollowUpXhr(this);

      const parsedRequest = parseP21Request({
        method: context.method,
        url: context.url,
        body: bodyToLoggableValue(body),
      });
      context.shouldLog = shouldLogRequest(options, parsedRequest.endpointKind);

      logIfEnabled(context.shouldLog, {
        type: 'xhr-request',
        requestId: context.requestId,
        method: context.method,
        url: parsedRequest.normalizedUrl,
        endpointKind: parsedRequest.endpointKind,
        headers: context.requestHeaders,
        requestSummary: parsedRequest.requestSummary.summary,
        responseSummary: undefined,
        parseErrors: collectParseErrors(parsedRequest.requestSummary),
      });

      this.addEventListener('loadend', () => {
        const responseSummary = parseResponse(this);
        const latestRequest = parseP21Request({
          method: context.method,
          url: context.url,
          body: bodyToLoggableValue(context.requestBody),
        });
        const automationEvents = context.isFollowUp
          ? []
          : evaluateAutomationRules({
              requestId: context.requestId,
              method: context.method,
              request: latestRequest,
              response: responseSummary,
              sourceRequest: {
                method: context.method,
                url: context.url,
                body: bodyToLoggableValue(context.requestBody),
                headers: { ...context.requestHeaders },
                parsedRequest: latestRequest,
              },
            });

        dispatchXhrResponseEvent({
          requestId: context.requestId,
          method: context.method,
          url: latestRequest.normalizedUrl,
          endpointKind: latestRequest.endpointKind,
          requestValue: latestRequest.requestSummary.value,
          responseValue: responseSummary.value,
        });

        logIfEnabled(context.shouldLog === true, {
          type: 'xhr-response',
          requestId: context.requestId,
          method: context.method,
          url: latestRequest.normalizedUrl,
          endpointKind: latestRequest.endpointKind,
          headers: context.requestHeaders,
          isFollowUp: context.isFollowUp,
          requestSummary: latestRequest.requestSummary.summary,
          responseSummary: responseSummary.summary,
          automationEvents,
          parseErrors: [...collectParseErrors(latestRequest.requestSummary), ...collectParseErrors(responseSummary)],
        });

        for (const automationEvent of automationEvents) {
          logRelevant({
            type: 'automation-match',
            event: automationEvent.type,
            ruleId: automationEvent.ruleId,
            requestId: automationEvent.requestId,
            url: automationEvent.url,
            evidence: automationEvent.evidence,
          });
        }
      });
    }

    return nativeSend.call(this, body ?? null);
  };

  logIfEnabled(true, {
    type: 'xhr-watcher-installed',
    requestId: undefined,
    method: undefined,
    url: window.location.href,
    endpointKind: undefined,
    session: undefined,
    requestSummary: undefined,
    responseSummary: undefined,
    parseErrors: [],
  });
};

const dispatchXhrResponseEvent = (detail: P21XhrResponseEventDetail): void => {
  window.dispatchEvent(
    new CustomEvent<P21XhrResponseEventDetail>('p21-ext:xhr-response', {
      detail,
    }),
  );
};

subscribeFollowUpResult((result) => {
  logRelevant({
    type: 'follow-up-result',
    correlationId: result.correlationId,
    templateId: result.templateId,
    reason: result.reason,
    ok: result.ok,
    url: result.url,
    error: result.error,
  });
});

const parseResponse = (xhr: XMLHttpRequest): ParsedP21Payload => {
  if (xhr.responseType && xhr.responseType !== 'text' && xhr.responseType !== 'json') {
    return { isJson: false };
  }

  if (xhr.responseType === 'json') {
    return parseP21Payload(xhr.response);
  }

  try {
    return parseP21Payload(xhr.responseText);
  } catch (error) {
    return {
      isJson: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const bodyToLoggableValue = (body: unknown): unknown => {
  if (body instanceof Document) {
    return '[Document]';
  }

  if (body instanceof FormData) {
    return Object.fromEntries(body.entries());
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Blob) {
    return `[Blob size=${body.size} type=${body.type}]`;
  }

  if (body instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${body.byteLength}]`;
  }

  if (ArrayBuffer.isView(body)) {
    return `[${body.constructor.name} byteLength=${body.byteLength}]`;
  }

  return body ?? undefined;
};

const collectParseErrors = (payload: ParsedP21Payload): string[] => (payload.error ? [payload.error] : []);

const isDebugEnabled = (): boolean => localStorage.getItem(DEBUG_KEY) === 'true';
const isFullDebugEnabled = (): boolean => localStorage.getItem(DEBUG_FULL_KEY) === 'true';

const shouldLogRequest = (options: XhrWatcherOptions, endpointKind: string): boolean => {
  return isFullDebugEnabled() && (endpointKind !== 'unknown' || options.debug === true);
};

const logIfEnabled = (shouldLog: boolean, event: Record<string, unknown>): void => {
  if (!shouldLog || !isFullDebugEnabled()) {
    return;
  }

  console.log(LOG_PREFIX, event);
};

const logRelevant = (event: Record<string, unknown>): void => {
  if (isDebugEnabled() || isFullDebugEnabled()) {
    console.log(LOG_PREFIX, event);
  }
};

installXhrWatcher();
