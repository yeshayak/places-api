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

// Google Maps types
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface Place {
  name: string | undefined;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
}

interface GooglePlace {
  address_components?: AddressComponent[];
  formatted_address?: string;
  name?: string;
}

interface AutocompleteOptions {
  componentRestrictions?: { country: string };
  fields?: string[];
}

declare global {
  const google: {
    maps: {
      places: {
        Autocomplete: new (
          input: HTMLInputElement,
          options?: {
            componentRestrictions?: { country: string };
            fields?: string[];
          }
        ) => {
          getPlace(): {
            address_components?: Array<{
              long_name: string;
              short_name: string;
              types: string[];
            }>;
            name?: string;
          };
        };
      };
      event: {
        addListener<T = any>(instance: T, eventName: string, handler: () => void): void;
      };
    };
  };
}
