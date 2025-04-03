// Selectors and Global Variables
const tabListHeader = document.querySelector('#p21TabsetDir ul');
const root = angular.element('#contextWindow').scope();
let autocomplete;

// Initialize Google Places Autocomplete
const initializeAutocomplete = () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TP_SHIPTO') {
    console.log('initializeAutoComplete');

    const autocompleteInput = document.querySelectorAll('div.tab-pane.ng-scope.active')[1]?.querySelector('[id*="name"]');

    if (!autocompleteInput) {
      console.error('Autocomplete input not found.');
      return;
    }

    autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'name'],
    });

    autocompleteInput.onfocus = () => {
      autocompleteInput.autocomplete = 'new-password';
    };

    google.maps.event.addListener(autocomplete, 'place_changed', handlePlaceSelect);
  }
};

// Handle Place Selection
const handlePlaceSelect = async () => {
  if (!autocomplete) {
    console.error('Autocomplete is not initialized.');
    return;
  }

  const addressObject = autocomplete.getPlace();
  if (!addressObject) {
    console.error('No place selected.');
    return;
  }

  const place = {
    name: addressObject.name || '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal_code: '',
  };

  // Extract address components
  addressObject.address_components.forEach((component) => {
    if (component.types.includes('street_number')) place.address1 = `${component.short_name} `;
    if (component.types.includes('route')) place.address1 += `${component.short_name}`;
    if (component.types.includes('subpremise')) place.address2 = component.short_name;
    if (component.types.includes('locality')) place.city = component.short_name;
    if (component.types.includes('sublocality_level_1')) place.city = component.short_name;
    if (component.types.includes('administrative_area_level_1')) place.state = component.short_name;
    if (component.types.includes('postal_code')) place.postal_code = component.short_name;
  });

  console.log('Selected Place:', place);

  // Update Angular fields
  for (const component in place) {
    const fieldElement = document.querySelector('[id="shipto"]')?.querySelector(`[id$=${component}]`);

    if (!fieldElement) {
      console.warn(`Field for component "${component}" not found.`);
      continue;
    }

    const id = fieldElement.id;
    const fieldName = id.split('.')[1];

    const angularScope = angular.element(fieldElement).scope();
    angularScope.$apply(() => {
      angularScope.record[fieldName] = place[component];
    });

    try {
      await angularScope.onChange();
    } catch (error) {
      console.error(`Error updating field "${fieldName}":`, error);
    }
  }

  checkDuplicates(place.address1);
};

// Generate Payment Link
const paymentLink = async () => {
  if (root.windowMetadata.Sections.top.ActivePage === 'TP_REMITTANCES') {
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

    const balance = paymentRecord.cf_balance?.toFixed(2);
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

// Check for Duplicate Addresses
const checkDuplicates = async (lookupName) => {
  const customerId = root.windowData['TABPAGE_1.order'][0].customer_id;
  const token = root.userSession.token;

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  try {
    const response = await fetch(`https://p21live.gatorps.com/odataservice/odata/view/ice_ship_to_address?$filter=delete_flag eq 'N' and customer_id eq ${customerId} and contains(phys_address1, '${lookupName}')&$count=true`, {
      method: 'GET',
      headers,
    });
    const result = await response.json();

    if (result.value.length > 0) {
      console.log('Duplicate Ship To:', result.value);
      alert('Duplicate Ship To');
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
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
