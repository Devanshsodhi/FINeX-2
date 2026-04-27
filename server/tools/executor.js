import * as gmail from './gmail.js';
import * as calendar from './calendar.js';
import * as portfolio from './portfolio.js';
import * as skillLoader from './skillLoader.js';
import * as financialCalc from './financialCalc.js';
import { getMarketData } from '../market/index.js';
import { saveMemory, loadMemory } from '../lib/memoryStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_FILE = path.join(__dirname, '..', 'db', 'portfolio.json');
const TOOLS_DIR      = path.join(__dirname, '..', '..', 'TOOLS');

const load_tools = async ({ tool_names }) => {
  const result = {};
  for (const name of tool_names) {
    const filePath = path.join(TOOLS_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
      result[name] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      result[name] = { error: `Tool "${name}" not found in registry` };
    }
  }
  return result;
};

const get_market_sentiment = async () => {
  const portfolio_data = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
  const holdings = [
    ...portfolio_data.stocks.map(s => ({ symbol: s.symbol, name: s.name || s.symbol })),
    ...portfolio_data.crypto.map(c => ({ symbol: c.symbol, name: c.coin || c.symbol })),
  ];
  return getMarketData(holdings);
};

const get_memory = async ({ userId }) => loadMemory(userId);

const save_memory = async ({ userId, type, content, sessionId }) => {
  const id = crypto.randomUUID();
  await saveMemory(userId, { id, type, content, sessionId, createdAt: new Date().toISOString() });
  return { success: true, id };
};

const TOOL_MAP = {
  load_tools,
  get_memory,
  save_memory,
  send_email: gmail.send_email,
  list_emails: gmail.list_emails,
  search_email: gmail.search_email,
  create_event: calendar.create_event,
  list_events: calendar.list_events,
  get_portfolio: portfolio.get_portfolio,
  get_portfolio_summary: portfolio.get_portfolio_summary,
  load_skill: skillLoader.load_skill,
  get_market_sentiment,
  calculate_sip: financialCalc.calculate_sip,
  calculate_goal_probability: financialCalc.calculate_goal_probability,
  get_tax_insights: financialCalc.get_tax_insights,
  get_rebalancing_advice: financialCalc.get_rebalancing_advice,
  compute_income_tax: financialCalc.compute_income_tax,
  get_exchange_rates: financialCalc.get_exchange_rates,
};

export async function executeTool(toolId, params) {
  const fn = TOOL_MAP[toolId];
  if (!fn) throw new Error(`Unknown tool: ${toolId}`);
  return fn(params);
}

export const TOOL_IDS = Object.keys(TOOL_MAP);
