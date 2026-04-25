import { saveMemory, getRecentMemories } from './memoryStore.js';

export const storeFact = (userId, type, content, sessionId) => {
  const id = crypto.randomUUID();
  saveMemory(userId, {
    id,
    type,
    content,
    sessionId,
    createdAt: new Date().toISOString(),
  });
  return { success: true, id };
};

export const recallMemories = (userId, limit = 8) => {
  return getRecentMemories(userId, limit)
    .map(e => `- [${e.type}] ${e.content} (${e.createdAt.slice(0, 10)})`)
    .join('\n');
};

export const formatMemoriesForPrompt = (userId) => {
  const recent = getRecentMemories(userId, 20);
  if (recent.length === 0) return '';
  const lines = recent.map(e => `- ${e.content}`).join('\n');
  return `## What I remember about you:\n${lines}`;
};
