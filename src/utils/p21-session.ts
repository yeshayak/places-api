/**
 * Shared interface representing the structure of a Prophet 21 design or data response.
 */
export interface P21EventData {
  tabpagename?: string;
  window_classname?: string;
  datawindowname?: string;
  dwproperty_column?: string;
  [key: string]: any;
}

// New interface for individual field properties (visible, enabled, etc.)
export interface P21FieldProperty {
  _internalrowindex?: string;
  Properties_Id?: number;
  dwname?: string; // Present in 'Properties' array
  tabpagename?: string; // Present in 'Properties' array
  [fieldName: string]: string | number | boolean | undefined; // For 'unit_price': 'true', 'one_time_price': 'false', etc.
}

// New interface for the container of field properties (e.g., PropertiesSet or individual entry in Properties)
export interface P21DataWindowProperties {
  Properties?: P21FieldProperty[];
  visible?: P21FieldProperty[];
  enabled?: P21FieldProperty[];
  drillable?: P21FieldProperty[];
  'font.bold'?: P21FieldProperty[];
  // Add other property types as needed (e.g., 'font.color', 'background.color')
  [key: string]: P21FieldProperty[] | undefined;
}

export interface P21DesignResponse {
  Data?: Record<string, unknown>;
  DataInformation?: Record<string, unknown>;
  Events?: Array<{
    Name?: string;
    Publisher?: string;
    EventData?: P21EventData; // Using the existing P21EventData interface
  }>;
  Result?: {
    Name?: string;
    TabDefinition?: {
      UniqueName?: string;
      Name?: string;
      Sections?: Array<{
        Name?: string;
        Dataobject?: string;
        [key: string]: any;
      }>;
    };
    // New properties based on examples
    PropertiesSet?: P21DataWindowProperties; // For /ui/full/v1/grid/ responses
    Properties?: Record<string, P21DataWindowProperties>; // For /ui/full/v2/window/history responses
  };
  Success?: boolean; // Added based on example
  State?: string; // Added based on example
  Messages?: unknown[]; // Added based on example
}
