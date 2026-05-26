import { attachSandboxLauncher, openSandbox } from './sandbox-autocomplete';
import type { P21DesignResponse } from './utils/p21-session';
import { trackActiveContext, getP21Scope } from './p21-data-endpoint';

// Using global AngularScope
type CustomScope = AngularScope;

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
  TAB_HEADER: '#p21TabsetDir ul',
  SHIP_TO_INPUT: '[id$="shipto.ship_to_name"], [id$="ship_to_name"]',
  SHIP_TO_CONTAINER: '[id="shipto"], [id$="TP_SHIPTO.shipto"], [id*="TP_SHIPTO.shipto."]',
  CUSTOMER_ID: '[id="order.customer_id"]',
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
  paymentListenersAttached: false,
  lastPaymentLink: '',
  paymentLinkTimeout: null as number | null,
  isInitializing: false,
  hotkeyBound: false,
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
const findVisibleShipToNameInput = (): HTMLInputElement | null => {
  const allMatches = document.querySelectorAll<HTMLInputElement>(SELECTORS.SHIP_TO_INPUT);

  // Debug: Log if we found elements but they were filtered out
  if (allMatches.length > 0) {
    const visible = Array.from(allMatches).find((input) => {
      const isVisible = input.getClientRects().length > 0;
      const isEnabled = !input.disabled;
      const isConnected = input.isConnected;
      return isVisible && isEnabled && isConnected;
    });

    if (!visible) {
      console.log(`${LOG_PREFIX} Found ${allMatches.length} inputs matching selector, but none passed visibility/enabled checks.`);
    }
    return visible ?? null;
  }

  return null;
};

/**
 * Initialize Google Places Autocomplete for the Ship To tab.
 */
const initializeAutocomplete = async (retryCount = 0): Promise<void> => {
  if (state.isInitializing) return;

  let currentShipToInput: HTMLInputElement | null = null;
  try {
    if (retryCount === 0) state.isInitializing = true;

    // Bind the Alt+A hotkey once
    if (!state.hotkeyBound) {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.altKey && e.key.toLowerCase() === 'a') {
          const input = findVisibleShipToNameInput();
          if (input) {
            e.preventDefault();
            openSandbox(SELECTORS.SHIP_TO_CONTAINER, true);
          }
        }
      });
      state.hotkeyBound = true;
    }

    currentShipToInput = findVisibleShipToNameInput();
    const tabListHeader = document.querySelector(SELECTORS.TAB_HEADER);
    const activeTab = tabListHeader?.querySelector('.active') as HTMLElement;
    const isShipToTabActive = activeTab?.dataset.menuItem === 'TP_SHIPTO';

    if (currentShipToInput) {
      attachSandboxLauncher(currentShipToInput, SELECTORS.SHIP_TO_CONTAINER, true);
    } else if (isShipToTabActive && retryCount < 5) {
      setTimeout(() => initializeAutocomplete(retryCount + 1), 200);
      return; // Return early, the retry will handle state.isInitializing
    } else {
      if (isShipToTabActive) {
        console.warn(`${LOG_PREFIX} Sandbox: No visible input found to attach launcher after retries.`);
      }
    }
  } finally {
    if (retryCount === 0 || retryCount >= 5 || currentShipToInput) {
      state.isInitializing = false;
    }
  }
};

/**
 * Determines if the response indicates the specified tab is active or being loaded.
 */
const isTabActive = (response: P21DesignResponse, tabName: string): boolean => {
  if (!response) return false;

  const isTabDesigned = response.Result?.TabDefinition?.UniqueName === tabName;
  const isTabSelected = response.Events?.some((e: any) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === tabName);
  const hasTabData = response.Data && typeof response.Data === 'object' && Object.keys(response.Data).some((key) => key.startsWith(`${tabName}.`));

  return Boolean(isTabDesigned || isTabSelected || hasTabData);
};

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; url: string; method: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  // Ignore incremental updates to prevent feedback loops.
  // Only react to GET/POST (Design/Load) requests.
  if (detail.method === 'PUT' || detail.method === 'PATCH') return;

  trackActiveContext(response, detail.url);

  if (isTabActive(response, 'TP_SHIPTO')) {
    setTimeout(() => initializeAutocomplete(), 100);
  }

  if (isTabActive(response, 'TP_REMITTANCES')) {
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

    const scope = await getP21Scope<CustomScope>(orderElement);
    if (!scope) {
      console.error(`${LOG_PREFIX} Failed to get Angular scope for paymentLink after retries.`);
      return;
    }

    const orderRecord = scope.record as OrderRecord;
    const paymentRecord = (angular.element(paymentElement).scope() as CustomScope)?.record as PaymentRecord; // Re-get payment record scope

    if (!orderRecord || !paymentRecord) {
      // paymentRecord might still be null if paymentElement has no scope
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

// Use the Action Monitor to detect UI interactions and tab changes
window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
  const { name, source } = event.detail;

  // React to DOM clicks or Angular selection broadcasts
  if ((source === 'DOM' && name === 'click') || name?.includes('selectionchanged')) {
    // Re-evaluate context with slight delays for Angular rendering
    setTimeout(() => initializeAutocomplete(), 250);
    setTimeout(() => paymentLink(), 1000);
  }
});
