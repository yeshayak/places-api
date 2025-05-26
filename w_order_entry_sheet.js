import { AutocompleteElement, handlePlaceSelect } from './autocomplete.js';

console.log('Loaded w_order_entry_sheet.js');
// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
let autocomplete;

// Initialize Google Places Autocomplete
const initializeAutocomplete = async () => {
  if (tabListHeader.querySelector('.active').dataset.menuItem === 'TP_SHIPTO') {
    console.log('Initializing Autocomplete');

    autocomplete = await AutocompleteElement('[id*="shipto.ship_to_name"]');
    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete, '[id="shipto"]', true);
      });
    }
  }
};

// Generate Payment Link
const paymentLink = async () => {
  if (tabListHeader.querySelector('.active').dataset.menuItem === 'TP_REMITTANCES') {
    console.log('Initializing Payment Link');

    const recalculateTotals = document.querySelector('[id="remittotals.recalculate_t"]');
    const orderRecord = angular.element(document.querySelector('[id="order.order_no"]')).scope()?.record;
    const paymentRecord = angular.element(document.querySelector('[id="remittotals.cf_balance"]')).scope()?.record;
    const contactRecord = angular.element(document.querySelector('[id="tp_contacts.contact_id"]')).scope()?.record;
    const customerRecord = angular.element(document.querySelector('[id="tp_customer.email_address"]')).scope()?.record;
    const linkTextArea = document.querySelector('[id="remittotals.cf_usersd22bd"]');
    const copyTextButton = document.querySelector('[id="remittotals.cb_usersd23fc"]');
    const sendEmailButton = document.querySelector('[id="remittotals.cb_usersd66af"]');

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
