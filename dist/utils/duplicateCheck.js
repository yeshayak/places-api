/// <reference types="angular" />
import { getUserSession } from './userSession.js';
export const duplicateCheck = async (lookupName, root = angular.element('#contextWindow'), customerIdKey = 'TABPAGE_1.order') => {
  if (!root) {
    console.error('Root scope is not available.');
    return;
  }
  const userSession = getUserSession();
  if (!userSession) return;
  const { token, p21SoaUrl } = userSession;
  const customerId = root.scope().windowData?.[customerIdKey]?.[0]?.customer_id;
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
    const result = await response.json();
    if (result?.value?.length > 0) {
      console.log('Duplicate Ship To:', result.value);
      alert('Duplicate Ship To');
    } else {
      console.log('No duplicates found for address:', lookupName);
    }
  } catch (error) {
    console.error('Error checking duplicates:', error instanceof Error ? error.message : error);
  }
};
