/**
 * Shared Prophet 21 domain types and interfaces.
 */

export interface P21EventData {
  tabpagename?: string;
  window_classname?: string;
  datawindowname?: string;
  dwproperty_column?: string;
  [key: string]: any;
}

/**
 * Individual field properties (visible, enabled, etc.)
 */
export interface P21FieldProperty {
  _internalrowindex?: string;
  Properties_Id?: number;
  dwname?: string;
  tabpagename?: string;
  [fieldName: string]: string | number | boolean | undefined;
}

/**
 * Container for DataWindow field properties.
 */
export interface P21DataWindowProperties {
  Properties?: P21FieldProperty[];
  visible?: P21FieldProperty[];
  enabled?: P21FieldProperty[];
  drillable?: P21FieldProperty[];
  'font.bold'?: P21FieldProperty[];
  [key: string]: P21FieldProperty[] | undefined;
}

export interface P21Section {
  Name?: string;
  Dataobject?: string;
  [key: string]: any;
}

export interface P21Event {
  Name?: string;
  Publisher?: string;
  EventData?: P21EventData;
}

/**
 * Structure of a Prophet 21 design or data response.
 */
export interface P21DesignResponse {
  Data?: Record<string, unknown>;
  DataInformation?: Record<string, unknown>;
  Events?: P21Event[];
  Result?: {
    Name?: string;
    TabDefinition?: {
      UniqueName?: string;
      Name?: string;
      Sections?: P21Section[];
    };
    PropertiesSet?: P21DataWindowProperties;
    Properties?: Record<string, P21DataWindowProperties>;
  };
  Success?: boolean;
  State?: string;
  Messages?: unknown[];
}

export interface P21FieldUpdate {
  dwName: string;
  fieldName: string;
  value: string;
}

export interface P21AddressUpdateValue {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface P21DataEndpointUpdateResult {
  ok: boolean;
  status: number;
  fields: P21FieldUpdate[];
  error?: string;
}

export interface P21ActiveContext {
  windowName?: string;
  tabName?: string;
  p21TabId?: string; // e.g., 'tab_1', 'tab_2'
  dataWindow?: string;
  sectionActiveTabs?: Record<string, string>;
}

export interface P21DataContextUpdatedDetail {
  response: P21DesignResponse;
  url: string;
  method: string;
  isAddressRelated: boolean;
  isStructuralRescan: boolean;
  isHistoryNavigation: boolean;
}
