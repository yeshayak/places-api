import { AutocompleteElement, handlePlaceSelect } from './autocomplete';
import type { P21SessionSnapshot, P21DesignResponse } from './p21-session';
import { trackActiveContext } from './p21-data-endpoint';

// Using global AngularScope
type CustomScope = AngularScope;

const LOG_PREFIX = '[P21 EXT - OE]';

const SELECTORS = {
  TAB_HEADER: '#p21TabsetDir ul',
  SHIP_TO_INPUT: '[id$="shipto.ship_to_name"], [id$="ship_to_name"]',
  SHIP_TO_CONTAINER: '[id="shipto"], [id$="TP_SHIPTO.shipto"], [id*="TP_SHIPTO.shipto."]',
  ORDER_NO: '[id="order.order_no"]',
  BALANCE: '[id="remittotals.cf_balance"]',
  CONTACT_ID: '[id="tp_contacts.contact_id"]',
  CUSTOMER_EMAIL: '[id="tp_customer.email_address"]',
  RECALC_TOTALS: '[id="remittotals.recalculate_t"]',
  PAYMENT_LINK_TEXT: '[id="remittotals.cf_usersd22bd"]',
  PAYMENT_COPY_BTN: '[id="remittotals.cb_usersd23fc"]',
  PAYMENT_EMAIL_BTN: '[id="remittotals.cb_usersd66af"]',
};

const state = {
  autocomplete: null as google.maps.places.Autocomplete | null, // The legacy Autocomplete object
  autocompleteInput: null as HTMLInputElement | null,
  autocompleteListener: null as google.maps.MapsEventListener | null,
  paymentListenersAttached: false,
  lastPaymentLink: '',
  paymentLinkTimeout: null as number | null,
};

interface OrderRecord {
  company_id: string;
  order_no: string;
  customer_id: string;
}

interface PaymentRecord {
  cf_balance: number;
  c_unapplied_dp: number;
  c_dp_override_amt: number;
}

interface ContactRecord {
  email_address?: string;
}

interface CustomerRecord {
  email_address?: string;
}

/**
 * Find the currently visible and enabled Ship To Name input field.
 */
const findVisibleShipToNameInput = (): HTMLInputElement | null => Array.from(document.querySelectorAll<HTMLInputElement>(SELECTORS.SHIP_TO_INPUT)).find((input) => !input.disabled && input.isConnected && input.getClientRects().length > 0) ?? null;

/**
 * Initialize Google Places Autocomplete for the Ship To tab.
 */
const initializeAutocomplete = async (): Promise<void> => {
  const currentShipToInput = findVisibleShipToNameInput();
  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  const isShipToTabActive = activeTab?.dataset.menuItem === 'TP_SHIPTO';

  // Scenario 1: Not on Ship To tab and no input found. Clear state if any.
  if (!isShipToTabActive && !currentShipToInput) {
    if (state.autocomplete || state.autocompleteInput) {
      console.log(`${LOG_PREFIX} Autocomplete: Clearing state as Ship To tab is not active or input is gone.`);
      if (state.autocompleteListener) {
        google.maps.event.removeListener(state.autocompleteListener);
      }
      state.autocomplete = null;
      state.autocompleteInput = null;
      state.autocompleteListener = null;
    }
    return;
  }

  // Scenario 2: Autocomplete is already correctly set up for the current input.
  // Check if the input element is the same AND we have an autocomplete instance AND a listener.
  if (state.autocompleteInput === currentShipToInput && state.autocomplete && state.autocompleteListener) {
    // console.log(`${LOG_PREFIX} Autocomplete: Already initialized for current input.`); // Too chatty
    return;
  }

  // Scenario 3: Need to initialize or re-initialize.
  console.log(`${LOG_PREFIX} Autocomplete: Attempting to initialize.`);

  // Remove existing listener if present before potentially getting a new instance
  if (state.autocompleteListener) {
    google.maps.event.removeListener(state.autocompleteListener);
    state.autocompleteListener = null;
  }

  const newAutocompleteInstance = await AutocompleteElement(SELECTORS.SHIP_TO_INPUT);

  if (newAutocompleteInstance) {
    state.autocomplete = newAutocompleteInstance;
    state.autocompleteInput = currentShipToInput;

    // Attach new listener for the legacy place_changed event
    state.autocompleteListener = google.maps.event.addListener(state.autocomplete, 'place_changed', () => {
      if (state.autocomplete) {
        handlePlaceSelect(state.autocomplete, SELECTORS.SHIP_TO_CONTAINER, true);
      }
    });

    console.log(`${LOG_PREFIX} Autocomplete: Place changed listener attached.`);
  } else {
    // AutocompleteElement returned null (e.g., input not found, or error during init)
    if (state.autocomplete || state.autocompleteInput) {
      console.warn(`${LOG_PREFIX} Autocomplete: Could not initialize for input: ${SELECTORS.SHIP_TO_INPUT}. Clearing state.`);
    } else {
      console.warn(`${LOG_PREFIX} Autocomplete: Could not initialize for input: ${SELECTORS.SHIP_TO_INPUT}.`);
    }
    state.autocomplete = null;
    state.autocompleteInput = null;
    state.autocompleteListener = null; // Ensure listener is null if init failed
  }
};

const hasShipToDesignData = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const response = value as P21DesignResponse;

  const isShipToTab = response.Result?.TabDefinition?.UniqueName === 'TP_SHIPTO' || response.Events?.some((e) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'TP_SHIPTO');

  if (isShipToTab) return true;

  const data = response.Data || response;
  if (data && typeof data === 'object' && 'TP_SHIPTO.shipto' in data) return true;

  return false;
};

const hasRemittanceData = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const response = value as P21DesignResponse;

  const isRemittanceTab = response.Result?.TabDefinition?.UniqueName === 'TP_REMITTANCES' || response.Events?.some((e) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'TP_REMITTANCES');

  if (isRemittanceTab) return true;

  const data = response.Data || response;
  return data && typeof data === 'object' && 'TP_REMITTANCES.remittotals' in data;
};

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; session?: P21SessionSnapshot; url: string; method: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  // Ignore incremental updates to prevent feedback loops.
  // Only react to GET/POST (Design/Load) requests.
  if (detail.method === 'PUT' || detail.method === 'PATCH') return;

  trackActiveContext(response, detail.url);

  if (hasShipToDesignData(response)) {
    setTimeout(() => initializeAutocomplete(), 100);
  }

  if (hasRemittanceData(response)) {
    debouncedPaymentLink(500);
  }
});

const debouncedPaymentLink = (delay: number): void => {
  if (state.paymentLinkTimeout) window.clearTimeout(state.paymentLinkTimeout);
  state.paymentLinkTimeout = window.setTimeout(() => {
    paymentLink();
    state.paymentLinkTimeout = null;
  }, delay);
};

/**
 * Update UI with payment link details and attach handlers once.
 */
const paymentLink = async (): Promise<void> => {
  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active, [aria-selected="true"]') as HTMLElement;

  // Check if we are on the Remittances tab or if the elements are simply present
  if (activeTab?.dataset.menuItem === 'TP_REMITTANCES' || document.querySelector(SELECTORS.PAYMENT_LINK_TEXT)) {
    console.log(`${LOG_PREFIX} Initializing Payment Link`);

    const orderElement = document.querySelector(SELECTORS.ORDER_NO);
    const paymentElement = document.querySelector(SELECTORS.BALANCE);
    const linkTextArea = document.querySelector(SELECTORS.PAYMENT_LINK_TEXT) as HTMLTextAreaElement | null;
    const copyBtn = document.querySelector(SELECTORS.PAYMENT_COPY_BTN) as HTMLElement | null;
    const emailBtn = document.querySelector(SELECTORS.PAYMENT_EMAIL_BTN) as HTMLElement | null;

    if (!orderElement || !paymentElement || !linkTextArea || !copyBtn || !emailBtn) return;

    const orderRecord = (angular.element(orderElement).scope() as CustomScope)?.record as OrderRecord;
    const paymentRecord = (angular.element(paymentElement).scope() as CustomScope)?.record as PaymentRecord;

    if (!orderRecord || !paymentRecord) {
      console.error(`${LOG_PREFIX} Required records are missing.`);
      return;
    }

    const balance = (paymentRecord.c_dp_override_amt || paymentRecord.cf_balance)?.toFixed(2);
    if (!balance) {
      console.error(`${LOG_PREFIX} Balance is undefined or invalid.`);
      return;
    }

    const companyString = orderRecord.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply';
    const linkValue = `https://secure.cardknox.com/${companyString}?xAmount=${balance}&xInvoice=${orderRecord.order_no}&xCustom01=${orderRecord.customer_id}`;

    if (state.lastPaymentLink !== linkValue) {
      console.log(`${LOG_PREFIX} Payment Link updated: ${linkValue}`);
      state.lastPaymentLink = linkValue;
    }

    linkTextArea.classList.remove('ng-hide');
    copyBtn.classList.remove('ng-hide');
    emailBtn.classList.remove('ng-hide');
    linkTextArea.value = linkValue;

    console.log(`${LOG_PREFIX} Payment Link: ${linkTextArea.value}`);

    if (!state.paymentListenersAttached) {
      emailBtn.addEventListener('click', () => {
        const contactEl = document.querySelector(SELECTORS.CONTACT_ID);
        const customerEl = document.querySelector(SELECTORS.CUSTOMER_EMAIL);
        const contactRec = (angular.element(contactEl!).scope() as CustomScope)?.record as ContactRecord;
        const customerRec = (angular.element(customerEl!).scope() as CustomScope)?.record as CustomerRecord;
        const email = contactRec?.email_address || customerRec?.email_address || '';
        const body = encodeURIComponent(`See below link to pay for your order:\n\n${linkTextArea.value}`);
        window.location.href = `mailto:${email}?subject=Payment%20Link&body=${body}`;
      });

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(linkTextArea.value).then(() => console.log(`${LOG_PREFIX} Copied to clipboard`));
      });

      document.querySelector(SELECTORS.RECALC_TOTALS)?.addEventListener('click', () => setTimeout(paymentLink, 1000));

      state.paymentListenersAttached = true;
    }
  }
};

// Initialize Functions
initializeAutocomplete();
paymentLink();

// Watch for tab changes
document.querySelector(SELECTORS.TAB_HEADER)?.addEventListener('click', () => {
  setTimeout(() => initializeAutocomplete(), 250); // Re-evaluate autocomplete on tab change
  // Larger delay for payment link to ensure records are loaded
  setTimeout(() => paymentLink(), 2000);
});
