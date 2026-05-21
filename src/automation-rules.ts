import type { P21SessionSnapshot } from './p21-session';
import type { ParsedP21Payload, ParsedP21Request } from './request-parser';
import { createPayloadFingerprint, eventNameIncludes, extractItemSnapshots, findEventNames, findFieldsByName, getPayloadValue, getSessionKey, hasFieldWithMeaningfulValue, isP21UiFullRequest } from './matcher-utils';

export type P21AutomationEventType = 'item-added' | 'one-time-price-changed' | 'disposition-updated' | 'grid-refresh-triggered';

export interface AutomationRuleContext {
  requestId: number;
  method: string;
  request: ParsedP21Request;
  response: ParsedP21Payload;
  sourceRequest?: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    parsedRequest: ParsedP21Request;
  };
}

export interface P21AutomationEvent {
  type: P21AutomationEventType;
  ruleId: string;
  requestId: number;
  method: string;
  url: string;
  endpointKind: string;
  session: P21SessionSnapshot;
  evidence: Record<string, unknown>;
  sourceRequest?: AutomationRuleContext['sourceRequest'];
}

export type AutomationEventSubscriber = (event: P21AutomationEvent) => void;

interface AutomationRulesWindow extends Window {
  __p21AutomationRules?: {
    subscribe: (subscriber: AutomationEventSubscriber) => () => void;
  };
}

interface AutomationRule {
  id: string;
  type: P21AutomationEventType;
  match: (context: AutomationRuleContext) => Record<string, unknown> | undefined;
}

const subscribers = new Set<AutomationEventSubscriber>();
const itemStateBySession = new Map<string, Set<string>>();
const fieldStateBySession = new Map<string, Map<string, string>>();
const automationWindow = window as AutomationRulesWindow;

const ONE_TIME_PRICE_FIELDS = ['one_time_price', 'oneTimePrice', 'one time price'];
const DISPOSITION_FIELDS = ['disposition', 'disposition_cd', 'dispositionCode', 'disposition_code'];

const rules: AutomationRule[] = [
  {
    id: 'p21.item-added',
    type: 'item-added',
    match: (context) => {
      if (context.request.endpointKind !== 'data') return undefined;

      const responseItems = extractItemSnapshots(getPayloadValue(context.response));
      if (responseItems.length === 0) return undefined;

      const sessionKey = getSessionKey(context.request);
      const previousItems = itemStateBySession.get(sessionKey);
      itemStateBySession.set(sessionKey, new Set(responseItems.map((item) => item.key)));

      if (!previousItems) return undefined;

      const addedItems = responseItems.filter((item) => !previousItems.has(item.key));
      if (addedItems.length === 0) return undefined;

      return {
        itemKeys: addedItems.map((item) => item.key),
        itemCount: responseItems.length,
      };
    },
  },
  {
    id: 'p21.one-time-price-changed',
    type: 'one-time-price-changed',
    match: (context) => matchFieldChange(context, ONE_TIME_PRICE_FIELDS),
  },
  {
    id: 'p21.disposition-updated',
    type: 'disposition-updated',
    match: (context) => matchFieldChange(context, DISPOSITION_FIELDS),
  },
  {
    id: 'p21.grid-refresh-triggered',
    type: 'grid-refresh-triggered',
    match: (context) => {
      const requestValue = getPayloadValue(context.request.requestSummary);
      const responseValue = getPayloadValue(context.response);
      const isGridStateRequest = context.request.endpointKind === 'grid-state';
      const eventNames = [...findEventNames(requestValue), ...findEventNames(responseValue)];
      const hasRefreshEvent = eventNameIncludes(requestValue, ['refresh', 'retrieve', 'grid']) || eventNameIncludes(responseValue, ['refresh', 'retrieve', 'grid']);

      if (!isGridStateRequest && !hasRefreshEvent) return undefined;

      return {
        endpointKind: context.request.endpointKind,
        eventNames: eventNames.length > 0 ? eventNames : undefined,
      };
    },
  },
];

export const evaluateAutomationRules = (context: AutomationRuleContext): P21AutomationEvent[] => {
  if (!isP21UiFullRequest(context.request)) {
    return [];
  }

  const matchedEvents = rules.map((rule) => createEvent(rule, context)).filter((event): event is P21AutomationEvent => Boolean(event));

  for (const event of matchedEvents) {
    notifyAutomationEvent(event);
  }

  return matchedEvents;
};

export const subscribeAutomationEvent = (subscriber: AutomationEventSubscriber): (() => void) => {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
};

automationWindow.__p21AutomationRules = {
  subscribe: subscribeAutomationEvent,
};

const createEvent = (rule: AutomationRule, context: AutomationRuleContext): P21AutomationEvent | undefined => {
  const evidence = rule.match(context);
  if (!evidence) return undefined;

  return {
    type: rule.type,
    ruleId: rule.id,
    requestId: context.requestId,
    method: context.method,
    url: context.request.normalizedUrl,
    endpointKind: context.request.endpointKind,
    session: context.request.session,
    evidence,
    sourceRequest: context.sourceRequest,
  };
};

const matchFieldChange = (context: AutomationRuleContext, fieldNames: string[]): Record<string, unknown> | undefined => {
  if (context.request.endpointKind !== 'data') return undefined;

  const requestValue = getPayloadValue(context.request.requestSummary);
  const responseValue = getPayloadValue(context.response);
  const requestMatches = findFieldsByName(requestValue, fieldNames);
  const responseMatches = findFieldsByName(responseValue, fieldNames);

  if (!hasFieldWithMeaningfulValue(requestValue, fieldNames) && responseMatches.length === 0) {
    return undefined;
  }

  const sessionKey = getSessionKey(context.request);
  const fieldState = getFieldState(sessionKey);
  const changedFields = [...requestMatches, ...responseMatches].filter((match) => {
    const stateKey = `${match.path}:${match.key}`;
    const nextFingerprint = createPayloadFingerprint(match.value);
    const previousFingerprint = fieldState.get(stateKey);
    fieldState.set(stateKey, nextFingerprint);

    return previousFingerprint !== undefined && previousFingerprint !== nextFingerprint;
  });

  if (changedFields.length === 0) return undefined;

  return {
    fields: changedFields.map((match) => match.path),
  };
};

const getFieldState = (sessionKey: string): Map<string, string> => {
  const existing = fieldStateBySession.get(sessionKey);
  if (existing) return existing;

  const next = new Map<string, string>();
  fieldStateBySession.set(sessionKey, next);
  return next;
};

const notifyAutomationEvent = (event: P21AutomationEvent): void => {
  for (const subscriber of subscribers) {
    subscriber(event);
  }

  window.dispatchEvent(
    new CustomEvent<P21AutomationEvent>('p21-ext:automation-event', {
      detail: event,
    }),
  );
};
