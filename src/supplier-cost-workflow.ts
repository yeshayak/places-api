import { getUserSession } from './utils/user-session';

const LOG_PREFIX = '[P21 EXT] [CostSync]';
let isWorkflowInitialized = false;

/**
 * Workflow to sync unit price changes to supplier cost in Purchase Order Entry.
 */
export const initSupplierCostWorkflow = () => {
  if (isWorkflowInitialized) return;
  isWorkflowInitialized = true;

  const observer = new MutationObserver(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-key*='tp_17_dw_17.unit_price_display']");
    elements.forEach((element) => {
      if (!element.dataset.listenerAttached) {
        element.addEventListener('change', (event) => handleUpdate(event.target));
        element.dataset.listenerAttached = 'true';
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`${LOG_PREFIX} Monitoring unit price changes.`);
};

const handleUpdate = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return;

  const userSession = getUserSession();
  if (!userSession) return;

  const ng = (window as any).angular;
  const root = ng.element('#contextWindow').scope();
  const targetScope = ng.element(target).scope();
  const cost = (target as HTMLInputElement).value;

  if (confirm(`Update supplier cost to ${cost}?`)) {
    const supplierId = root.windowData['TABPAGE_1.tp_1_dw_1'][0].vendor_supplier_id;
    const itemId = targetScope.dataItem.item_id;

    const body = {
      Name: 'Item',
      Description: null,
      UseCodeValues: false,
      IgnoreDisabled: true,
      Transactions: [
        {
          Status: 'New',
          DataElements: [
            {
              Name: 'TABPAGE_1.tp_1_dw_1',
              Type: 'Form',
              Keys: ['item_id'],
              Rows: [{ Edits: [{ Name: 'item_id', Value: itemId, IgnoreIfEmpty: true }] }],
            },
            {
              Name: 'TABPAGE_7.tp_7_dw_7',
              Type: 'Form',
              Keys: ['supplier_id'],
              Rows: [
                {
                  Edits: [
                    { Name: 'supplier_id', Value: supplierId, IgnoreIfEmpty: true },
                    { Name: 'cost', Value: cost, IgnoreIfEmpty: true },
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
      .then((res) => console.info(`${LOG_PREFIX} Result:`, res))
      .catch((err) => console.error(`${LOG_PREFIX} Error:`, err));
  }
};
