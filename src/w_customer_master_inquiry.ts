import { installAddressAutocomplete } from './address-autocomplete-ui';
import { initPaymentWorkflow } from './payment-link-workflow';

installAddressAutocomplete();

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
