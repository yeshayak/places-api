export const isFeatureEnabled = (featureKey: string): boolean => {
  const meta = document.head.querySelector('meta[name="places-api-injected"]');
  return meta?.getAttribute(`data-feat-${featureKey}`) === 'true';
};
