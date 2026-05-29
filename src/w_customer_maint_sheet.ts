import { discoverAndAttachAddressUI } from './address-autocomplete-ui';

/**
 * Customer Maintenance entry point.
 * Importing the orchestrator registers the global event listeners,
 * and we trigger an initial discovery scan for address fields.
 */
discoverAndAttachAddressUI();
