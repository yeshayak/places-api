/**
 * Shared interface representing the structure of a Prophet 21 design or data response.
 */
export interface P21DesignResponse {
  Data?: Record<string, unknown>;
  DataInformation?: Record<string, unknown>;
  Events?: Array<{
    Name?: string;
    EventData?: {
      tabpagename?: string;
    };
  }>;
  Result?: {
    Name?: string;
    TabDefinition?: {
      UniqueName?: string;
      Name?: string;
    };
  };
}

export interface P21SessionSnapshot {
  wid?: string;
  shellid?: string;
  dw?: string;
  fn?: string;
}

let latestSession: P21SessionSnapshot = {};

export const extractP21Session = (url: string, body?: unknown): P21SessionSnapshot => {
  const querySession = extractFromUrl(url);
  const bodySession = extractFromBody(body);
  const cookieSession = { shellid: getShellIdFromCookies() };
  const nextSession = compactSession({
    ...querySession,
    ...bodySession,
  });

  latestSession = compactSession({
    ...latestSession,
    ...cookieSession,
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

    // P21 often puts params in the hash for SPA routing
    // e.g. .../#/window/w_order_entry_sheet/WID?shellId=SHELLID
    const hashParams = new URLSearchParams(parsed.hash.includes('?') ? parsed.hash.split('?')[1] : '');

    const getParam = (key: string) => parsed.searchParams.get(key) || hashParams.get(key) || parsed.searchParams.get(key.toLowerCase()) || hashParams.get(key.toLowerCase());

    let wid = getParam('wid');

    // Attempt to extract WID from path if it follows /window/[name]/[guid]
    if (!wid) {
      const pathSegments = (parsed.pathname + parsed.hash).split('/');
      const windowIdx = pathSegments.findIndex((s) => s === 'window');
      if (windowIdx !== -1 && pathSegments[windowIdx + 2]) {
        const potentialGuid = pathSegments[windowIdx + 2].split('?')[0];
        // Simple GUID check (length)
        if (potentialGuid.length >= 32) {
          wid = potentialGuid;
        }
      }
    }

    return compactSession({
      wid: wid ?? undefined,
      shellid: getParam('shellid') || getParam('shellId') || undefined,
      dw: getParam('dw') ?? undefined,
      fn: getParam('fn') ?? undefined,
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
    shellid: findStringValue(value, ['shellid', 'shellId', 'shell_id', 'shellID']),
    dw: findStringValue(value, ['dw']),
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
      const nested = Array.isArray(child) ? child.map((item) => findStringValue(item, keys)).find(Boolean) : findStringValue(child, keys);

      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
};

const getShellIdFromCookies = (): string | undefined => {
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [name] = cookie.split('=');
    if (name.endsWith('_p21.token.auth')) {
      return name.split('_')[0];
    }
  }
  return undefined;
};

const compactSession = (session: P21SessionSnapshot): P21SessionSnapshot => Object.fromEntries(Object.entries(session).filter(([, value]) => value !== undefined && value !== '')) as P21SessionSnapshot;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// Initialize session from current URL immediately on load
const initialSession = extractP21Session(window.location.href);
console.log('[P21 EXT] Initial session from URL:', initialSession);
