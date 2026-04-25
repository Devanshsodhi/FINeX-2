import { storeFact } from './memoryTools.js';

const MEMORY_AGENT_CONFIG = {
  maxTokens: 400,
  temperature: 0.2,
};

const MEMORY_AGENT_SYSTEM_PROMPT = `You are a memory extraction agent for a financial assistant called FINeX AI.

Your ONLY job is to read a conversation exchange and decide what is worth remembering long-term about the user.

You must output a JSON array of memory actions. Each action has:
- "tool": always "storeFact"
- "type": one of ["user_fact", "emotional_signal", "decision", "contradiction", "follow_up", "onboarding_data"]
- "content": a single precise sentence describing what to remember

Rules:
- Extract ONLY things the USER said, not the assistant
- Only store facts that would be useful in a future session
- Do NOT store greetings, vague statements, or one-word answers
- Do NOT store what the assistant said
- Maximum 3 memory actions per exchange
- If nothing is worth storing, return an empty array []
- Never duplicate something already obvious from context

Output only raw valid JSON — no markdown, no code fences, no explanation, no extra text.

Example output:
[
  { "tool": "storeFact", "type": "user_fact", "content": "User's monthly income is approximately ₹80,000" },
  { "tool": "storeFact", "type": "follow_up", "content": "User said they would review their SIP next week — check next session" }
]`;

const buildMemoryAgentPrompt = (userMessage, assistantResponse) =>
  `User said: "${userMessage}"\n\nAssistant replied: "${assistantResponse}"\n\nWhat should be remembered about the user from this exchange?`;

export const runMemoryAgent = async (userId, sessionId, userMessage, assistantResponse) => {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxTokens: MEMORY_AGENT_CONFIG.maxTokens,
      temperature: MEMORY_AGENT_CONFIG.temperature,
      messages: [
        { role: 'system', content: MEMORY_AGENT_SYSTEM_PROMPT },
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
