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

export interface P21DesignResponse {
  Data?: Record<string, unknown>;
  DataInformation?: Record<string, unknown>;
  Events?: Array<{
    Name?: string;
    Publisher?: string;
    EventData?: P21EventData;
  }>;
  Result?: {
    Name?: string;
    TabDefinition?: {
      UniqueName?: string;
      Name?: string;
    };
  };
}
