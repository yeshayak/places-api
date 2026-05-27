import { discoverAndAttachAddressUI } from './p21-data-endpoint';

/**
 * Ship To Maintenance entry point.
 * Importing the orchestrator registers the global event listeners,
 * and we trigger an initial discovery scan for address fields.
 */
discoverAndAttachAddressUI();
