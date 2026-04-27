import { saveMemory, getMemories, getRecentMemories } from './memoryStore.js';

export const storeFact = async (userId, type, content, sessionId) => {
  const id = crypto.randomUUID();
  await saveMemory(userId, {
    id,
    type,
    content,
    sessionId,
    createdAt: new Date().toISOString(),
  });
  return { success: true, id };
};

export const recallMemories = async (userId, limit = 8) => {
  const mems = await getRecentMemories(userId, limit);
  return mems.map(e => `- ${e.content}`).join('\n');
};

export const formatMemoriesForPrompt = async (userId) => {
  const all = await getMemories(userId);
  if (all.length === 0) return '';

  // Always pin onboarding session completion facts so they're never lost
  const sessionFacts = all.filter(e =>
    e.type === 'user_fact' && /onboarding session \d+ complete/i.test(e.content)
  );
  const recent = all.slice(-20);
  const recentIds = new Set(recent.map(e => e.id));
  const pinned = sessionFacts.filter(e => !recentIds.has(e.id));

  const lines = [...pinned, ...recent].map(e => `- ${e.content}`).join('\n');
  return `## What I remember about you:\n${lines}\n\n## Your user ID (needed for memory tools): ${userId}`;
};
