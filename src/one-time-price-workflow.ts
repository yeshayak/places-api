import { getUserSession } from './utils/user-session';

const LOG_PREFIX = '[P21 EXT] [OneTimePrice]';
let isWorkflowInitialized = false;

/**
 * Workflow to toggle one_time_price on order entry items.
 * Watches for one_time_price field changes and syncs to P21 backend.
 */
export const initOneTimePriceWorkflow = () => {
  if (isWorkflowInitialized) return;
  isWorkflowInitialized = true;

  const observer = new MutationObserver(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-key*='one_time_price'], [name*='one_time_price']");
    elements.forEach((element) => {
      if (!element.dataset.listenerAttached) {
        element.addEventListener('change', (event) => handleOneTimePriceToggle(event.target));
        element.dataset.listenerAttached = 'true';
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`${LOG_PREFIX} Monitoring one_time_price field changes.`);
};

const handleOneTimePriceToggle = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return;

  const userSession = getUserSession();
  if (!userSession) return;

  const ng = (window as any).angular;
  const targetScope = ng.element(target).scope();
  const isEnabled = (target as HTMLInputElement).checked || (target as HTMLInputElement).value === 'true';

  console.log(`${LOG_PREFIX} Toggle detected:`, {
    isEnabled,
    element: target,
  });

  if (confirm(`Toggle one_time_price to ${isEnabled ? 'enabled' : 'disabled'}?`)) {
    const itemId = targetScope.dataItem?.item_id;
    if (!itemId) {
      console.warn(`${LOG_PREFIX} Could not extract item_id from scope`);
      return;
    }

    submitOneTimePriceChange(userSession, itemId, isEnabled);
  }
};

const submitOneTimePriceChange = (userSession: any, itemId: string, isEnabled: boolean) => {
  const body = {
    Name: 'Order',
    Description: null,
    UseCodeValues: false,
    IgnoreDisabled: true,
    Transactions: [
      {
        Status: 'New',
        DataElements: [
          {
            Name: 'TP_ITEMS.items',
            Type: 'Form',
            Keys: ['item_id'],
            Rows: [
              {
                Edits: [
                  { Name: 'item_id', Value: itemId, IgnoreIfEmpty: true },
                  { Name: 'one_time_price', Value: isEnabled ? '1' : '0', IgnoreIfEmpty: true },
                ],
              },
            ],
          },
        ],
      },
    ],
    Query: null,
    FieldMap: [],
    TransactionSplitMethod: 0,
    Parameters: null,
  };

  fetch(`${userSession.p21SoaUrl}/uiserver0/api/v2/transaction`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userSession.token}`,
    },
    body: JSON.stringify(body),
  })
    .then((r) => r.text())
    .then((res) => {
      console.info(`${LOG_PREFIX} Successfully toggled one_time_price:`, res);
    })
    .catch((err) => {
      console.error(`${LOG_PREFIX} Error toggling one_time_price:`, err);
    });
};
