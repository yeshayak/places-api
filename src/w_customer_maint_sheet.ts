import { discoverAndAttachAddressUI } from './p21-data-endpoint';

/**
 * Customer Maintenance entry point.
 * Importing the orchestrator registers the global event listeners,
 * and we trigger an initial discovery scan for address fields.
 */
discoverAndAttachAddressUI();
