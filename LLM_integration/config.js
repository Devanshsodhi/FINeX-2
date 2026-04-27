import promptTemplate from './prompts/system_prompt.md?raw';
import { formatMemoriesForPrompt } from './memory/index.js';

export const LLM_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'deepseek/deepseek-chat',
  maxTokens: 200,
  temperature: 0.4,
};

// Fetched once at module load — registries for system prompt injection
let _skillsRegistry = [];
fetch('/api/skills')
  .then(r => r.json())
  .then(data => { _skillsRegistry = data; })
  .catch(() => {});

let _toolsRegistry = [];
fetch('/api/tools')
  .then(r => r.json())
  .then(data => { _toolsRegistry = data; })
  .catch(() => {});


const formatSkillsForPrompt = () => {
  if (_skillsRegistry.length === 0) return '';
  const lines = _skillsRegistry.map(s => `- id: ${s.id} | trigger: ${s.trigger} | ${s.name}: ${s.description}`).join('\n');
  return `## Available Skills
Skills can be activated explicitly (user types the trigger command) or automatically by you via the \`load_skill\` tool.

To auto-activate a skill, call the \`load_skill\` tool with the skill's id. Example: when the user wants to track investments, call load_skill with skill_id "track".

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

const formatToolsForPrompt = () => {
  if (_toolsRegistry.length === 0) return '';
  const otherTools = _toolsRegistry
    .filter(t => t.id !== 'load_tools')
    .map(t => `- ${t.id}: ${t.description}`)
    .join('\n');
  return `## Tools
You have access to real-world tools. You MUST call them using EXACTLY this format — no other format will work:
<USE_TOOL>{"tool": "tool_name", "params": {...}}</USE_TOOL>

CRITICAL: The <USE_TOOL> and </USE_TOOL> tags are required. Never output raw JSON, never use any other format. The system only executes tool calls wrapped in these tags.

After the tool executes, the result is returned to you — respond naturally based on it. Never fabricate a result.

Before calling any tool (except load_tools and load_skill), call load_tools first to get the exact parameter schema:
<USE_TOOL>{"tool": "load_tools", "params": {"tool_names": ["tool_name"]}}</USE_TOOL>

Available tools:
${otherTools}`;
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
When the user wants to send, compose, or draft an email — auto-load the email skill immediately:
<USE_TOOL>{"tool": "load_skill", "params": {"skill_id": "email"}}</USE_TOOL>
Do this even if they haven't finished specifying all details — the skill will collect what's missing.`;

export const getSystemPrompt = (user = { name: 'User' }, userId = null) => {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const base = promptTemplate.trim().replace('[RESERVED]', `- User's name: ${user.name}\n- Current date and time: ${dateStr}`);
  const skills   = formatSkillsForPrompt();
  const tools    = formatToolsForPrompt();
  const handoff  = formatAgentHandoffForPrompt();
  const memories = userId ? formatMemoriesForPrompt(userId) : '';
  return [base, skills, tools, handoff, memories].filter(Boolean).join('\n\n');
};
