import {
  builtInConnectorDefinitions,
  connectorFingerprint,
  brandKey,
} from '@compra-car/core/agents';
/** Offline data export. Never connects to a database or activates a connector. */
export function brandConnectorBootstrapData() {
  return builtInConnectorDefinitions().map((definition) => ({
    ...definition,
    brandKey: brandKey(definition.brand),
    fingerprint: connectorFingerprint(definition),
  }));
}
