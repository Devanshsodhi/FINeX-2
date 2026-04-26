import { storeFact } from './memoryTools.js';

const MEMORY_AGENT_CONFIG = {
  maxTokens: 1500,
  temperature: 0.2,
};

let _systemPrompt = null;
const getSystemPrompt = async () => {
  if (!_systemPrompt) {
    const res = await fetch('/api/agents/memory_agent/system');
    if (res.ok) _systemPrompt = (await res.text()).trim();
  }
  return _systemPrompt;
};

const buildMemoryAgentPrompt = (userMessage, assistantResponse) =>
  `User said: "${userMessage}"\n\nAssistant replied: "${assistantResponse}"\n\nWhat should be remembered about the user from this exchange?`;

export const runMemoryAgent = async (userId, sessionId, userMessage, assistantResponse) => {
  const systemPrompt = await getSystemPrompt();
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxTokens: MEMORY_AGENT_CONFIG.maxTokens,
      temperature: MEMORY_AGENT_CONFIG.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildMemoryAgentPrompt(userMessage, assistantResponse) },
      ],
    }),
  });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  // strip markdown code fences the LLM sometimes wraps around JSON
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const actions = JSON.parse(text);
    for (const action of actions) {
      storeFact(userId, action.type, action.content, sessionId);
    }
  } catch {
    console.warn('[MemoryAgent] Failed to parse response:', text);
  }
};
