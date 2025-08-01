/// <reference types="angular" />
import { getUserSession } from './utils/userSession';

console.log('Loaded w_purchase_order_entry_sheet');

type RootScope = AngularScope & {
  windowData: {
    'TABPAGE_1.tp_1_dw_1': Array<{
      vendor_supplier_id: string;
    }>;
  };
};

type DataItemScope = AngularScope & {
  dataItem: {
    item_id: string;
  };
};

interface TransactionRequest {
  Name: string;
  Description: null;
  UseCodeValues: boolean;
  IgnoreDisabled: boolean;
  Transactions: Array<{
    Status: string;
    DataElements: Array<{
      Name: string;
      BusinessObjectName: null;
      Type: 'Form';
      Keys: string[];
      Rows: Array<{
        Edits: Array<{
          Name: string;
          Value: string | number;
          IgnoreIfEmpty: boolean;
        }>;
      }>;
    }>;
  }>;
  Query: null;
  FieldMap: never[];
  TransactionSplitMethod: number;
  Parameters: null;
}

// Function to handle supplier cost update
const handleSupplierCostUpdate = (target: EventTarget | null): void => {
  if (target instanceof HTMLElement) {
    const userSession = getUserSession();
    if (!userSession) return;
    const root = angular.element('#contextWindow').scope() as unknown as RootScope;
    const targetScope = angular.element(target).scope() as unknown as DataItemScope;

    const { token, p21SoaUrl } = userSession;
    const cost = (target as HTMLInputElement).value;
    const confirmUpdate = confirm(`The unit price has changed to ${cost}. Do you want to update the supplier cost?`);

    if (confirmUpdate) {
      console.log(`Supplier cost updated to: ${cost}`);

      // Variables for token, supplier_id, item_id, and base URL
      const supplier_id = root.windowData['TABPAGE_1.tp_1_dw_1'][0].vendor_supplier_id;
      const item_id = targetScope.dataItem.item_id;
      console.log('Token:', token);
      console.log('Supplier ID:', supplier_id);
      console.log('Item ID:', item_id);
      console.log('Cost:', cost);

      // Prepare headers
      const myHeaders = new Headers();
      myHeaders.append('accept', 'application/json');
      myHeaders.append('Content-Type', 'application/json');
      myHeaders.append('Authorization', `Bearer ${token}`);

      // Prepare request body
      const raw: TransactionRequest = {
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
                BusinessObjectName: null,
                Type: 'Form',
                Keys: ['item_id'],
                Rows: [
                  {
                    Edits: [{ Name: 'item_id', Value: item_id, IgnoreIfEmpty: true }],
                  },
                ],
              },
              {
                Name: 'TABPAGE_7.tp_7_dw_7',
                BusinessObjectName: null,
                Type: 'Form',
                Keys: ['supplier_id'],
                Rows: [
                  {
                    Edits: [
                      { Name: 'supplier_id', Value: supplier_id, IgnoreIfEmpty: true },
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

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(raw),
      };

      // Send the POST request
      fetch(`${p21SoaUrl}/uiserver0/api/v2/transaction`, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log('Update result:', result))
        .catch((error) => console.error('Error updating supplier cost:', error));
    } else {
      console.log('Supplier cost update canceled.');
    }
  }
};

// Monitor changes to elements matching the selector
const monitorUnitPriceChanges = (): void => {
  const observer = new MutationObserver(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-key*='tp_17_dw_17.unit_price_display']");
    elements.forEach((element) => {
      if (!element.dataset.listenerAttached) {
        element.addEventListener('change', (event) => {
          handleSupplierCostUpdate(event.target);
        });
        element.dataset.listenerAttached = 'true'; // Mark as listener attached
      }
    });
  });

  // Observe changes in the document body
  observer.observe(document.body, { childList: true, subtree: true });
};

// Initialize monitoring
monitorUnitPriceChanges();
