import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, '..', 'db', 'memory');

const MAX_ENTRIES = 100;
const EVICTION_ORDER = ['user_fact', 'emotional_signal', 'decision'];

const sanitizeUserId = (userId) => {
  if (!userId || userId.includes('/') || userId.includes('..')) {
    throw new Error('Invalid userId');
  }
  return userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
};

const filePath = (userId) =>
  path.join(MEMORY_DIR, `${sanitizeUserId(userId)}.json`);

export const loadMemory = async (userId) => {
  try {
    const raw = await fs.readFile(filePath(userId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const persistMemory = async (userId, entries) => {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  await fs.writeFile(filePath(userId), JSON.stringify(entries, null, 2), 'utf8');
};

export const saveMemory = async (userId, entry) => {
  let entries = await loadMemory(userId);

  // onboarding_data: upsert — one canonical record per session
  if (entry.type === 'onboarding_data') {
    const idx = entries.findIndex(e => e.type === 'onboarding_data' && e.sessionId === entry.sessionId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], content: entry.content, updatedAt: entry.createdAt };
    } else {
      entries.push(entry);
    }
    await persistMemory(userId, entries);
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

  await persistMemory(userId, entries);
};

export const getMemories = async (userId) => loadMemory(userId);

export const deleteMemory = async (userId, id) => {
  const entries = await loadMemory(userId);
  await persistMemory(userId, entries.filter(e => e.id !== id));
};

export const clearMemory = async (userId) => {
  try { await fs.unlink(filePath(userId)); } catch {}
};
