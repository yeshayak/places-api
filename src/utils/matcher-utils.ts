import type { ParsedP21Payload, ParsedP21Request } from './request-parser';

export interface FieldMatch {
  path: string;
  key: string;
  value: unknown;
}

export interface ItemSnapshot {
  key: string;
  value: Record<string, unknown>;
}

const ITEM_COLLECTION_KEYS = ['TP_ITEMS.items', 'Data.TP_ITEMS.items'];

export const isP21UiFullRequest = (request: ParsedP21Request): boolean => request.path.includes('/ui/full/') && request.endpointKind !== 'unknown';

export const getPayloadValue = (payload: ParsedP21Payload): unknown => payload.value;

export const findFieldsByName = (value: unknown, names: string[]): FieldMatch[] => {
  const normalizedNames = new Set(names.map(normalizeFieldName));
  const matches: FieldMatch[] = [];

  walkValue(value, [], (candidate, path) => {
    if (!isRecord(candidate)) return;
    for (const [key, child] of Object.entries(candidate)) {
      if (normalizedNames.has(normalizeFieldName(key))) {
        matches.push({
          path: [...path, key].join('.'),
          key,
          value: child,
        });
      }
    }
  });

  return matches;
};

export const hasFieldWithMeaningfulValue = (value: unknown, names: string[]): boolean => findFieldsByName(value, names).some((match) => isMeaningfulValue(match.value));

export const findEventNames = (value: unknown): string[] => {
  const names = new Set<string>();
  walkValue(value, [], (candidate, path) => {
    if (!Array.isArray(candidate) || normalizeFieldName(path[path.length - 1]) !== 'events') return;
    for (const event of candidate) {
      const name = extractEventName(event);
      if (name) names.add(name);
    }
  });
  return [...names];
};

export const eventNameIncludes = (value: unknown, fragments: string[]): boolean => {
  const normalizedFragments = fragments.map(normalizeFieldName);
  return findEventNames(value).some((name) => {
    const normalizedName = normalizeFieldName(name);
    return normalizedFragments.some((fragment) => normalizedName.includes(fragment));
  });
};

export const extractItemSnapshots = (value: unknown): ItemSnapshot[] => {
  const snapshots: ItemSnapshot[] = [];
  for (const path of ITEM_COLLECTION_KEYS) {
    const collection = getValueAtPath(value, path);
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      if (!isRecord(item)) continue;
      snapshots.push({
        key: getItemKey(item),
        value: item,
      });
    }
  }
  return dedupeItems(snapshots);
};

export const createPayloadFingerprint = (value: unknown): string => {
  try {
    return JSON.stringify(sortJsonValue(value));
  } catch {
    return String(value);
  }
};

export const getSessionKey = (request: ParsedP21Request): string => request.normalizedUrl;

export const normalizeFieldName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const walkValue = (value: unknown, path: string[], visit: (value: unknown, path: string[]) => void): void => {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkValue(child, [...path, String(index)], visit));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    walkValue(child, [...path, key], visit);
  }
};

const getValueAtPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);

const extractEventName = (event: unknown): string | undefined => {
  if (!isRecord(event)) return undefined;
  const candidate = event.Name ?? event.EventName ?? event.Type ?? event.name ?? event.type;
  return typeof candidate === 'string' && candidate ? candidate : undefined;
};

const isMeaningfulValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
};

const getItemKey = (item: Record<string, unknown>): string => {
  const candidate = item.rowid ?? item.row_id ?? item.uid ?? item.item_uid ?? item.line_no ?? item.lineNo ?? item.item_id ?? item.itemId ?? item.inv_mast_uid;
  return candidate === undefined || candidate === null ? createPayloadFingerprint(item) : String(candidate);
};

const dedupeItems = (items: ItemSnapshot[]): ItemSnapshot[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortJsonValue(value[key]);
      return sorted;
    }, {});
};
