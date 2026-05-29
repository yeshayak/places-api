import { installAddressAutocomplete } from './address-autocomplete-ui';
import { initPaymentWorkflow } from './payment-link-workflow';

installAddressAutocomplete();

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
