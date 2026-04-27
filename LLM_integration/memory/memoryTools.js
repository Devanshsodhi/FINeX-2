import { saveMemory, getMemories, getRecentMemories } from './memoryStore.js';

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
    .map(e => `- ${e.content}`)
    .join('\n');
};

export const formatMemoriesForPrompt = (userId) => {
  const all = getMemories(userId);
  if (all.length === 0) return '';

  // Always pin onboarding session completion facts so they're never lost
  const sessionFacts = all.filter(e =>
    e.type === 'user_fact' && /onboarding session \d+ complete/i.test(e.content)
  );
  const recent = getRecentMemories(userId, 20);
  const recentIds = new Set(recent.map(e => e.id));
  const pinned = sessionFacts.filter(e => !recentIds.has(e.id));

  const lines = [...pinned, ...recent].map(e => `- ${e.content}`).join('\n');
  return `## What I remember about you:\n${lines}`;
};
