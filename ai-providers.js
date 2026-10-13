'use strict';

// OWNZ FORGE AI — PHASE 15
// Free-first provider registry.
// No network calls. No automatic paid fallback.

const providers = Object.freeze({
  local: {
    name: 'FatalAcidBurn',
    enabled: true,
    keyEnvironmentVariable: null,
    modelEnvironmentVariable: 'LOCAL_AI_MODEL',
    defaultModel: 'Qwen3.5-4B'
  },
  groq: {
    name: 'Groq',
    enabled: true,
    keyEnvironmentVariable: 'GROQ_API_KEY',
    modelEnvironmentVariable: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-120b'
  },
  gemini: {
    name: 'Google Gemini',
    enabled: false,
    keyEnvironmentVariable: 'GEMINI_API_KEY',
    modelEnvironmentVariable: 'GEMINI_MODEL',
    defaultModel: null
  }
});

function getProviderStatus() {
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    name: provider.name,
    enabled: provider.enabled,
    configured: id === 'local'
      ? true
      : Boolean(process.env[provider.keyEnvironmentVariable]),
    model: process.env[provider.modelEnvironmentVariable]
      || provider.defaultModel
  }));
}

module.exports = {
  providers,
  getProviderStatus
};
