import { callLLM, streamLLM } from './client.js';
import { runMemoryAgent } from './memory/index.js';

export async function sendMessage(userMessage, history, userId, sessionId, userName = 'User') {
  history.add('user', userMessage);
  const reply = await callLLM(history.get(), { userId, sessionId, userName });
  history.add('assistant', reply);
  runMemoryAgent(userId, sessionId, userMessage, reply).catch(() => {});
  return reply;
}

export async function streamMessage(userMessage, history, userId, sessionId, onChunk, options = {}) {
  history.add('user', userMessage);
  const userName = options.userName || 'User';
  const reply = await streamLLM(history.get(), onChunk, { userId, sessionId, userName });
  history.add('assistant', reply);
  if (!options.skipMemoryAgent) {
    runMemoryAgent(userId, sessionId, userMessage, reply).catch(() => {});
  }
  return reply;
}
