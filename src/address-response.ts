import { ADDR1_REGEX } from './p21-data-endpoint';
import type { P21DesignResponse } from './types/p21-types';

export const isAddressRelated = (response: P21DesignResponse): boolean => {
  if (!response) return false;
  const hasAddressData = response.Data && Object.values(response.Data).some((rows) => Array.isArray(rows) && rows.length > 0 && rows[0] && Object.keys(rows[0]).some((k) => ADDR1_REGEX.test(k)));
  const hasAddressEvents = response.Events?.some((e) => ADDR1_REGEX.test(e.EventData?.dwproperty_column || ''));
  return !!(hasAddressData || hasAddressEvents);
};
