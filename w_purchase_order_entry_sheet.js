console.log('Loaded w_purchase_order_entry_sheet');

// Function to handle supplier cost update
const handleSupplierCostUpdate = (target) => {
  if (target instanceof HTMLElement) {
    const root = angular.element('#contextWindow').scope();
    const targetScope = angular.element(target).scope().dataItem;

    const cost = target.value; // Use `cost` as a variable
    const confirmUpdate = confirm(`The unit price has changed to ${cost}. Do you want to update the supplier cost?`);
    if (confirmUpdate) {
      console.log(`Supplier cost updated to: ${cost}`);

      // Variables for token, supplier_id, and item_id
      const token = root.userSession?.token; // Replace with actual token
      const supplier_id = root.windowData['TABPAGE_1.tp_1_dw_1'][0].vendor_supplier_id; // Replace with actual supplier ID
      const item_id = targetScope.item_id; // Replace with actual item ID
      console.log('Token:', token);
      console.log('Supplier ID:', supplier_id);
      console.log('Item ID:', item_id);
      console.log('Cost:', cost);

      // Prepare headers
      const myHeaders = new Headers();
      myHeaders.append('accept', 'application/json');
      myHeaders.append('Content-Type', 'application/json');
      myHeaders.append('Authorization', `Bearer ${token}`);
      myHeaders.append('Cookie', 'ASP.NET_SessionId=2daajwfsec5eo3a2udqmrhhn');

      // Prepare request body
      const raw = JSON.stringify({
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
                    Edits: [
                      {
                        Name: 'item_id',
                        Value: item_id,
                        IgnoreIfEmpty: true,
                      },
                    ],
                    RelativeDateEdits: [],
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
                      {
                        Name: 'supplier_id',
                        Value: supplier_id,
                        IgnoreIfEmpty: true,
                      },
                      {
                        Name: 'cost',
                        Value: cost,
                        IgnoreIfEmpty: true,
                      },
                    ],
                    RelativeDateEdits: [],
                  },
                ],
              },
            ],
            Documents: null,
          },
        ],
        Query: null,
        FieldMap: [],
        TransactionSplitMethod: 0,
        Parameters: null,
      });

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
      };

      // Send the POST request
      fetch('https://p21live.gatorps.com/uiserver0/api/v2/transaction', requestOptions)
        .then((response) => response.text())
        .then((result) => console.log('Update result:', result))
        .catch((error) => console.error('Error updating supplier cost:', error));
    } else {
      console.log('Supplier cost update canceled.');
    }
  }
};

// Monitor changes to elements matching the selector
const monitorUnitPriceChanges = () => {
  const observer = new MutationObserver(() => {
    const elements = document.querySelectorAll("[data-key*='tp_17_dw_17.unit_price_display']");
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
