import promptTemplate from './prompts/system_prompt.md?raw';
import { formatMemoriesForPrompt } from './memory/index.js';

export const LLM_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'openai/gpt-oss-120b',
  maxTokens: 4000,
  temperature: 0.4,
};

// Fetched once at module load — skills registry for system prompt injection
let _skillsRegistry = [];
fetch('/api/skills')
  .then(r => r.json())
  .then(data => { _skillsRegistry = data; })
  .catch(() => {});

const formatSkillsForPrompt = () => {
  if (_skillsRegistry.length === 0) return '';
  const lines = _skillsRegistry.map(s => `- id: ${s.id} | trigger: ${s.trigger} | ${s.name}: ${s.description}`).join('\n');
  return `## Available Skills
Skills can be activated explicitly (user types the trigger command) or automatically by calling the load_skill function.

To auto-activate a skill, call the load_skill function with the skill's id. Example: when the user wants to track investments, call load_skill with skill_id "track".

Rules:
- Only load a skill when the user's intent unambiguously matches it
- **Never load more than one skill at a time**

Onboarding auto-invocation rules:
- If the user's memories contain no onboarding_data at all, and the user asks anything about their finances, goals, or investing — auto-load onboarding-1 first
- If onboarding-1 is done but onboarding-2 data is missing (no income/occupation info in memory), and the user asks about budgeting, income, or expenses — auto-load onboarding-2
- If onboarding-2 is done but onboarding-3 data is missing (no assets/liabilities in memory), and the user asks about their net worth, savings, or investments — auto-load onboarding-3
- If onboarding-3 is done but onboarding-4 data is missing (no risk profile in memory), and the user asks about investing strategy or risk — auto-load onboarding-4
- Always introduce the onboarding naturally without calling it "onboarding" — just say you'd like to learn a bit about them first
- Explicit trigger commands (/onboarding-1 etc.) always work regardless of memory state
- **NEVER auto-load the next onboarding session immediately after one completes. When a session ends, simply tell the user the session is done and ask if they'd like to continue to the next one. Wait for them to confirm.**
- **NEVER re-load an onboarding session that has already been completed in this conversation. If the conversation history shows a session closing message ("That's everything for session 1", "gives me a solid income", "full financial map", "Onboarding complete") — that session is done, do not restart it.**
- **If the user says they already completed a session or questions whether they need to redo it, believe them and do not restart.**

Available skills:
${lines}`;
};

const formatAgentHandoffForPrompt = () =>
  `## Agent Handoff
When the user wants to track, view, or analyse their investments, hand off to the investment monitor agent by outputting ONLY this — one short bridging sentence, then the marker on its own line:
<HANDOFF>investment_monitor</HANDOFF>

When the user asks about market news, sentiment, news for their stocks, how the market is reacting, or "market pulse", hand off to the market sentiment agent by outputting ONLY this — one short bridging sentence, then the marker on its own line:
<HANDOFF>market_sentiment</HANDOFF>

Do NOT call any tool in the same response as a handoff marker. The agent will handle everything after handoff.
Only hand off when the user's intent is clearly about their portfolio/investments or market news. Do not hand off for general financial questions.

### Email
When the user wants to send, compose, or draft an email — call the load_skill function with skill_id "email" immediately.
Do this even if they haven't finished specifying all details — the skill will collect what's missing.`;

export const getSystemPrompt = (user = { name: 'User' }, userId = null) => {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const base = promptTemplate.trim().replace('[RESERVED]', `- User's name: ${user.name}\n- Current date and time: ${dateStr}`);
  const skills   = formatSkillsForPrompt();
  const handoff  = formatAgentHandoffForPrompt();
  const memories = userId ? formatMemoriesForPrompt(userId) : '';
  return [base, skills, handoff, memories].filter(Boolean).join('\n\n');
};
