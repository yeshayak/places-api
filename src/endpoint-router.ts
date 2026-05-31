import { getDataWindowSchemaEntries } from './state-store';
import { ADDR1_REGEX } from './p21-data-endpoint';
import type { P21DesignResponse } from './types/p21-types';

/**
 * Decision engine for feature activation.
 */
export const isAddressRelated = (response: P21DesignResponse): boolean => {
  if (!response) return false;

  const hasAddressData = response.Data && Object.values(response.Data).some((rows) => Array.isArray(rows) && rows.length > 0 && rows[0] && Object.keys(rows[0]).some((k) => ADDR1_REGEX.test(k)));

  const hasAddressEvents = response.Events?.some((e) => ADDR1_REGEX.test(e.EventData?.dwproperty_column || ''));

  return !!(hasAddressData || hasAddressEvents);
};

export const isAddressContextActive = (): boolean => {
  const trackedSchemas = getDataWindowSchemaEntries();
  return trackedSchemas.some(([, schema]: [string, Set<string>]) => Array.from(schema).some((field) => ADDR1_REGEX.test(field)));
};
