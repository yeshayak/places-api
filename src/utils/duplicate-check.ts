/// <reference types="angular" />
import { getUserSession } from './user-session';

interface ODataResponse {
  '@odata.count': number;
  value: [];
}

export const duplicateCheck = async (lookupName: string, customerId?: string): Promise<void> => {
  console.log(`[P21 EXT] Duplicate check initiated for: ${lookupName}`);

  if (!lookupName) return;

  const userSession = getUserSession();
  if (!userSession) return;

  const { token, p21SoaUrl } = userSession;
  if (!customerId) {
    console.warn('[P21 EXT] Duplicate check aborted: No Customer ID provided.');
    return;
  }
  const cleanCustomerId = String(customerId).trim();

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  // Escape single quotes for OData compatibility
  const escapedLookup = lookupName.replace(/'/g, "''").toLowerCase();

  // Normalize the base URL to prevent double slashes
  const baseUrl = p21SoaUrl.endsWith('/') ? p21SoaUrl.slice(0, -1) : p21SoaUrl;

  try {
    // Use tolower() for case-insensitive matching on the address string component
    const url = `${baseUrl}/odataservice/odata/view/ice_ship_to_address?$filter=delete_flag eq 'N' and customer_id eq ${cleanCustomerId} and contains(phys_address1, '${escapedLookup}')&$count=true`;

    if (localStorage.getItem('p21ExtDebug') === 'true') console.log('[P21 EXT] Duplicate Check URL:', url);

    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OData server returned ${response.status}: ${errorText}`);
    }

    const result: ODataResponse = await response.json();

    if (result['@odata.count'] > 0) {
      console.warn('[P21 EXT] Duplicate Ship To detected:', result.value);
      // Use a slight delay for the alert to ensure it doesn't block the UI thread during field sync
      setTimeout(() => alert(`Potential Duplicate Address Found:\n\n${lookupName}\n\nExisting records: ${result['@odata.count']}`), 100);
    } else {
      console.log('No duplicates found for address:', lookupName);
    }
  } catch (error) {
    console.error('Error checking duplicates:', error instanceof Error ? error.message : error);
  }
};
