const API = (userId) => `/api/memory/${encodeURIComponent(userId)}`;

export const saveMemory = async (userId, entry) => {
  await fetch(API(userId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: entry.type, content: entry.content, sessionId: entry.sessionId }),
  });
};

export const getMemories = async (userId) => {
  try {
    const res = await fetch(API(userId));
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
};

export const getMemoriesByType = async (userId, type) => {
  const all = await getMemories(userId);
  return all.filter(e => e.type === type);
};

export const getRecentMemories = async (userId, n = 10) => {
  const all = await getMemories(userId);
  return all.slice(-n);
};

export const deleteMemory = async (userId, id) => {
  await fetch(`${API(userId)}/${id}`, { method: 'DELETE' });
};

export const clearMemory = async (userId) => {
  await fetch(API(userId), { method: 'DELETE' });
};
