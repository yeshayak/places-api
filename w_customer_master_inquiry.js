import { AutocompleteElement, handlePlaceSelect } from './autocomplete.js';

// Selectors and Global Variables
const tabListHeader = document.querySelector('#bottomSectionDiv ul');
let autocomplete;

// Initialize Google Places Autocomplete
const initializeAutoComplete = async () => {
  if (tabListHeader.querySelector('.active').dataset.menuItem === 'PHYSICAL_ADDRESS') {
    console.log('initializeAutoComplete');

    const autocompleteInputSelector = `[id*='physical_address.phys_address1']`;
    autocomplete = await AutocompleteElement(autocompleteInputSelector);

    if (autocomplete) {
      google.maps.event.addListener(autocomplete, 'place_changed', () => {
        handlePlaceSelect(autocomplete, '[id=physical_address]', false);
      });
    }
  }
};

// Generate Payment Link
const paymentLink = async () => {
  const activeTab = tabListHeader.querySelector('.active').dataset.menuItem;
  if (activeTab === 'TP_PAYMENTACCOUNT') {
    console.log('Initializing Payment Link');

    const customerRecord = angular.element(document.querySelector(`[id='customer.customer_id']`)).scope()?.record;

    if (!customerRecord) {
      console.error('Customer record not found.');
      return;
    }

    const linkTextArea = document.querySelector(`[id='tp_paymentaccount.cf_usersd8fc2']`);
    const copyTextButton = document.querySelector(`[id='tp_paymentaccount.cb_usersd4e72']`);
    const sendEmailButton = document.querySelector(`[id='tp_paymentaccount.cb_usersd7da8']`);

    if (!linkTextArea || !copyTextButton || !sendEmailButton) {
      console.error('Required elements for payment link are missing.');
      return;
    }

    // Determine company string
    const companyString = customerRecord.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply';

    // Update UI elements
    linkTextArea.classList.remove('ng-hide');
    copyTextButton.classList.remove('ng-hide');
    sendEmailButton.classList.remove('ng-hide');
    linkTextArea.value = `https://secure.cardknox.com/${companyString}?xCustom01=${customerRecord.customer_id}`;

    console.log(`Payment Link: ${linkTextArea.value}`);

    // Helper Functions
    const sendEmail = () => {
      const link = encodeURIComponent(linkTextArea.value);
      const email = customerRecord?.email_address || '';
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

    // Add Event Listeners
    sendEmailButton.addEventListener('click', sendEmail);
    copyTextButton.addEventListener('click', copyToClipboard);
  }
};

// Initialize Functions
initializeAutoComplete();
paymentLink();

// Add Event Listeners
tabListHeader?.addEventListener('click', () => {
  setTimeout(() => initializeAutoComplete(), 250);
  setTimeout(() => paymentLink(), 250);
});
