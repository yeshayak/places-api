import type { P21EndpointKind, ParsedP21Request, ParsedP21Payload, P21PayloadSummary } from '../types/request-types';

interface ParseP21RequestInput {
  method: string;
  url: string;
  body?: unknown;
}

const STATIC_ASSET_REGEX = /\.(js|css|html|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot|ico|json)$/i;

const ENDPOINT_MATCHERS: Array<[P21EndpointKind, (path: string) => boolean]> = [
  ['data', (path) => path.endsWith('/ui/full/v2/data/data') || path.endsWith('/ui/full/v1/data/data')],
  ['design', (path) => path.includes('/design')],
  ['clear', (path) => path.includes('/tools/Quick.Clear')],
  ['save', (path) => path.includes('/tools/Quick.Save')],
  ['history', (path) => path.includes('/ui/full/v2/window/history')],
  ['multiprefs', (path) => path.includes('/window/multiprefs')],
  ['grid', (path) => path.includes('/ui/full/v1/grid')],
  ['transaction', (path) => path.includes('/api/v2/transaction') || path.includes('/transaction')],
];

export const parseP21Request = (input: ParseP21RequestInput): ParsedP21Request => {
  const parsedUrl = parseUrl(input.url);
  const endpointKind = classifyEndpoint(parsedUrl.path);
  const requestSummary = endpointKind === 'static' ? { isJson: false } : parseP21Payload(input.body);

  return {
    normalizedUrl: parsedUrl.normalizedUrl,
    path: parsedUrl.path,
    query: parsedUrl.query,
    endpointKind,
    requestSummary,
  };
};

export const parseP21Payload = (raw: string | unknown): ParsedP21Payload => {
  if (raw === undefined || raw === null) {
    return { isJson: false };
  }

  if (typeof raw !== 'string') {
    return {
      isJson: isPlainObject(raw) || Array.isArray(raw),
      value: raw,
      summary: summarizePayload(raw),
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { isJson: false };
  }

  try {
    const value = JSON.parse(trimmed) as unknown;
    return {
      isJson: true,
      value,
      summary: summarizePayload(value),
    };
  } catch (error) {
    return {
      isJson: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const classifyEndpoint = (path: string): P21EndpointKind => {
  if (STATIC_ASSET_REGEX.test(path)) return 'static';
  return ENDPOINT_MATCHERS.find(([, matches]) => matches(path))?.[0] || 'unknown';
};

const parseUrl = (url: string): { normalizedUrl: string; path: string; query: Record<string, string> } => {
  try {
    const parsed = new URL(url, window.location.href);
    return {
      normalizedUrl: `${parsed.origin}${parsed.pathname}`,
      path: parsed.pathname,
      query: Object.fromEntries(parsed.searchParams.entries()),
    };
  } catch {
    return {
      normalizedUrl: url,
      path: url.split('?')[0] || url,
      query: {},
    };
  }
};

const summarizePayload = (value: unknown): P21PayloadSummary | undefined => {
  if (Array.isArray(value)) return summarizeArrayPayload(value);

  if (!isRecord(value)) return undefined;
  return summarizeRecordPayload(value);
};

const summarizeArrayPayload = (value: unknown[]): P21PayloadSummary | undefined => {
  const preferences = extractPreferences(value);
  return preferences.length > 0
    ? {
        topLevelKeys: ['Array'],
        preferences: preferences as any,
      }
    : undefined;
};

const summarizeRecordPayload = (value: Record<string, unknown>): P21PayloadSummary => {
  const preferences = extractPreferences(value);
  const data = getRecord(value.Data);
  const dataInformation = getRecord(value.DataInformation);
  const properties = getRecord(value.Properties);
  const result = getRecord(value.Result);
  const events = Array.isArray(value.Events) ? value.Events : undefined;
  const messages = Array.isArray(value.Messages) ? value.Messages : undefined;
  const tpItems = extractTpItems(value);

  return {
    topLevelKeys: Object.keys(value),
    success: value.Success,
    dataKeys: data ? Object.keys(data) : undefined,
    dataInformationKeys: dataInformation ? Object.keys(dataInformation) : undefined,
    eventCount: events?.length,
    eventNames: events
      ?.map(extractEventName)
      .filter((name): name is string => Boolean(name))
      .slice(0, 20),
    propertyKeys: properties ? Object.keys(properties) : undefined,
    resultKeys: result ? Object.keys(result) : undefined,
    tpItemsCount: tpItems?.length,
    tpItemKeys: tpItems?.[0] && isRecord(tpItems[0]) ? Object.keys(tpItems[0]) : undefined,
    messagesCount: messages?.length,
    preferences: preferences as any,
  };
};

const extractPreferences = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value.filter((v) => isRecord(v) && typeof v.ObjectName === 'string' && typeof v.PreferenceName === 'string') : [];
};

const extractTpItems = (value: Record<string, unknown>): unknown[] | undefined => {
  const direct = getRecord(value.TP_ITEMS);
  const data = getRecord(value.Data);
  const dataTpItems = getRecord(data?.TP_ITEMS);
  const candidate = direct?.items ?? dataTpItems?.items;
  return Array.isArray(candidate) ? candidate : undefined;
};

const extractEventName = (event: unknown): string | undefined => {
  if (!isRecord(event)) return undefined;
  const candidate = event.Name ?? event.EventName ?? event.Type ?? event.name ?? event.type;
  return typeof candidate === 'string' ? candidate : undefined;
};

const getRecord = (value: unknown): Record<string, unknown> | undefined => (isRecord(value) ? value : undefined);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Identifies endpoints that carry P21 business data, schema definitions, or state resets.
 */
export const isTrackableEndpoint = (kind: P21EndpointKind): boolean => {
  return ['data', 'design', 'grid', 'history', 'clear', 'save', 'transaction', 'multiprefs'].includes(kind);
};
