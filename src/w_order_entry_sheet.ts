import { AutocompleteElement, handlePlaceSelect } from './autocomplete';
import { setupPaymentLink, PaymentLinkConfig, PaymentLinkData } from './utils/paymentLink';

console.log('Loaded w_order_entry_sheet.js');

// Using global AngularScope
type CustomScope = AngularScope;

// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
let autocomplete: google.maps.places.Autocomplete | null;

interface OrderRecord {
  company_id: string;
  order_no: string;
  customer_id: string;
}

interface PaymentRecord {
  cf_balance: number;
  c_unapplied_dp: number;
}

interface ContactRecord {
  email_address?: string;
}

interface CustomerRecord {
  email_address?: string;
}

// Initialize Google Places Autocomplete
const initializeAutocomplete = async (): Promise<void> => {
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  if (activeTab?.dataset.menuItem === 'TP_SHIPTO') {
    console.log('Initializing Autocomplete');

    autocomplete = await AutocompleteElement('[id*="shipto.ship_to_name"]');
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete!, '[id="shipto"]', true);
      });
    }
  }
};

// Generate Payment Link
const paymentLink = async (): Promise<void> => {
  const orderElement = document.querySelector('[id="order.order_no"]');
  const paymentElement = document.querySelector('[id="remittotals.cf_balance"]');
  const contactElement = document.querySelector('[id="tp_contacts.contact_id"]');
  const customerElement = document.querySelector('[id="tp_customer.email_address"]');

  const orderScope = orderElement ? (angular.element(orderElement).scope() as CustomScope) : null;
  const paymentScope = paymentElement ? (angular.element(paymentElement).scope() as CustomScope) : null;
  const contactScope = contactElement ? (angular.element(contactElement).scope() as CustomScope) : null;
  const customerScope = customerElement ? (angular.element(customerElement).scope() as CustomScope) : null;

  const orderRecord = orderScope?.record as OrderRecord;
  const paymentRecord = paymentScope?.record as PaymentRecord;
  const contactRecord = contactScope?.record as ContactRecord;
  const customerRecord = customerScope?.record as CustomerRecord;

  if (!orderRecord || !paymentRecord || !customerRecord) {
    console.error('Required records are missing.');
    return;
  }

  const config: PaymentLinkConfig = {
    requiredTab: 'TP_REMITTANCES',
    linkTextAreaSelector: '[id="remittotals.cf_usersd22bd"]',
    copyButtonSelector: '[id="remittotals.cb_usersd23fc"]',
    sendEmailButtonSelector: '[id="remittotals.cb_usersd66af"]',
    includeAmount: true,
    includeInvoice: true
  };

  const data: PaymentLinkData = {
    customerRecord: orderRecord, // orderRecord contains customer info
    orderRecord,
    paymentRecord,
    contactRecord
  };

  await setupPaymentLink(config, data, tabListHeader);

  // Add recalculate totals event listener after payment link setup
  const recalculateTotals = document.querySelector('[id="remittotals.recalculate_t"]') as HTMLElement | null;
  recalculateTotals?.addEventListener('click', paymentLink);
};

// Initialize Functions
initializeAutocomplete();
paymentLink();

// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
  setTimeout(() => initializeAutocomplete(), 250);
  setTimeout(() => paymentLink(), 2000);
});
