import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
  },
});

export const LLM_MODEL       = 'openai/gpt-oss-120b';
export const LLM_MAX_TOKENS  = 4000;
export const LLM_TEMPERATURE = 0.4;
export const LLM_PROVIDER    = { order: ['DeepInfra'], quantizations: ['bf16'] };
