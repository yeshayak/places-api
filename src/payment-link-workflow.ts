import { getP21Scope } from './p21-data-endpoint';
import { getActiveContext } from './state-store';

const LOG_PREFIX = '[P21 EXT] [Payment]';

export interface PaymentWorkflowConfig {
  tabName: string;
  selectors: {
    customerId: string;
    orderNo?: string;
    balance?: string;
    linkTextArea: string;
    copyBtn: string;
    emailBtn: string;
    contactEmail?: string;
    customerEmail?: string;
    recalcBtn?: string;
  };
  companyLogic: (record: any) => 'wavehomeandbath' | 'gatorplumbingsupply';
}

let lastPaymentLink = '';
let listenersAttached = false;

/**
 * Orchestrates the payment link UI and logic.
 */
export const initPaymentWorkflow = (config: PaymentWorkflowConfig) => {
  const updateUI = async () => {
    if (getActiveContext().tabName !== config.tabName) {
      toggleVisibility(config, false);
      return;
    }

    const el = {
      customer: document.querySelector(config.selectors.customerId),
      order: config.selectors.orderNo ? document.querySelector(config.selectors.orderNo) : null,
      balance: config.selectors.balance ? document.querySelector(config.selectors.balance) : null,
      link: document.querySelector(config.selectors.linkTextArea) as HTMLTextAreaElement,
      copy: document.querySelector(config.selectors.copyBtn) as HTMLElement,
      email: document.querySelector(config.selectors.emailBtn) as HTMLElement,
    };

    if (!el.customer || !el.link || !el.copy || !el.email) return;

    const scope = await getP21Scope(el.customer);
    const record = scope?.record;
    if (!record) return;

    const companyString = config.companyLogic(record);
    const customerId = record.customer_id;

    let linkValue = `https://secure.cardknox.com/${companyString}?xCustom01=${customerId}`;

    if (el.order && el.balance) {
      const orderNo = record.order_no;
      const paymentScope = (window as any).angular.element(el.balance).scope();
      const paymentRec = paymentScope?.record;
      const balance = (paymentRec?.c_dp_override_amt || paymentRec?.cf_balance)?.toFixed(2);

      if (orderNo && balance) {
        linkValue = `https://secure.cardknox.com/${companyString}?xAmount=${balance}&xInvoice=${orderNo}&xCustom01=${customerId}`;
      }
    }

    if (lastPaymentLink !== linkValue) {
      el.link.value = linkValue;
      lastPaymentLink = linkValue;
      console.log(`${LOG_PREFIX} Link updated: ${linkValue}`);
    }

    toggleVisibility(config, true);
    attachListeners(config, el.link, el.email, el.copy, record);
  };

  // Register event triggers
  window.addEventListener('p21-ext:action-monitor-event', (event: any) => {
    const { name } = event.detail;
    if (name?.includes('selectionchanged') || name === 'click') {
      setTimeout(updateUI, 1000);
    }
  });

  updateUI();
};

const toggleVisibility = (config: PaymentWorkflowConfig, show: boolean) => {
  const method = show ? 'remove' : 'add';
  [config.selectors.linkTextArea, config.selectors.copyBtn, config.selectors.emailBtn].forEach((s) => {
    document.querySelector(s)?.classList[method]('ng-hide');
  });
};

const attachListeners = (config: PaymentWorkflowConfig, link: HTMLTextAreaElement, emailBtn: HTMLElement, copyBtn: HTMLElement, record: any) => {
  if (listenersAttached) return;

  emailBtn.addEventListener('click', () => {
    let email = record.email_address || '';
    if (!email && config.selectors.contactEmail) {
      const contactScope = (window as any).angular.element(document.querySelector(config.selectors.contactEmail)).scope();
      email = contactScope?.record?.email_address || '';
    }
    const body = encodeURIComponent(`See below link to pay for your order:\n\n${link.value}`);
    window.location.href = `mailto:${email}?subject=Payment%20Link&body=${body}`;
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(link.value).then(() => console.log(`${LOG_PREFIX} Copied`));
  });

  if (config.selectors.recalcBtn) {
    document.querySelector(config.selectors.recalcBtn)?.addEventListener('click', () => {
      setTimeout(() => (lastPaymentLink = ''), 500); // Force refresh
    });
  }

  listenersAttached = true;
  console.debug(`${LOG_PREFIX} Listeners active.`);
};
