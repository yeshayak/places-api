import { ADDR1_REGEX, ADDR_NAME_REGEX, isFieldEnabled } from './p21-data-endpoint';
import { getActiveContext, getDataWindowSchema, getDataWindowSchemaCount } from './state-store';

const LOG_PREFIX = '[P21 EXT]';

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';

/**
 * Resolves a P21 element by its precise ID or by searching within its DataWindow container.
 */
const findP21Element = (dwName: string, fieldName: string): HTMLElement | null => {
  const preciseId = `${dwName}.${fieldName}`;
  const element = document.getElementById(preciseId);
  if (element) return element;

  const dwContainer = document.querySelector(`[id="${dwName}"]`);
  return (dwContainer?.querySelector(`input[id$=".${fieldName}"]`) as HTMLElement) || null;
};

const isVisibleEnabledElement = (element: Element | null): element is HTMLInputElement => {
  return element instanceof HTMLInputElement && isFieldEnabled(element) && element.isConnected && element.getClientRects().length > 0;
};

const findSchemaAnchor = (tabName: string, dataWindow: string): HTMLElement | null | undefined => {
  const fullDwName = `${tabName}.${dataWindow}`;
  const schema = getDataWindowSchema(fullDwName);

  if (!schema) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: No schema found for ${fullDwName}.`);
    return undefined;
  }

  const schemaFields = Array.from(schema);
  if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Schema found for ${fullDwName}. Fields:`, schemaFields);

  const anchorFieldName = getSchemaAnchorField(schemaFields, dataWindow);
  if (!anchorFieldName) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: No anchor field name found in schema for ${fullDwName} using address regexes.`);
    return null;
  }

  if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: Anchor field name identified from schema: ${anchorFieldName}`);

  const element = findP21Element(dataWindow, anchorFieldName);
  if (isVisibleEnabledElement(element)) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: XHR-prioritized anchor input found and enabled:', element, '(Source: XHR)');
    return element;
  }

  return null;
};

const getSchemaAnchorField = (schemaFields: string[], dataWindow: string): string | undefined => {
  const addressFields = schemaFields.filter((field) => ADDR1_REGEX.test(field));
  const hasVisibleAddress1 = addressFields.some((field) => isVisibleEnabledElement(findP21Element(dataWindow, field)));
  if (!hasVisibleAddress1) return undefined;

  return schemaFields.find((field) => ADDR_NAME_REGEX.test(field)) || addressFields[0];
};

const findDomAnchor = (): HTMLElement | null => {
  const allInputs = Array.from(document.querySelectorAll('input'));
  const addr1Input = allInputs.find((input) => ADDR1_REGEX.test(input.id) && isVisibleEnabledElement(input));

  if (!addr1Input) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, 'findAnchorInput: No usable anchor input found via XHR or DOM scan.');
    return null;
  }

  const nameInput = allInputs.find((input) => ADDR_NAME_REGEX.test(input.id) && isVisibleEnabledElement(input));
  const anchor = nameInput || addr1Input;
  if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: DOM-based anchor input found (${nameInput ? 'Name' : 'Address1'} field):`, anchor, '(Source: DOM)');
  return anchor;
};

export const findAnchorInput = (contextOverride?: ReturnType<typeof getActiveContext>): HTMLElement | null => {
  const { tabName, dataWindow } = contextOverride || getActiveContext();
  const schemaCount = getDataWindowSchemaCount();

  logDiscoveryStart(tabName, schemaCount);

  if (tabName && dataWindow) {
    if (isDebugEnabled()) console.debug(LOG_PREFIX, `findAnchorInput: XHR context active: tabName=${tabName}, dataWindow=${dataWindow}`);
    const anchor = findSchemaAnchor(tabName, dataWindow);

    // If a schema exists for the active context but no address anchor is present, stop here
    // to avoid picking up fields from inactive or background tabs.
    if (anchor !== undefined) return anchor;
  } else if (isDebugEnabled()) {
    console.debug(LOG_PREFIX, 'findAnchorInput: No active XHR context. Falling back to DOM scan.');
  }

  return findDomAnchor();
};

const logDiscoveryStart = (tabName: string | undefined, schemaCount: number): void => {
  if (isDebugEnabled() && (tabName || schemaCount === 0)) {
    console.debug(LOG_PREFIX, 'findAnchorInput: Attempting to find anchor input...');
  }
};
