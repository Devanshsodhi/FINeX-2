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
- Never load onboarding skills — those require explicit user consent via the trigger command
- Never load more than one skill at a time

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
Only hand off when the user's intent is clearly about their portfolio/investments or market news. Do not hand off for general financial questions.`;

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
