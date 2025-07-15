import { AutocompleteElement, handlePlaceSelect } from './autocomplete';
import { setupPaymentLink, PaymentLinkConfig, PaymentLinkData } from './utils/paymentLink';

console.log('Loaded w_customer_master_inquiry.js');

type CustomerRecord = {
  customer_id: string;
  company_id: string;
  email_address?: string;
};

type CustomerScope = AngularScope;

// Selectors and Global Variables
const tabListHeader = document.querySelector('#bottomSectionDiv ul');
let autocomplete: google.maps.places.Autocomplete | null;

// Initialize Google Places Autocomplete
const initializeAutoComplete = async (): Promise<void> => {
  if ((tabListHeader?.querySelector('.active') as HTMLElement)?.dataset.menuItem === 'PHYSICAL_ADDRESS') {
    console.log('initializeAutoComplete');

    const autocompleteInputSelector = `[id*='physical_address.phys_address1']`;
    autocomplete = await AutocompleteElement(autocompleteInputSelector);

    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete!, '[id=physical_address]', false);
      });
    }
  }
};

// Generate Payment Link
const paymentLink = async (): Promise<void> => {
  const customerElement = document.querySelector(`[id='customer.customer_id']`);
  const customerScope = customerElement ? (angular.element(customerElement).scope() as CustomerScope) : null;
  const customerRecord = customerScope?.record;

  if (!customerRecord) {
    console.error('Customer record not found.');
    return;
  }

  const config: PaymentLinkConfig = {
    requiredTab: 'TP_PAYMENTACCOUNT',
    linkTextAreaSelector: `[id='tp_paymentaccount.cf_usersd8fc2']`,
    copyButtonSelector: `[id='tp_paymentaccount.cb_usersd4e72']`,
    sendEmailButtonSelector: `[id='tp_paymentaccount.cb_usersd7da8']`,
    includeAmount: false,
    includeInvoice: false
  };

  const data: PaymentLinkData = {
    customerRecord
  };

  await setupPaymentLink(config, data, tabListHeader);
};

// Initialize Functions
initializeAutoComplete();
paymentLink();

// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
  setTimeout(() => initializeAutoComplete(), 250);
  setTimeout(() => paymentLink(), 250);
});
