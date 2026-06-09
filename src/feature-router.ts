import { getActiveContext, getDataWindowSchemaEntries, subscribe } from './state-store';
import { ADDR1_REGEX } from './p21-data-endpoint';
import type { P21DesignResponse } from './types/p21-types';
import { installAddressAutocomplete } from './address-autocomplete-ui';
import { initSupplierCostWorkflow } from './supplier-cost-workflow';
import { initPaymentWorkflow } from './payment-link-workflow';

/**
 * Layer 5 - Feature Router: Sole authority for feature enablement.
 * Decouples feature logic from Prophet 21 window scripts.
 */

const LOG_PREFIX = '[P21 ROUTER]';
let lastWindowName = '';

const isFeatureEnabled = (featureKey: string): boolean => {
  const meta = document.head.querySelector('meta[name="places-api-injected"]');
  return meta?.getAttribute(`data-feat-${featureKey}`) === 'true';
};

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
  };

  subscribe((state) => route(state.activeContext));
  route(getActiveContext());
};

export const isAddressRelated = (response: P21DesignResponse): boolean => {
  if (!response) return false;
  const hasAddressData = response.Data && Object.values(response.Data).some((rows) => Array.isArray(rows) && rows.length > 0 && rows[0] && Object.keys(rows[0]).some((k) => ADDR1_REGEX.test(k)));
  const hasAddressEvents = response.Events?.some((e) => ADDR1_REGEX.test(e.EventData?.dwproperty_column || ''));
  return !!(hasAddressData || hasAddressEvents);
};

export const isAddressContextActive = (): boolean => {
  const trackedSchemas = getDataWindowSchemaEntries();
  return trackedSchemas.some(([, schema]: [string, Set<string>]) => Array.from(schema).some((field) => ADDR1_REGEX.test(field)));
};

initializeFeatureRouting();
