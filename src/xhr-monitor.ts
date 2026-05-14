import { parseP21Payload, parseP21Request, ParsedP21Payload } from './request-parser';

interface XhrWatcherOptions {
  debug?: boolean;
}

interface XhrContext {
  requestId: number;
  method: string;
  url: string;
  async?: boolean;
  requestBody?: unknown;
  shouldLog?: boolean;
}

interface WatcherWindow extends Window {
  __p21XhrWatcherInstalled?: boolean;
}

const LOG_PREFIX = '[P21 EXT]';
const DEBUG_STORAGE_KEY = 'p21ExtDebug';
const LOG_ALL_XHR_STORAGE_KEY = 'p21ExtLogAllXhr';
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

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    contexts.set(this, {
      requestId: nextRequestId++,
      method,
      url: String(url),
      async,
    });

    return nativeOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const context = contexts.get(this);

    if (context) {
      context.requestBody = body;

      const parsedRequest = parseP21Request({
        method: context.method,
        url: context.url,
        body: bodyToLoggableValue(body),
      });
      context.shouldLog = shouldLogRequest(options, parsedRequest.endpointKind);

      logIfEnabled(options, context.shouldLog, {
        type: 'xhr-request',
        requestId: context.requestId,
        method: context.method,
        url: parsedRequest.normalizedUrl,
        endpointKind: parsedRequest.endpointKind,
        session: parsedRequest.session,
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

        logIfEnabled(options, context.shouldLog === true, {
          type: 'xhr-response',
          requestId: context.requestId,
          method: context.method,
          url: latestRequest.normalizedUrl,
          endpointKind: latestRequest.endpointKind,
          session: latestRequest.session,
          requestSummary: latestRequest.requestSummary.summary,
          responseSummary: responseSummary.summary,
          parseErrors: [...collectParseErrors(latestRequest.requestSummary), ...collectParseErrors(responseSummary)],
        });
      });
    }

    return nativeSend.call(this, body ?? null);
  };

  logIfEnabled(options, true, {
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

const isDebugEnabled = (options: XhrWatcherOptions): boolean => {
  if (options.debug !== undefined) {
    return options.debug;
  }

  return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
};

const shouldLogRequest = (options: XhrWatcherOptions, endpointKind: string): boolean => {
  if (!isDebugEnabled(options)) {
    return false;
  }

  return endpointKind !== 'unknown' || localStorage.getItem(LOG_ALL_XHR_STORAGE_KEY) === 'true';
};

const logIfEnabled = (options: XhrWatcherOptions, shouldLog: boolean, event: Record<string, unknown>): void => {
  if (!shouldLog || !isDebugEnabled(options)) {
    return;
  }

  console.log(LOG_PREFIX, event);
};

installXhrWatcher();
