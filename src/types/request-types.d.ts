/**
 * Types related to P21 request and payload parsing.
 */

export type P21EndpointKind = 'data' | 'design' | 'grid' | 'grid-state' | 'history' | 'clear' | 'save' | 'transaction' | 'multiprefs' | 'ui-full' | 'static' | 'unknown';

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
  messagesCount?: number;
  preferences?: Array<{
    ObjectName: string;
    PreferenceName: string;
    PreferenceValue: string;
  }>;
}

export interface P21XhrResponseEventDetail {
  requestId: number;
  method: string;
  url: string;
  endpointKind: P21EndpointKind;
  requestValue?: unknown;
  responseValue?: unknown;
}
