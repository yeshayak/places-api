import { getActiveContext, subscribe } from './state-store';
import { isAddressContextActive } from './active-address-context';
import { isFeatureEnabled } from './feature-flags';
import { installAddressAutocomplete } from './address-autocomplete-ui';
import { initSupplierCostWorkflow } from './supplier-cost-workflow';
import { initPaymentWorkflow } from './payment-link-workflow';
import { initOneTimePriceWorkflow } from './one-time-price-workflow';

/**
 * Layer 5 - Feature Router: Sole authority for feature enablement.
 * Decouples feature logic from Prophet 21 window scripts.
 */

const LOG_PREFIX = '[P21 ROUTER]';
let lastWindowName = '';

export const initializeFeatureRouting = () => {
  console.info(LOG_PREFIX, 'Feature Router: Active.');

  const route = (activeContext: any) => {
    const { windowName } = activeContext;
    if (!windowName || windowName === lastWindowName) return;
    lastWindowName = windowName;

    window.addEventListener('p21-ext:transaction-reset', () => {
      lastWindowName = '';
    });

    // 1. Address Feature (Global capability based on schema)
    if (isFeatureEnabled('address') && isAddressContextActive()) {
      installAddressAutocomplete();
    }

    // 2. Window-Specific Workflows
    if (isFeatureEnabled('payment') && windowName === 'w_order_entry_sheet') {
      initPaymentWorkflow({
        tabName: 'TP_REMITTANCES',
        selectors: {
          customerId: '[id="order.customer_id"]',
          orderNo: '[id="order.order_no"]',
          balance: '[id="remittotals.cf_balance"]',
          contactEmail: '[id="tp_contacts.contact_id"]',
          customerEmail: '[id="tp_customer.email_address"]',
          linkTextArea: '[id="remittotals.cf_usersd22bd"]',
          copyBtn: '[id="remittotals.cb_usersd23fc"]',
          emailBtn: '[id="remittotals.cb_usersd66af"]',
          recalcBtn: '[id="remittotals.recalculate_t"]',
        },
        companyLogic: (rec) => (rec.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply'),
      });
    }

    if (isFeatureEnabled('payment') && windowName === 'w_customer_master_inquiry') {
      initPaymentWorkflow({
        tabName: 'TP_PAYMENTACCOUNT',
        selectors: {
          customerId: '[id="customer.customer_id"]',
          linkTextArea: '[id="tp_paymentaccount.cf_usersd8fc2"]',
          copyBtn: '[id="tp_paymentaccount.cb_usersd4e72"]',
          emailBtn: '[id="tp_paymentaccount.cb_usersd7da8"]',
        },
        companyLogic: (rec) => (rec.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply'),
      });
    }

    if (isFeatureEnabled('cost') && windowName === 'w_purchase_order_entry_sheet') {
      initSupplierCostWorkflow();
    }

    if (isFeatureEnabled('one-time-price') && windowName === 'w_order_entry_sheet') {
      initOneTimePriceWorkflow();
    }
  };

  subscribe((state) => route(state.activeContext));
  route(getActiveContext());
};

initializeFeatureRouting();
