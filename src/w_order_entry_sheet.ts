import { AutocompleteElement, handlePlaceSelect } from './autocomplete';

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
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  if (activeTab?.dataset.menuItem === 'TP_REMITTANCES') {
    console.log('Initializing Payment Link');

    const recalculateTotals = document.querySelector('[id="remittotals.recalculate_t"]') as HTMLElement | null;
    const orderElement = document.querySelector('[id="order.order_no"]');
    const paymentElement = document.querySelector('[id="remittotals.cf_balance"]');
    const contactElement = document.querySelector('[id="tp_contacts.contact_id"]');
    const customerElement = document.querySelector('[id="tp_customer.email_address"]');
    const linkTextArea = document.querySelector('[id="remittotals.cf_usersd22bd"]') as HTMLTextAreaElement | null;
    const copyTextButton = document.querySelector('[id="remittotals.cb_usersd23fc"]') as HTMLElement | null;
    const sendEmailButton = document.querySelector('[id="remittotals.cb_usersd66af"]') as HTMLElement | null;

    const orderScope = orderElement ? (angular.element(orderElement).scope() as CustomScope) : null;
    const paymentScope = paymentElement ? (angular.element(paymentElement).scope() as CustomScope) : null;
    const contactScope = contactElement ? (angular.element(contactElement).scope() as CustomScope) : null;
    const customerScope = customerElement ? (angular.element(customerElement).scope() as CustomScope) : null;

    const orderRecord = orderScope?.record as OrderRecord;
    const paymentRecord = paymentScope?.record as PaymentRecord;
    const contactRecord = contactScope?.record as ContactRecord;
    const customerRecord = customerScope?.record as CustomerRecord;

    if (!orderRecord || !paymentRecord || !linkTextArea || !copyTextButton || !sendEmailButton) {
      console.error('Required elements or records are missing.');
      return;
    }

    const balance = (paymentRecord.cf_balance - paymentRecord.c_unapplied_dp)?.toFixed(2);
    if (!balance) {
      console.error('Balance is undefined or invalid.');
      return;
    }

    const companyString = orderRecord.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply';

    linkTextArea.classList.remove('ng-hide');
    copyTextButton.classList.remove('ng-hide');
    sendEmailButton.classList.remove('ng-hide');
    linkTextArea.value = `https://secure.cardknox.com/${companyString}?xAmount=${balance}&xInvoice=${orderRecord.order_no}&xCustom01=${orderRecord.customer_id}`;

    console.log(`Payment Link: ${linkTextArea.value}`);

    const sendEmail = () => {
      const link = encodeURIComponent(linkTextArea.value);
      const email = contactRecord?.email_address || customerRecord?.email_address || '';
      if (!email) {
        console.error('No email address found.');
      }
      window.location.href = `mailto:${email}?subject=Payment%20Link&body=See%20below%20link%20to%20pay%20for%20your%20order%3A%0A%0A${link}`;
    };

    const copyToClipboard = () => {
      navigator.clipboard.writeText(linkTextArea.value).then(
        () => console.log('Copied to clipboard'),
        (err) => console.error('Failed to copy text:', err)
      );
    };

    sendEmailButton.addEventListener('click', sendEmail);
    copyTextButton.addEventListener('click', copyToClipboard);
    recalculateTotals?.addEventListener('click', paymentLink);
  }
};

// Initialize Functions
initializeAutocomplete();
paymentLink();

// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
  setTimeout(() => initializeAutocomplete(), 250);
  setTimeout(() => paymentLink(), 2000);
});
