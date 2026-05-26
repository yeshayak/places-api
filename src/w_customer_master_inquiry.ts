import { attachSandboxLauncher, openSandbox } from './sandbox-autocomplete';
import type { P21DesignResponse } from './utils/p21-session';
import { trackActiveContext, getP21Scope } from './p21-data-endpoint';

type CustomerRecord = {
  customer_id: string;
  company_id: string;
  email_address?: string;
};

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
  TAB_HEADER: '#bottomSectionDiv ul',
  PHYSICAL_ADDRESS_INPUT: `[id*='physical_address.phys_address1']`,
  PHYSICAL_ADDRESS_CONTAINER: '[id="physical_address"], [id$="PHYSICAL_ADDRESS.physical_address"]',
  PHYSICAL_ADDRESS_NAME_INPUT: '[id$="physical_address.name"]', // Assuming a name field for the address
  CUSTOMER_ID: `[id='customer.customer_id']`,
  PAYMENT_LINK_TEXT: `[id='tp_paymentaccount.cf_usersd8fc2']`,
  PAYMENT_COPY_BTN: `[id='tp_paymentaccount.cb_usersd4e72']`,
  PAYMENT_EMAIL_BTN: `[id='tp_paymentaccount.cb_usersd7da8']`,
};

type CustomerScope = AngularScope;

const state = {
  paymentListenersAttached: false,
  lastPaymentLink: '',
  hotkeyBound: false,
};

/**
 * Find the currently visible and enabled Physical Address input field.
 */
const findVisibleAddressInput = (): HTMLInputElement | null => {
  const allMatches = document.querySelectorAll<HTMLInputElement>(SELECTORS.PHYSICAL_ADDRESS_INPUT);
  return Array.from(allMatches).find((input) => !input.disabled && input.isConnected && input.getClientRects().length > 0) ?? null;
};

/**
 * Initialize Google Places Autocomplete for the Physical Address tab.
 */
const initializeAutocomplete = async (retryCount = 0): Promise<void> => {
  // Bind the Alt+A hotkey once
  if (!state.hotkeyBound) {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        const input = findVisibleAddressInput();
        if (input) {
          e.preventDefault();
          openSandbox(SELECTORS.PHYSICAL_ADDRESS_CONTAINER, false); // Assuming no name field for CM Inquiry
        }
      }
    });
    state.hotkeyBound = true;
  }

  const currentInput = findVisibleAddressInput();
  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  const isPhysicalAddressTabActive = activeTab?.dataset.menuItem === 'PHYSICAL_ADDRESS';

  if (currentInput) {
    attachSandboxLauncher(currentInput, SELECTORS.PHYSICAL_ADDRESS_CONTAINER, false); // Assuming no name field for CM Inquiry
    // Also attach to the name field if it exists
    const nameInput = document.querySelector<HTMLInputElement>(SELECTORS.PHYSICAL_ADDRESS_NAME_INPUT);
    if (nameInput) {
      attachSandboxLauncher(nameInput, SELECTORS.PHYSICAL_ADDRESS_CONTAINER, true);
    }
  } else if (isPhysicalAddressTabActive && retryCount < 5) {
    console.log(`${LOG_PREFIX} Physical Address tab active but input not ready. Retrying... (${retryCount + 1}/5)`);
    setTimeout(() => initializeAutocomplete(retryCount + 1), 200);
    return;
  } else {
    if (isPhysicalAddressTabActive) {
      console.warn(`${LOG_PREFIX} Sandbox: No visible input found to attach launcher after retries.`);
    }
  }
};

// Generate Payment Link
const paymentLink = async (): Promise<void> => {
  const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
  const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
  const customerElement = document.querySelector(SELECTORS.CUSTOMER_ID);
  const linkTextArea = document.querySelector(SELECTORS.PAYMENT_LINK_TEXT) as HTMLTextAreaElement | null;
  const copyBtn = document.querySelector(SELECTORS.PAYMENT_COPY_BTN) as HTMLElement | null;
  const emailBtn = document.querySelector(SELECTORS.PAYMENT_EMAIL_BTN) as HTMLElement | null;

  if (!customerElement || !linkTextArea || !copyBtn || !emailBtn) return;

  if (activeTab?.dataset.menuItem === 'TP_PAYMENTACCOUNT') {
    const scope = await getP21Scope<CustomerScope>(customerElement);
    const customerRecord = scope?.record as CustomerRecord;

    if (!customerRecord) {
      console.error(`${LOG_PREFIX} Customer record not found.`);
      return;
    }

    // Determine company string
    const companyString = customerRecord.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply';
    const linkValue = `https://secure.cardknox.com/${companyString}?xCustom01=${customerRecord.customer_id}`;

    if (state.lastPaymentLink !== linkValue) {
      console.log(`${LOG_PREFIX} Payment Link updated: ${linkValue}`);
      state.lastPaymentLink = linkValue;
    }

    // Update UI elements
    linkTextArea.classList.remove('ng-hide');
    copyBtn.classList.remove('ng-hide');
    emailBtn.classList.remove('ng-hide');
    linkTextArea.value = linkValue;

    if (!state.paymentListenersAttached) {
      console.log(`${LOG_PREFIX} Initializing Payment Link listeners for Inquiry.`);

      emailBtn.addEventListener('click', () => {
        const email = customerRecord?.email_address || '';
        if (!email) console.error(`${LOG_PREFIX} No email address found.`);

        const body = encodeURIComponent(`See below link to pay for your order:\n\n${linkTextArea.value}`);
        window.location.href = `mailto:${email}?subject=Payment%20Link&body=${body}`;
      });

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(linkTextArea.value).then(
          () => console.log(`${LOG_PREFIX} Copied to clipboard`),
          (err) => console.error(`${LOG_PREFIX} Failed to copy text:`, err),
        );
      });
      state.paymentListenersAttached = true;
    }
  } else {
    // If not on the payment tab, hide the elements
    linkTextArea?.classList.add('ng-hide');
    copyBtn?.classList.add('ng-hide');
    emailBtn?.classList.add('ng-hide');
  }
};

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; url: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  trackActiveContext(response, detail.url);

  // Check if the response indicates a change relevant to the physical address tab
  const isPhysicalAddressRelated = response?.Result?.TabDefinition?.UniqueName === 'PHYSICAL_ADDRESS' || response?.Events?.some((e) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'PHYSICAL_ADDRESS');

  if (isPhysicalAddressRelated) {
    setTimeout(() => initializeAutocomplete(), 100);
  }
});

// Initialize Functions
initializeAutocomplete();
paymentLink();

// Add Event Listeners
document.querySelector(SELECTORS.TAB_HEADER)?.addEventListener('click', () => {
  setTimeout(() => initializeAutocomplete(), 250); // Re-evaluate autocomplete on tab change
  setTimeout(() => paymentLink(), 1000); // Allow time for records to load
});
