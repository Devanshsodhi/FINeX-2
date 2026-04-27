import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.join(__dirname, '..', '..', 'TOOLS');

// load_tools is a meta-tool only needed with the old tag format — exclude from native function calling
const EXCLUDED = new Set(['load_tools']);

const toOpenAIFunction = (raw) => {
  const id = raw.id;
  if (EXCLUDED.has(id)) return null;

  // Normalise parameters — tools use either `parameters`, `input_schema`, or neither
  let parameters = raw.parameters || raw.input_schema;
  if (!parameters) {
    // GET-only tools with no arguments (get_portfolio, get_portfolio_summary, etc.)
    parameters = { type: 'object', properties: {}, required: [] };
  }
  // Ensure required is always an array
  if (!parameters.required) parameters = { ...parameters, required: [] };

  return {
    type: 'function',
    function: {
      name: id,
      description: raw.description || raw.name || id,
      parameters,
    },
  };
};

const loadAllSchemas = () => {
  try {
    return fs.readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .map(toOpenAIFunction)
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const ALL_TOOL_SCHEMAS = loadAllSchemas();

// Per-agent tool subsets — only the tools each agent actually needs
export const AGENT_TOOLS = {
  investment_monitor: ['get_portfolio', 'get_portfolio_summary', 'get_rebalancing_advice',
                       'get_tax_insights', 'compute_income_tax', 'calculate_sip',
                       'calculate_goal_probability', 'get_memory', 'load_skill'],
  market_sentiment:  ['get_market_sentiment', 'get_memory', 'load_skill'],
  dynamic_agent:     ['send_email', 'search_email', 'list_emails', 'create_event', 'list_events', 'get_memory', 'save_memory', 'load_skill'],
};

export const getAgentTools = (agentId) => {
  const allowed = AGENT_TOOLS[agentId];
  if (!allowed) return ALL_TOOL_SCHEMAS;
  return ALL_TOOL_SCHEMAS.filter(t => allowed.includes(t.function.name));
};
