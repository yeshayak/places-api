import type { P21DesignResponse } from './utils/p21-session';
import { discoverAndAttachAddressUI } from './address-autocomplete-ui';
import { getP21Scope, getActiveTabName } from './p21-data-endpoint';

// Using global AngularScope
type CustomScope = AngularScope;

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
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

window.addEventListener('p21-ext:xhr-response', (event) => {
  const detail = (event as CustomEvent<{ responseValue?: unknown; url: string; method: string }>).detail;
  const response = detail.responseValue as P21DesignResponse;

  // Ignore incremental updates to prevent feedback loops.
  // Only react to GET/POST (Design/Load) requests.
  if (detail.method === 'PUT' || detail.method === 'PATCH') return;

  // Tab identification for payment link still needs a way to detect remittances tab reliably
  const isRemittanceTab = response?.Result?.TabDefinition?.UniqueName === 'TP_REMITTANCES' || response?.Events?.some((e: any) => e.Name?.toLowerCase() === 'selectionchanged' && e.EventData?.tabpagename === 'TP_REMITTANCES');

  if (isRemittanceTab) {
    debouncedPaymentLink(500);
  }
});

const debouncedPaymentLink = (delay: number): void => {
  if (state.paymentLinkTimeout) window.clearTimeout(state.paymentLinkTimeout);
  state.paymentLinkTimeout = window.setTimeout(() => {
    paymentLink();
    state.paymentLinkTimeout = null;
    console.debug(`${LOG_PREFIX} State update: paymentLinkTimeout = null`);
  }, delay);
  console.debug(`${LOG_PREFIX} State update: paymentLinkTimeout set`);
};

/**
 * Update UI with payment link details and attach handlers once.
 */
const paymentLink = async (): Promise<void> => {
  // Check if the XHR context confirms we are on the Remittances tab
  if (getActiveTabName() === 'TP_REMITTANCES') {
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
      console.debug(`${LOG_PREFIX} State update: lastPaymentLink`);
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
      console.debug(`${LOG_PREFIX} State update: paymentListenersAttached = true`);
    }
  }
};

// Initialize Functions
paymentLink();
discoverAndAttachAddressUI();

// Use the Action Monitor to detect UI interactions and tab changes
window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
  const { name } = event.detail;

  // React to DOM clicks or Angular selection broadcasts
  if (name?.includes('selectionchanged')) {
    setTimeout(() => paymentLink(), 1000);
  }
});
