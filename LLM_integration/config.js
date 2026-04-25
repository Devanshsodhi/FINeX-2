import promptTemplate from './prompts/system_prompt.md?raw';
import { formatMemoriesForPrompt } from './memory/index.js';

export const LLM_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'deepseek/deepseek-chat',
  maxTokens: 200,
  temperature: 0.4,
};

// Fetched once at module load — skills registry for system prompt injection
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
  const lines = _skillsRegistry.map(s => `- ${s.trigger} — ${s.name}: ${s.description}`).join('\n');
  return `## Available Skills\nSkills are ONLY active when the user explicitly types the trigger command. Do not run any skill flow unless activated. If a user asks you to onboard them or run a skill without typing the trigger, respond: "Type ${_skillsRegistry.map(s => s.trigger).join(' or ')} to start that."\n\n${lines}`;
};

const formatToolsForPrompt = () => {
  if (_toolsRegistry.length === 0) return '';
  const toolList = _toolsRegistry.map(t => {
    const props = t.input_schema?.properties || {};
    const required = t.input_schema?.required || [];
    const params = Object.entries(props).map(([k, v]) => {
      const req = required.includes(k) ? '' : '?';
      return `    ${k}${req}: ${v.type}  // ${v.description}`;
    }).join('\n');
    return `- **${t.name}**: ${t.description}\n  params:\n${params}`;
  }).join('\n\n');
  return `## Tools\nYou have access to real-world tools. When the user asks you to perform an action that maps to a tool, output the call on its own line in exactly this format:\n<USE_TOOL>{"tool": "tool_name", "params": {...}}</USE_TOOL>\nThe system executes the tool and returns the result — respond naturally based on it. Never fabricate a result.\n\nAvailable tools:\n${toolList}`;
};

export const getSystemPrompt = (user = { name: 'User' }, userId = null) => {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const base = promptTemplate.trim().replace('[RESERVED]', `- User's name: ${user.name}\n- Current date and time: ${dateStr}`);
  const skills = formatSkillsForPrompt();
  const tools = formatToolsForPrompt();
  const memories = userId ? formatMemoriesForPrompt(userId) : '';
  return [base, skills, tools, memories].filter(Boolean).join('\n\n');
};
