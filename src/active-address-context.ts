import { ADDR1_REGEX } from './p21-data-endpoint';
import { getDataWindowSchemaEntries } from './state-store';

export const isAddressContextActive = (): boolean => {
  const trackedSchemas = getDataWindowSchemaEntries();
  return trackedSchemas.some(([, schema]: [string, Set<string>]) => Array.from(schema).some((field) => ADDR1_REGEX.test(field)));
};
