import { isAddressContextActive } from './active-address-context';
import { ADDR1_REGEX, isFieldEnabled } from './p21-data-endpoint';
import { getDataWindowSchemaCount, getP21Value } from './state-store';
import { duplicateCheck } from './utils/duplicate-check';

const LOG_PREFIX = '[P21 EXT]';

const isDebugEnabled = (): boolean => localStorage.getItem('p21ExtDebug') === 'true';

/**
 * Attaches listeners to Address1 fields to trigger duplicate checks on manual entry.
 */
export const attachDuplicateCheckListeners = (): void => {
  const allInputs = Array.from(document.querySelectorAll('input'));
  allInputs.forEach((input) => {
    if (!ADDR1_REGEX.test(input.id || '') || !isFieldEnabled(input) || input.dataset.duplicateCheckAttached) {
      return;
    }

    if (isDebugEnabled()) console.debug(LOG_PREFIX, `Attaching duplicate check listener to: ${input.id}`);

    const handleUpdate = () => {
      const value = input.value.trim();
      if (!value || value === input.dataset.lastCheckedValue) return;

      if (isAddressContextActive() || getDataWindowSchemaCount() === 0) {
        const customerId = getP21Value('customer_id');
        if (isDebugEnabled()) console.debug(LOG_PREFIX, `Triggering duplicate check for manual change: ${value} (Customer: ${customerId})`);

        input.dataset.lastCheckedValue = value;
        duplicateCheck(value, customerId);
      }
    };

    input.addEventListener('blur', handleUpdate);
    input.addEventListener('change', handleUpdate);

    input.dataset.duplicateCheckAttached = 'true';
  });
};
