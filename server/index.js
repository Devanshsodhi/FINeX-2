import express from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { executeTool } from './tools/executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env for local development (no-op in production where env vars are set by the host)
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

const USERS_FILE = path.join(__dirname, 'db', 'users.json');
const CHATS_FILE = path.join(__dirname, 'db', 'chats.json');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const SKILLS_DIR = path.join(__dirname, '..', 'SKILLS');
const AGENTS_DIR = path.join(__dirname, '..', 'AGENTS');
const CONNECTORS_DIR = path.join(__dirname, '..', 'CONNECTORS');
const TOOLS_DIR = path.join(__dirname, '..', 'TOOLS');

// Build skills registry at startup — reads every SKILLS/*/_data.json
const buildSkillsRegistry = () => {
  try {
    return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, d.name, '_data.json'), 'utf8'));
          return data;
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
};

const SKILLS_REGISTRY = buildSkillsRegistry();

const buildAgentsRegistry = () => {
  try {
    return fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        try {
          return JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, d.name, '_data.json'), 'utf8'));
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
};

const AGENTS_REGISTRY = buildAgentsRegistry();

const buildConnectorsRegistry = () => {
  try {
    return fs.readdirSync(CONNECTORS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        try {
          return JSON.parse(fs.readFileSync(path.join(CONNECTORS_DIR, d.name, '_data.json'), 'utf8'));
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
};

const CONNECTORS_REGISTRY = buildConnectorsRegistry();

const buildToolsRegistry = () => {
  try {
    return fs.readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf8'));
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
};

const TOOLS_REGISTRY = buildToolsRegistry();

const LLM_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = 'openai/gpt-oss-120b';
const LLM_MAX_TOKENS = 2000;
const LLM_TEMPERATURE = 0.4;
const LLM_PROVIDER = { order: ['DeepInfra'], quantizations: ['bf16'] };

const readData = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

// --- Auth ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readData(USERS_FILE);
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// --- Chats ---
app.get('/api/chats', (req, res) => {
  res.json(readData(CHATS_FILE));
});

// --- Skills ---
app.get('/api/skills', (_req, res) => {
  res.json(SKILLS_REGISTRY);
});

app.get('/api/agents', (_req, res) => {
  res.json(AGENTS_REGISTRY);
});

app.get('/api/connectors', (_req, res) => {
  res.json(CONNECTORS_REGISTRY);
});

app.get('/api/tools', (_req, res) => {
  res.json(TOOLS_REGISTRY);
});

app.post('/api/tools/:id/execute', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await executeTool(id, req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/skills/:id/content', (req, res) => {
  const skillPath = path.join(SKILLS_DIR, req.params.id, 'skill.md');
  try {
    res.type('text/plain').send(fs.readFileSync(skillPath, 'utf8'));
  } catch {
    res.status(404).json({ error: `Skill '${req.params.id}' not found` });
  }
});

// --- LLM non-streaming proxy (used by memory agent with custom config) ---
app.post('/api/llm/chat', async (req, res) => {
  const { messages, maxTokens, temperature, model } = req.body;
  const upstream = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.SITE_URL || `http://localhost:${PORT}`,
    },
    body: JSON.stringify({
      model: model || LLM_MODEL,
      messages,
      max_tokens: maxTokens || LLM_MAX_TOKENS,
      temperature: temperature ?? LLM_TEMPERATURE,
      provider: LLM_PROVIDER,
    }),
  });
  const data = await upstream.json();
  res.json(data);
});

// --- LLM streaming proxy (keeps API key server-side) ---
app.post('/api/llm/stream', async (req, res) => {
  const { messages } = req.body;

  const upstream = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.SITE_URL || `http://localhost:${PORT}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      stream: true,
      provider: LLM_PROVIDER,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    console.error('[LLM stream error]', JSON.stringify(err));
    return res.status(upstream.status).json({ error: err.error?.message || 'LLM error' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Use Node.js Readable.fromWeb to pipe the web stream to the Express response
  Readable.fromWeb(upstream.body).pipe(res);
});


// --- Serve built frontend ---
app.use(express.static(FRONTEND_DIST));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
