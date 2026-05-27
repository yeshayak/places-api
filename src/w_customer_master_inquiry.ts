import { getP21Scope, getActiveTabName, discoverAndAttachAddressUI } from './p21-data-endpoint';

type CustomerRecord = {
  customer_id: string;
  company_id: string;
  email_address?: string;
};

const LOG_PREFIX = '[P21 EXT]';

const SELECTORS = {
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

// Generate Payment Link
const paymentLink = async (): Promise<void> => {
  const customerElement = document.querySelector(SELECTORS.CUSTOMER_ID);
  const linkTextArea = document.querySelector(SELECTORS.PAYMENT_LINK_TEXT) as HTMLTextAreaElement | null;
  const copyBtn = document.querySelector(SELECTORS.PAYMENT_COPY_BTN) as HTMLElement | null;
  const emailBtn = document.querySelector(SELECTORS.PAYMENT_EMAIL_BTN) as HTMLElement | null;

  if (!customerElement || !linkTextArea || !copyBtn || !emailBtn) return;

  if (getActiveTabName() === 'TP_PAYMENTACCOUNT') {
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
      console.log(`${LOG_PREFIX} Initializing Payment Link listeners.`);

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
paymentLink();

// Use the Action Monitor to detect UI interactions and tab changes
window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
  const { name, source } = event.detail;

  if ((source === 'DOM' && name === 'click') || name?.includes('selectionchanged')) {
    setTimeout(() => paymentLink(), 1000);
  }
});

/**
 * Customer Master Inquiry entry point.
 * We trigger an initial discovery scan for address fields.
 */
discoverAndAttachAddressUI();
