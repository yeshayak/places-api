// Payment Link Utility
console.log('Payment Link utility loaded');

// Type definitions
export interface PaymentLinkRecord {
  company_id: string;
  customer_id: string;
  email_address?: string;
}

export interface OrderPaymentRecord extends PaymentLinkRecord {
  order_no: string;
}

export interface PaymentBalanceRecord {
  cf_balance: number;
  c_unapplied_dp: number;
}

export interface ContactRecord {
  email_address?: string;
}

export interface PaymentLinkConfig {
  requiredTab: string;
  linkTextAreaSelector: string;
  copyButtonSelector: string;
  sendEmailButtonSelector: string;
  includeAmount?: boolean;
  includeInvoice?: boolean;
}

export interface PaymentLinkData {
  customerRecord: PaymentLinkRecord;
  orderRecord?: OrderPaymentRecord;
  paymentRecord?: PaymentBalanceRecord;
  contactRecord?: ContactRecord;
}

/**
 * Generates and sets up a payment link with copy and email functionality
 */
export const setupPaymentLink = async (
  config: PaymentLinkConfig,
  data: PaymentLinkData,
  tabListHeader: Element | null
): Promise<void> => {
  const activeTab = (tabListHeader?.querySelector('.active') as HTMLElement)?.dataset.menuItem;
  
  if (activeTab !== config.requiredTab) {
    return;
  }

  console.log('Initializing Payment Link');

  // Get UI elements
  const linkTextArea = document.querySelector(config.linkTextAreaSelector) as HTMLTextAreaElement | null;
  const copyTextButton = document.querySelector(config.copyButtonSelector) as HTMLElement | null;
  const sendEmailButton = document.querySelector(config.sendEmailButtonSelector) as HTMLElement | null;

  if (!linkTextArea || !copyTextButton || !sendEmailButton) {
    console.error('Required elements for payment link are missing.');
    return;
  }

  // Validate required data
  if (!data.customerRecord) {
    console.error('Customer record not found.');
    return;
  }

  // For order-based payment links, validate additional requirements
  if (config.includeAmount || config.includeInvoice) {
    if (!data.orderRecord || !data.paymentRecord) {
      console.error('Required order or payment records are missing.');
      return;
    }
  }

  // Calculate balance if needed
  let balance: string | undefined;
  if (config.includeAmount && data.paymentRecord) {
    const calculatedBalance = (data.paymentRecord.cf_balance - data.paymentRecord.c_unapplied_dp)?.toFixed(2);
    if (!calculatedBalance) {
      console.error('Balance is undefined or invalid.');
      return;
    }
    balance = calculatedBalance;
  }

  // Determine company string
  const companyString = data.customerRecord.company_id === 'WHB' ? 'wavehomeandbath' : 'gatorplumbingsupply';

  // Build payment link
  const baseUrl = `https://secure.cardknox.com/${companyString}`;
  const params = new URLSearchParams();
  
  if (config.includeAmount && balance) {
    params.append('xAmount', balance);
  }
  
  if (config.includeInvoice && data.orderRecord) {
    params.append('xInvoice', data.orderRecord.order_no);
  }
  
  params.append('xCustom01', data.customerRecord.customer_id);

  const paymentLink = `${baseUrl}?${params.toString()}`;

  // Update UI elements
  linkTextArea.classList.remove('ng-hide');
  copyTextButton.classList.remove('ng-hide');
  sendEmailButton.classList.remove('ng-hide');
  linkTextArea.value = paymentLink;

  console.log(`Payment Link: ${paymentLink}`);

  // Helper Functions
  const sendEmail = () => {
    const link = encodeURIComponent(linkTextArea.value);
    // Try contact email first, then customer email
    const email = data.contactRecord?.email_address || data.customerRecord?.email_address || '';
    if (!email) {
      console.error('No email address found.');
      return;
    }
    window.location.href = `mailto:${email}?subject=Payment%20Link&body=See%20below%20link%20to%20pay%20for%20your%20order%3A%0A%0A${link}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(linkTextArea.value).then(
      () => console.log('Copied to clipboard'),
      (err) => console.error('Failed to copy text:', err)
    );
  };

  // Remove existing event listeners to prevent duplicates
  const newSendEmailButton = sendEmailButton.cloneNode(true) as HTMLElement;
  const newCopyTextButton = copyTextButton.cloneNode(true) as HTMLElement;
  
  sendEmailButton.parentNode?.replaceChild(newSendEmailButton, sendEmailButton);
  copyTextButton.parentNode?.replaceChild(newCopyTextButton, copyTextButton);

  // Add Event Listeners
  newSendEmailButton.addEventListener('click', sendEmail);
  newCopyTextButton.addEventListener('click', copyToClipboard);
};