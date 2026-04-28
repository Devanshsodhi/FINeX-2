import { storeFact } from './memoryTools.js';
import { getMemories, deleteMemory } from './memoryStore.js';

const MEMORY_AGENT_CONFIG = { maxTokens: 800, temperature: 0.1 };

// Prevent concurrent runs — one memory agent at a time per user
const _running = new Set();

const buildSystemPrompt = (existingMemories) => {
  const memoryBlock = existingMemories.length
    ? existingMemories.map(m => `  [${m.id}] (${m.type}) ${m.content}`).join('\n')
    : '  (none)';

  return `You are a background memory agent for a financial assistant. You do NOT respond to the user.
Most turns require no action — default to returning an empty array.

## Already stored memories (do NOT re-store any of these):
${memoryBlock}

## Decision rules (walk in order, stop at first match):

1. Is there genuinely new information about the user in this turn?
   → No → return []

2. Would this fact help personalize a future conversation?
   → No → return []
   Store intents and outcomes. Skip procedural steps.
   SKIP: "user asked about X", "user browsed Y", greetings, confirmations
   STORE: name, age, location, email, financial goals, income range, risk tolerance, specific decisions made

3. Is this fact already captured in the stored memories above (same meaning, even if different wording)?
   → Yes, unchanged → return []
   → Yes but outdated/contradicted → include a "delete" action for the old ID, then add the corrected fact

4. Is this a onboarding_data fact being updated for the same session?
   → Use type "onboarding_data" and include session_id

## Output format
Return ONLY a JSON array. Each element is one of:
- {"action": "add", "type": "<type>", "content": "<one atomic fact>", "session_id": "<session_id or empty>"}
- {"action": "delete", "id": "<memory id from stored memories>"}

Valid types: user_fact, onboarding_data, emotional_signal, decision, follow_up, contradiction

If nothing to store: []
Never call add for something already in stored memories.
One fact per entry. Be strictly factual — only store what was explicitly stated.`;
};

const buildUserPrompt = (userMessage, assistantResponse, sessionId) =>
  `Session ID: ${sessionId}\n\nUser said: "${userMessage}"\n\nAssistant replied: "${assistantResponse}"`;

export const runMemoryAgent = async (userId, sessionId, userMessage, assistantResponse) => {
  if (_running.has(userId)) return;
  _running.add(userId);

  try {
    const existing = await getMemories(userId);
    const systemPrompt = buildSystemPrompt(existing);

    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxTokens: MEMORY_AGENT_CONFIG.maxTokens,
        temperature: MEMORY_AGENT_CONFIG.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserPrompt(userMessage, assistantResponse, sessionId) },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    const actions = JSON.parse(text);
    for (const action of actions) {
      if (action.action === 'delete' && action.id) {
        await deleteMemory(userId, action.id);
      } else if (action.action === 'add' && action.content) {
        await storeFact(userId, action.type, action.content, action.session_id || sessionId);
      }
    }
  } catch (e) {
    console.warn('[MemoryAgent] error:', e.message);
  } finally {
    _running.delete(userId);
  }
};
