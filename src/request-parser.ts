export type P21EndpointKind = 'data' | 'grid-state' | 'transaction' | 'ui-full' | 'unknown';

export interface ParsedP21Request {
  normalizedUrl: string;
  path: string;
  query: Record<string, string>;
  endpointKind: P21EndpointKind;
  requestSummary: ParsedP21Payload;
}

export interface ParsedP21Payload {
  isJson: boolean;
  value?: unknown;
  summary?: P21PayloadSummary;
  error?: string;
}

export interface P21PayloadSummary {
  topLevelKeys?: string[];
  success?: unknown;
  dataKeys?: string[];
  dataInformationKeys?: string[];
  eventCount?: number;
  eventNames?: string[];
  propertyKeys?: string[];
  resultKeys?: string[];
  tpItemsCount?: number;
  tpItemKeys?: string[];
}

interface ParseP21RequestInput {
  method: string;
  url: string;
  body?: unknown;
}

export const parseP21Request = (input: ParseP21RequestInput): ParsedP21Request => {
  const parsedUrl = parseUrl(input.url);
  const requestSummary = parseP21Payload(input.body);

  return {
    normalizedUrl: parsedUrl.normalizedUrl,
    path: parsedUrl.path,
    query: parsedUrl.query,
    endpointKind: classifyEndpoint(parsedUrl.path),
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
  if (path.endsWith('/ui/full/v2/data/data') || path.endsWith('/ui/full/v1/data/data')) {
    return 'data';
  }

  if (/\/ui\/full\/v\d+\/grid\/.+\/elements\/state$/i.test(path)) {
    return 'grid-state';
  }

  if (path.includes('/api/v2/transaction') || path.includes('/transaction')) {
    return 'transaction';
  }

  if (path.includes('/ui/full/')) {
    return 'ui-full';
  }

  return 'unknown';
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
  if (!isRecord(value)) {
    return undefined;
  }

  const data = getRecord(value.Data);
  const dataInformation = getRecord(value.DataInformation);
  const properties = getRecord(value.Properties);
  const result = getRecord(value.Result);
  const events = Array.isArray(value.Events) ? value.Events : undefined;
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
  };
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
