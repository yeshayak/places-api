/// <reference types="angular" />
import { getUserSession } from './userSession';

// Using global angular variable from the page
interface WindowData {
  [key: string]: Array<{
    customer_id: string;
  }>;
}

type RootScope = AngularScope & {
  windowData: WindowData;
};

interface ODataResponse {
  '@odata.count': number;
  value: [];
}

export const duplicateCheck = async (lookupName: string, root = angular.element('#contextWindow'), customerIdKey = 'TABPAGE_1.order'): Promise<void> => {
  if (!root) {
    console.error('Root scope is not available.');
    return;
  }

  const userSession = getUserSession();
  if (!userSession) return;

  const { token, p21SoaUrl } = userSession;
  const customerId = (root.scope() as RootScope).windowData?.[customerIdKey]?.[0]?.customer_id;

  if (!customerId) {
    console.error('Customer ID is missing.');
    return;
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  try {
    const response = await fetch(`${p21SoaUrl}/odataservice/odata/view/ice_ship_to_address?$filter=delete_flag eq 'N' and customer_id eq ${customerId} and contains(phys_address1, '${lookupName}')&$count=true`, { method: 'GET', headers });
    const result: ODataResponse = await response.json();

    if (result['@odata.count'] > 0) {
      console.log('Duplicate Ship To:', result.value);
      alert('Duplicate Ship To');
    } else {
      console.log('No duplicates found for address:', lookupName);
    }
  } catch (error) {
    console.error('Error checking duplicates:', error instanceof Error ? error.message : error);
  }
};
