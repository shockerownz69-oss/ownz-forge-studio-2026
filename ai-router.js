'use strict';

// OWNZ FORGE AI — FREE-FIRST MODEL ROUTER V1
// Selection only: no network calls or automatic fallback.

const { getProviderStatus } = require('./ai-providers');

function selectProvider(requestedId = 'groq') {
  if (typeof requestedId !== 'string') {
    throw new Error('Invalid provider selection');
  }

  const provider = getProviderStatus().find(
    item => item.id === requestedId
  );

  if (!provider) {
    throw new Error('Unknown AI provider');
  }

  if (!provider.enabled) {
    throw new Error('AI provider is disabled');
  }

  if (!provider.configured) {
    throw new Error('AI provider is not configured');
  }

  if (!provider.model) {
    throw new Error('AI model is not configured');
  }

  return {
    id: provider.id,
    name: provider.name,
    model: provider.model
  };
}

module.exports = { selectProvider };
