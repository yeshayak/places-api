/// <reference types="angular" />

interface AngularScope extends ng.IScope {
  record?: Record<string, any>;
  onChange?(): Promise<void>;
  userSession?: {
    token: string;
    p21SoaUrl: string;
  };
  windowData?: {
    [key: string]: Array<{
      customer_id: string;
      vendor_supplier_id?: string;
      company_id?: string;
      order_no?: string;
      customer_name?: string;
      address_name?: string;
      phys_address1?: string;
      email_address?: string;
    }>;
  };
}

interface AngularElement extends ReturnType<typeof angular.element> {
  scope(): AngularScope;
  dataItem?: {
    item_id?: string;
    [key: string]: any;
  };
}

declare global {
  const google: {
    maps: {
      importLibrary(libraryName: string): Promise<any>;
      event: {
        addListener<T = any>(instance: T, eventName: string, handler: () => void): void;
      };
    };
  };
}
