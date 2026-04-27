const KEY = (userId) => `finex_memory_${userId}`;
const MAX_ENTRIES = 100;

// Drop oldest entries of these types first — never drop contradiction or follow_up
// never evict: contradiction, follow_up, onboarding_data
const EVICTION_ORDER = ['user_fact', 'emotional_signal', 'decision'];

const load = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(KEY(userId)) || '[]');
  } catch {
    return [];
  }
};

const persist = (userId, entries) => {
  localStorage.setItem(KEY(userId), JSON.stringify(entries));
};

export const saveMemory = (userId, entry) => {
  let entries = load(userId);

  // onboarding_data: upsert — one canonical record, always replace
  if (entry.type === 'onboarding_data') {
    const idx = entries.findIndex(e => e.type === 'onboarding_data');
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], content: entry.content, updatedAt: entry.createdAt };
    } else {
      entries.push(entry);
    }
    persist(userId, entries);
    return;
  }

  // user_fact: skip exact duplicates (case-insensitive)
  const norm = (s) => s?.toLowerCase().trim();
  if (entry.type === 'user_fact') {
    if (entries.some(e => e.type === 'user_fact' && norm(e.content) === norm(entry.content))) return;
  }

  entries.push(entry);

  if (entries.length > MAX_ENTRIES) {
    for (const type of EVICTION_ORDER) {
      const idx = entries.findIndex(e => e.type === type);
      if (idx !== -1) { entries.splice(idx, 1); break; }
    }
  }

  persist(userId, entries);
};

export const getMemories = (userId) => load(userId);

export const getMemoriesByType = (userId, type) =>
  load(userId).filter(e => e.type === type);

export const deleteMemory = (userId, id) => {
  persist(userId, load(userId).filter(e => e.id !== id));
};

export const clearMemory = (userId) => {
  localStorage.removeItem(KEY(userId));
};

export const getRecentMemories = (userId, n = 10) => {
  const entries = load(userId);
  return entries.slice(-n);
};
