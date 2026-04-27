import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeTool } from './tools/executor.js';
import { computeAnalysis } from './tools/portfolioAnalysis.js';
import { getMarketData } from './market/index.js';
import { openai, LLM_MODEL, LLM_MAX_TOKENS, LLM_TEMPERATURE, LLM_PROVIDER } from './lib/llmClient.js';
import { ALL_TOOL_SCHEMAS, getAgentTools } from './lib/toolSchemas.js';
import { runAgentLoop } from './lib/agentLoop.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env for local development
try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const USERS_FILE    = path.join(__dirname, 'db', 'users.json');
const CHATS_FILE    = path.join(__dirname, 'db', 'chats.json');
const PORTFOLIO_FILE = path.join(__dirname, 'db', 'portfolio.json');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const SKILLS_DIR    = path.join(__dirname, '..', 'SKILLS');
const AGENTS_DIR    = path.join(__dirname, '..', 'AGENTS');
const CONNECTORS_DIR = path.join(__dirname, '..', 'CONNECTORS');
const TOOLS_DIR     = path.join(__dirname, '..', 'TOOLS');

const readData = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const buildRegistry = (dir, ext = '_data.json') => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => { try { return JSON.parse(fs.readFileSync(path.join(dir, d.name, ext), 'utf8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
};

const buildToolsRegistry = () => {
  try {
    return fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
};

const SKILLS_REGISTRY    = buildRegistry(SKILLS_DIR);
const AGENTS_REGISTRY    = buildRegistry(AGENTS_DIR);
const CONNECTORS_REGISTRY = buildRegistry(CONNECTORS_DIR);
const TOOLS_REGISTRY     = buildToolsRegistry();

const loadAgentPrompt = (agentId, file = 'system.txt') => {
  try { return fs.readFileSync(path.join(AGENTS_DIR, agentId, file), 'utf8').trim(); }
  catch { console.error(`[Agent] Failed to load ${agentId}/${file}`); return ''; }
};

// --- Auth ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readData(USERS_FILE);
  const user = users.find(u => u.email === email && u.password === password);
  if (user) res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  else res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// --- Registries ---
app.get('/api/chats',      (_req, res) => res.json(readData(CHATS_FILE)));
app.get('/api/skills',     (_req, res) => res.json(SKILLS_REGISTRY));
app.get('/api/agents',     (_req, res) => res.json(AGENTS_REGISTRY));
app.get('/api/connectors', (_req, res) => res.json(CONNECTORS_REGISTRY));
app.get('/api/tools',      (_req, res) => res.json(TOOLS_REGISTRY));

// --- Tool execution (REST endpoint, kept for direct calls) ---
app.post('/api/tools/:id/execute', async (req, res) => {
  try {
    const result = await executeTool(req.params.id, req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Skill content ---
app.get('/api/skills/:id/content', (req, res) => {
  const skillPath = path.join(SKILLS_DIR, req.params.id, 'skill.md');
  try { res.type('text/plain').send(fs.readFileSync(skillPath, 'utf8')); }
  catch { res.status(404).json({ error: `Skill '${req.params.id}' not found` }); }
});

// --- Agent system prompt (read-only, for debugging) ---
app.get('/api/agents/:id/system', (req, res) => {
  const file = req.query.file || 'system.txt';
  const agentPath = path.join(AGENTS_DIR, req.params.id, file);
  try { res.type('text/plain').send(fs.readFileSync(agentPath, 'utf8')); }
  catch { res.status(404).json({ error: `Agent system prompt not found` }); }
});

// --- Portfolio ---
const computePortfolioSummary = (p) => {
  const stocksValue  = p.stocks.reduce((s, h) => s + h.quantity * h.current_price, 0);
  const mfValue      = p.mutual_funds.reduce((s, h) => s + h.units * h.nav, 0);
  const fdValue      = p.fixed_deposits.reduce((s, h) => s + h.principal, 0);
  const cryptoValue  = p.crypto.reduce((s, h) => s + h.quantity * h.current_price_inr, 0);
  const cashValue    = p.savings_accounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets  = stocksValue + mfValue + fdValue + cryptoValue + cashValue;
  const totalLiabilities = p.liabilities.reduce((s, l) => s + l.outstanding, 0);
  const netWorth     = totalAssets - totalLiabilities;
  const stocksPnl    = p.stocks.reduce((s, h) => s + h.quantity * (h.current_price - h.avg_buy_price), 0);
  const mfPnl        = p.mutual_funds.reduce((s, h) => s + (h.units * h.nav - h.invested_amount), 0);
  const cryptoPnl    = p.crypto.reduce((s, h) => s + h.quantity * (h.current_price_inr - h.avg_buy_price_inr), 0);
  return {
    net_worth: Math.round(netWorth), total_assets: Math.round(totalAssets),
    total_liabilities: Math.round(totalLiabilities),
    allocation: {
      stocks:       { value: Math.round(stocksValue),  pct: +((stocksValue  / totalAssets) * 100).toFixed(1) },
      mutual_funds: { value: Math.round(mfValue),      pct: +((mfValue      / totalAssets) * 100).toFixed(1) },
      fixed_deposits: { value: Math.round(fdValue),    pct: +((fdValue      / totalAssets) * 100).toFixed(1) },
      crypto:       { value: Math.round(cryptoValue),  pct: +((cryptoValue  / totalAssets) * 100).toFixed(1) },
      cash:         { value: Math.round(cashValue),    pct: +((cashValue    / totalAssets) * 100).toFixed(1) },
    },
    pnl: { stocks: Math.round(stocksPnl), mutual_funds: Math.round(mfPnl),
           crypto: Math.round(cryptoPnl), total: Math.round(stocksPnl + mfPnl + cryptoPnl) },
    goals: p.goals.map(g => ({ ...g, progress_pct: +((g.current / g.target) * 100).toFixed(1) })),
  };
};

app.get('/api/portfolio', (_req, res) => {
  try { res.json(readData(PORTFOLIO_FILE)); }
  catch { res.status(500).json({ error: 'Portfolio data not found' }); }
});

app.get('/api/portfolio/summary', (_req, res) => {
  try { res.json(computePortfolioSummary(readData(PORTFOLIO_FILE))); }
  catch { res.status(500).json({ error: 'Failed to compute portfolio summary' }); }
});

// --- Market Sentiment ---
app.get('/api/market/sentiment', async (_req, res) => {
  try {
    const portfolio = readData(PORTFOLIO_FILE);
    const holdings = [
      ...portfolio.stocks.map(s => ({ symbol: s.symbol, name: s.name || s.symbol })),
      ...portfolio.crypto.map(c => ({ symbol: c.symbol, name: c.coin || c.symbol })),
    ];
    res.json(await getMarketData(holdings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Helpers for SSE headers ---
const setSseHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
};

// --- LLM streaming endpoint (main chat) — full tool-execution loop via OpenAI SDK ---
app.post('/api/llm/stream', async (req, res) => {
  const { messages } = req.body;
  setSseHeaders(res);
  try {
    await runAgentLoop(messages, ALL_TOOL_SCHEMAS, res);
  } catch (err) {
    console.error('[LLM stream error]', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --- LLM non-streaming (memory agent, onboarding extraction) — no tools ---
app.post('/api/llm/chat', async (req, res) => {
  const { messages, maxTokens, temperature, model } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: model || LLM_MODEL,
      messages,
      max_tokens: maxTokens || LLM_MAX_TOKENS,
      temperature: temperature ?? LLM_TEMPERATURE,
      extra_body: { provider: LLM_PROVIDER },
      stream: false,
    });
    res.json(completion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Investment Monitor Agent ---
app.post('/api/agents/investment_monitor/message', async (req, res) => {
  const { messages } = req.body;
  setSseHeaders(res);
  const systemPrompt = loadAgentPrompt('investment_monitor');
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  try {
    await runAgentLoop(fullMessages, getAgentTools('investment_monitor'), res);
  } catch (err) {
    console.error('[InvestmentMonitor] error', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Investment monitor one-shot analysis report (no tool loop needed)
app.post('/api/agents/investment_monitor/run', async (req, res) => {
  let portfolio, analysis;
  try {
    portfolio = readData(PORTFOLIO_FILE);
    analysis  = computeAnalysis(portfolio);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load portfolio data' });
  }
  const systemPrompt = loadAgentPrompt('investment_monitor', 'analysis_system.txt');
  const dataContext  = JSON.stringify({ portfolio, analysis }, null, 2);
  setSseHeaders(res);
  try {
    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Here is the user's portfolio and computed analysis:\n\n${dataContext}\n\nWrite your monitoring report now.` },
      ],
      max_tokens: LLM_MAX_TOKENS,
      temperature: 0.3,
      extra_body: { provider: LLM_PROVIDER },
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --- Market Sentiment Agent ---
app.post('/api/agents/market_sentiment/message', async (req, res) => {
  const { messages } = req.body;
  setSseHeaders(res);
  const systemPrompt = loadAgentPrompt('market_sentiment');
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  try {
    await runAgentLoop(fullMessages, getAgentTools('market_sentiment'), res);
  } catch (err) {
    console.error('[MarketSentiment] error', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --- Serve built frontend ---
app.use(express.static(FRONTEND_DIST));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
