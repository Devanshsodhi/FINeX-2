import { callLLM, streamLLM } from './client.js';
import { runMemoryAgent } from './memory/index.js';

export async function sendMessage(userMessage, history, userId, sessionId) {
  history.add('user', userMessage);
  const reply = await callLLM(history.getWithSystem());
  history.add('assistant', reply);
  runMemoryAgent(userId, sessionId, userMessage, reply).catch(() => {});
  return reply;
}

export async function streamMessage(userMessage, history, userId, sessionId, onChunk, options = {}) {
  history.add('user', userMessage);
  const reply = await streamLLM(history.getWithSystem(), onChunk);
  history.add('assistant', reply);
  if (!options.skipMemoryAgent) {
    runMemoryAgent(userId, sessionId, userMessage, reply).catch(() => {});
  }
  return reply;
}
