export interface P21SessionSnapshot {
  wid?: string;
  shellid?: string;
  ts?: string;
  dw?: string;
  dwName?: string;
  fn?: string;
}

let latestSession: P21SessionSnapshot = {};

export const extractP21Session = (url: string, body?: unknown): P21SessionSnapshot => {
  const querySession = extractFromUrl(url);
  const bodySession = extractFromBody(body);
  const nextSession = compactSession({
    ...querySession,
    ...bodySession,
  });

  latestSession = compactSession({
    ...latestSession,
    ...nextSession,
  });

  return {
    ...latestSession,
    ...nextSession,
  };
};

export const getLatestP21Session = (): P21SessionSnapshot => ({ ...latestSession });

const extractFromUrl = (url: string): P21SessionSnapshot => {
  try {
    const parsed = new URL(url, window.location.href);
    return compactSession({
      wid: parsed.searchParams.get('wid') ?? undefined,
      shellid: parsed.searchParams.get('shellid') ?? undefined,
      ts: parsed.searchParams.get('ts') ?? undefined,
      dw: parsed.searchParams.get('dw') ?? undefined,
      dwName: parsed.searchParams.get('dwName') ?? undefined,
      fn: parsed.searchParams.get('fn') ?? undefined,
    });
  } catch {
    return {};
  }
};

const extractFromBody = (body: unknown): P21SessionSnapshot => {
  const value = normalizeBody(body);
  if (!isRecord(value)) {
    return {};
  }

  return compactSession({
    wid: findStringValue(value, ['wid', 'windowId', 'window_id']),
    shellid: findStringValue(value, ['shellid', 'shellId', 'shell_id']),
    ts: findStringValue(value, ['ts', 'timestamp']),
    dw: findStringValue(value, ['dw']),
    dwName: findStringValue(value, ['dwName', 'dataWindow', 'datawindow']),
    fn: findStringValue(value, ['fn', 'functionName']),
  });
};

const normalizeBody = (body: unknown): unknown => {
  if (typeof body !== 'string') {
    return body;
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return parseFormBody(trimmed);
  }
};

const parseFormBody = (body: string): Record<string, string> => {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
};

const findStringValue = (value: unknown, keys: string[]): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  for (const child of Object.values(value)) {
    if (isRecord(child) || Array.isArray(child)) {
      const nested = Array.isArray(child)
        ? child.map((item) => findStringValue(item, keys)).find(Boolean)
        : findStringValue(child, keys);

      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
};

const compactSession = (session: P21SessionSnapshot): P21SessionSnapshot =>
  Object.fromEntries(Object.entries(session).filter(([, value]) => value !== undefined && value !== '')) as P21SessionSnapshot;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
