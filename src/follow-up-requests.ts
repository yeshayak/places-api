import { type P21AutomationEvent, subscribeAutomationEvent } from './automation-rules';
import type { ParsedP21Request } from './request-parser';

export type FollowUpReason = 'pricing-recalculation' | 'related-item-update' | 'populate-defaults' | 'autocomplete-address-update' | 'custom';

export interface FollowUpSourceRequest {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  parsedRequest?: ParsedP21Request;
}

export interface FollowUpRequestTemplate {
  id: string;
  reason: FollowUpReason;
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  correlateTo?: string;
}

export interface FollowUpRequestResult {
  correlationId: string;
  templateId: string;
  reason: FollowUpReason;
  method: string;
  url: string;
  ok: boolean;
  status: number;
  responseText?: string;
  error?: string;
}

export type FollowUpRequestSubscriber = (result: FollowUpRequestResult) => void;
export type FollowUpRequestPlanner = (event: P21AutomationEvent) => FollowUpRequestTemplate | FollowUpRequestTemplate[] | undefined;

interface FollowUpWindow extends Window {
  __p21FollowUpRequests?: {
    buildTemplateFromSource: typeof buildTemplateFromSource;
    clonePayload: typeof clonePayload;
    getInFlightCount: typeof getInFlightCount;
    registerPlanner: typeof registerFollowUpPlanner;
    send: typeof sendFollowUpRequest;
    subscribe: typeof subscribeFollowUpResult;
  };
}

const FOLLOW_UP_HEADER = 'X-P21-Ext-Follow-Up';
const MAX_IN_FLIGHT = 3;
const RECENT_CORRELATION_TTL_MS = 30000;
const followUpXhrs = new WeakSet<XMLHttpRequest>();
const inFlightCorrelations = new Set<string>();
const recentCorrelations = new Map<string, number>();
const subscribers = new Set<FollowUpRequestSubscriber>();
const planners = new Set<FollowUpRequestPlanner>();
const followUpWindow = window as FollowUpWindow;

let nextCorrelationId = 1;

export const isFollowUpXhr = (xhr: XMLHttpRequest): boolean => followUpXhrs.has(xhr);

export const getInFlightCount = (): number => inFlightCorrelations.size;

export const clonePayload = <T>(value: T): T => {
  if (value === undefined || value === null) return value;

  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

export const buildTemplateFromSource = (
  source: FollowUpSourceRequest,
  overrides: Omit<FollowUpRequestTemplate, 'method' | 'url' | 'body' | 'headers'> & Partial<Pick<FollowUpRequestTemplate, 'method' | 'url' | 'body' | 'headers'>>,
): FollowUpRequestTemplate => ({
  ...overrides,
  method: overrides.method ?? source.method,
  url: overrides.url ?? source.url,
  body: overrides.body ?? clonePayload(source.body),
  headers: {
    ...source.headers,
    ...overrides.headers,
  },
});

export const sendFollowUpRequest = (template: FollowUpRequestTemplate, source?: FollowUpSourceRequest): Promise<FollowUpRequestResult> => {
  const method = template.method ?? source?.method ?? 'POST';
  const sourceUrl = template.url ?? source?.url;
  const correlationId = template.correlateTo ?? createCorrelationId(template.id);

  if (!sourceUrl) {
    return Promise.resolve(createFailure(template, method, '', correlationId, 'Follow-up request is missing a URL.'));
  }

  clearExpiredCorrelations();

  if (inFlightCorrelations.size >= MAX_IN_FLIGHT) {
    return Promise.resolve(createFailure(template, method, sourceUrl, correlationId, 'Too many follow-up requests in flight.'));
  }

  if (inFlightCorrelations.has(correlationId) || recentCorrelations.has(correlationId)) {
    return Promise.resolve(createFailure(template, method, sourceUrl, correlationId, 'Duplicate follow-up correlation skipped.'));
  }

  const url = sourceUrl;
  const body = template.body ?? clonePayload(source?.body);
  const headers = compactHeaders({
    ...source?.headers,
    ...template.headers,
    [FOLLOW_UP_HEADER]: correlationId,
  });
  const serializedBody = serializeBody(body, headers);

  inFlightCorrelations.add(correlationId);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    followUpXhrs.add(xhr);
    xhr.open(method, url, true);
    xhr.withCredentials = true;

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.addEventListener('loadend', () => {
      const result: FollowUpRequestResult = {
        correlationId,
        templateId: template.id,
        reason: template.reason,
        method,
        url,
        ok: xhr.status >= 200 && xhr.status < 400,
        status: xhr.status,
        responseText: safeResponseText(xhr),
        error: xhr.status >= 400 ? `Request failed with status ${xhr.status}` : undefined,
      };

      finishCorrelation(correlationId);
      notifyFollowUpResult(result);
      resolve(result);
    });

    xhr.addEventListener('error', () => {
      const result = createFailure(template, method, url, correlationId, 'Follow-up request network error.');
      finishCorrelation(correlationId);
      notifyFollowUpResult(result);
      resolve(result);
    });

    xhr.send(serializedBody);
  });
};

export const registerFollowUpPlanner = (planner: FollowUpRequestPlanner): (() => void) => {
  planners.add(planner);
  return () => planners.delete(planner);
};

export const subscribeFollowUpResult = (subscriber: FollowUpRequestSubscriber): (() => void) => {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
};

subscribeAutomationEvent((event) => {
  for (const planner of planners) {
    const planned = planner(event);
    const templates = Array.isArray(planned) ? planned : planned ? [planned] : [];

    for (const template of templates) {
      void sendFollowUpRequest(
        {
          ...template,
          correlateTo: template.correlateTo ?? `${event.requestId}:${event.ruleId}:${template.id}`,
        },
        event.sourceRequest,
      );
    }
  }
});

followUpWindow.__p21FollowUpRequests = {
  buildTemplateFromSource,
  clonePayload,
  getInFlightCount,
  registerPlanner: registerFollowUpPlanner,
  send: sendFollowUpRequest,
  subscribe: subscribeFollowUpResult,
};

const serializeBody = (body: unknown, headers: Record<string, string>): Document | XMLHttpRequestBodyInit | null => {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string' || body instanceof Document || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body as Document | XMLHttpRequestBodyInit;
  }

  if (!hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json;charset=UTF-8';
  }

  return JSON.stringify(body);
};

const compactHeaders = (headers: Record<string, string | undefined>): Record<string, string> => {
  const compacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 0) {
      compacted[key] = value;
    }
  }

  return compacted;
};

const hasHeader = (headers: Record<string, string>, headerName: string): boolean => {
  const normalizedHeaderName = headerName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedHeaderName);
};

const safeResponseText = (xhr: XMLHttpRequest): string | undefined => {
  if (xhr.responseType && xhr.responseType !== 'text') return undefined;

  try {
    return xhr.responseText;
  } catch {
    return undefined;
  }
};

const createCorrelationId = (templateId: string): string => `p21-follow-up:${templateId}:${nextCorrelationId++}`;

const createFailure = (template: FollowUpRequestTemplate, method: string, url: string, correlationId: string, error: string): FollowUpRequestResult => ({
  correlationId,
  templateId: template.id,
  reason: template.reason,
  method,
  url,
  ok: false,
  status: 0,
  error,
});

const finishCorrelation = (correlationId: string): void => {
  inFlightCorrelations.delete(correlationId);
  recentCorrelations.set(correlationId, Date.now());
};

const clearExpiredCorrelations = (): void => {
  const oldestAllowed = Date.now() - RECENT_CORRELATION_TTL_MS;
  for (const [correlationId, completedAt] of recentCorrelations) {
    if (completedAt < oldestAllowed) {
      recentCorrelations.delete(correlationId);
    }
  }
};

const notifyFollowUpResult = (result: FollowUpRequestResult): void => {
  for (const subscriber of subscribers) {
    subscriber(result);
  }

  window.dispatchEvent(
    new CustomEvent<FollowUpRequestResult>('p21-ext:follow-up-result', {
      detail: result,
    }),
  );
};
