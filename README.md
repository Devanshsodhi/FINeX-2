# FINeX AI — Personal Finance Intelligence Platform

FINeX is a conversational AI financial advisor. It onboards users, maps their complete financial picture, tracks investments, analyses portfolios with Monte Carlo simulations, surfaces real-time market sentiment, and sends email reports — all through a natural chat interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TailwindCSS 4, Framer Motion |
| Backend | Node.js, Express 5 |
| LLM | OpenRouter (gpt-oss-120b) |
| Integrations | Gmail API, Google Calendar API |
| Deployment | Railway (single service) |
| Storage | JSON files (localStorage for memory, server/db/ for portfolio/users/chats) |

---

## Project Structure

```
Final_Project/
├── frontend/                        # React app (Vite)
│   └── src/
│       ├── App.jsx                  # Router — Login ↔ Dashboard
│       ├── components/
│       │   ├── Login/
│       │   │   └── LoginView.jsx    # Login form → /api/auth
│       │   └── Dashboard/
│       │       ├── DashboardView.jsx        # Main chat UI + skill/agent orchestration
│       │       ├── DashboardCard.jsx        # Portfolio summary widget (chat bubble card)
│       │       ├── MarketCard.jsx           # Market pulse widget (chat bubble card)
│       │       ├── MarketView.jsx           # Full market sentiment page
│       │       └── InvestmentsDashboard.jsx # Full portfolio page
│       └── main.jsx
│
├── server/                          # Express backend
│   ├── index.js                     # All API routes + LLM proxy + agent endpoints
│   ├── db/
│   │   ├── users.json               # User accounts
│   │   ├── chats.json               # Chat history
│   │   └── portfolio.json           # Investment portfolio (source of truth)
│   ├── market/
│   │   ├── index.js                 # Aggregates news + social → per-symbol sentiment + regime
│   │   ├── newsClient.js            # NewsAPI + RSS feeds, searches by company name
│   │   ├── sentimentAnalyzer.js     # NLP scoring on articles
│   │   └── stocktwits.js           # StockTwits crowd sentiment
│   └── tools/
│       ├── executor.js              # Dispatches all tool calls by name
│       ├── gmail.js                 # Gmail API wrapper (send, search, list, reply)
│       ├── calendar.js              # Google Calendar API wrapper
│       ├── portfolio.js             # get_portfolio, get_portfolio_summary
│       ├── portfolioAnalysis.js     # computeAnalysis() — rebalancing, tax insights, CAGR, Sharpe
│       ├── financialCalc.js         # calculate_sip, calculate_goal_probability (Monte Carlo), compute_income_tax
│       └── skillLoader.js           # Loads skill .md content from disk on demand
│
├── LLM_integration/                 # Frontend-side LLM orchestration
│   ├── config.js                    # System prompt builder — injects skills, tools, handoff rules, memories
│   ├── history.js                   # Conversation history class + injectSkill()
│   ├── prompts/
│   │   └── system_prompt.md         # Base personality + rules (INR always, concise, no advice)
│   └── memory/
│       ├── memoryAgent.js           # Runs after each turn — extracts facts via LLM, stores them
│       ├── memoryStore.js           # localStorage persistence — upserts onboarding_data, dedupes user_facts
│       ├── memoryTools.js           # storeFact(), recallMemories(), formatMemoriesForPrompt()
│       └── memoryTypes.js           # MEMORY_TYPES constant
│
├── SKILLS/                          # Conversation skill files (loaded on demand)
│   ├── onboarding-1/                # Session 1: 7-field profile (age, income, goal, debt, etc.)
│   ├── onboarding-2/                # Session 2: Income breakdown, insurance, expenses
│   ├── onboarding-3/                # Session 3: Assets and liabilities map
│   ├── onboarding-4/                # Session 4: Behavioral risk profiling (4 scenarios)
│   ├── analytics/                   # Financial analytics (goal probability, SIP, tax, rebalancing)
│   ├── market/                      # Market sentiment display + SHOW_MARKET trigger
│   ├── email/                       # Email composition + send via Gmail
│   └── track/                       # Investment portfolio display + SHOW_DASHBOARD trigger
│   (each skill has _data.json for registry + skill.md for LLM instructions)
│
├── AGENTS/                          # Persistent agents with their own system prompts
│   ├── investment_monitor/          # Activates on "show investments" — shows portfolio widget
│   ├── market_sentiment/            # Activates on "market news" — fetches and shows sentiment
│   ├── memory_agent/                # Runs silently after every turn — writes to long-term memory
│   └── dynamic_agent/               # General-purpose tool orchestrator (email, calendar, etc.)
│   (each agent has _data.json for registry + system.txt for LLM instructions)
│
├── TOOLS/                           # JSON schemas for every tool the LLM can call
│   ├── load_tools.json              # Meta-tool: fetch schema for any tool before calling it
│   ├── load_skill.json              # Meta-tool: activate a skill by id
│   ├── send_email.json
│   ├── search_email.json
│   ├── list_emails.json
│   ├── create_event.json
│   ├── list_events.json
│   ├── get_portfolio.json
│   ├── get_portfolio_summary.json
│   ├── get_market_sentiment.json
│   ├── get_rebalancing_advice.json
│   ├── get_tax_insights.json
│   ├── calculate_sip.json
│   ├── calculate_goal_probability.json   # Monte Carlo simulation tool
│   ├── compute_income_tax.json           # FY 2025-26 new/old regime comparison
│   └── get_exchange_rates.json
│
└── CONNECTORS/                      # External API connector definitions
    ├── gmail/                       # Python + _data.json for Gmail connector
    └── calendar/                    # Python + _data.json for Calendar connector
```

---

## How It Works

### Chat Flow
1. User sends a message in the frontend
2. `DashboardView.jsx` sends it to `/api/llm/stream` on the server
3. Server proxies to OpenRouter with the full message history (including system prompt)
4. System prompt contains: base personality + available skills + available tools + agent handoff rules + user memories
5. LLM response streams back; frontend parses it for special markers

### Special Markers
| Marker | What it does |
|---|---|
| `<USE_TOOL>{...}</USE_TOOL>` | Executes a tool call via `/api/tools/:name/execute` |
| `<HANDOFF>agent_id</HANDOFF>` | Routes conversation to a specialist agent |
| `<SHOW_DASHBOARD>` | Renders the portfolio widget card in chat |
| `<SHOW_MARKET>` | Renders the market pulse widget card in chat |
| `<ONBOARDING_COMPLETE>` | Triggers profile extraction + stores onboarding_data to memory |
| `<SKILL_DONE>` | Clears the active skill bar |
| `<AGENT_DONE>` | Ends the active agent session |

### Skills vs Agents
- **Skills** are stateless instruction sets injected as a system message. They guide the main LLM for a specific task (analytics, onboarding, email). Activated via `/skill-name` or auto-invoked by the LLM.
- **Agents** are persistent sessions with their own system prompt, routed through dedicated endpoints (`/api/agents/:id/message`). Used for multi-turn specialist workflows (investment monitor, market sentiment).

### Memory System
- After each exchange, `memoryAgent.js` sends the conversation to the LLM with instructions to extract memorable facts
- Facts are stored in `localStorage` as `user_fact` or `onboarding_data`
- `onboarding_data` is a single upserted record (no duplicates)
- `user_fact` entries are deduplicated by exact content match
- Onboarding session completion facts are always pinned at the top of the memory prompt regardless of recency

### Market Sentiment Pipeline
1. `/api/market/sentiment` reads holdings from `portfolio.json` (symbol + full name)
2. For each holding: fetches news via NewsAPI + RSS feeds (searching by company name), fetches StockTwits crowd sentiment
3. Blends: 60% news score + 40% social score
4. Classifies each as BULLISH / BEARISH / NEUTRAL
5. Classifies overall regime: Risk-On / Risk-Off / Neutral
6. Caches for 15 minutes

### Financial Calculations (server-side)
- **SIP Projection**: future value with pessimistic/base/optimistic scenarios
- **Goal Probability**: Monte Carlo (1,000 simulations, Box-Muller normal distribution) — also binary-searches for the monthly contribution needed to hit 80% success probability
- **Income Tax**: exact FY 2025-26 slabs for new and old regime with 87A rebate
- **Rebalancing**: current vs target allocation drift in ₹ with tax implications per trade
- **Tax Insights**: LTCG harvesting candidates, 80C gap, crypto tax (30% flat)

---

## Setup

### Prerequisites
- Node.js 18+
- OpenRouter API key
- NewsAPI key (for market sentiment)
- Google OAuth2 credentials (for Gmail/Calendar)

### Environment Variables
Create a `.env` file in the root:
```
OPENROUTER_API_KEY=your_key_here
NEWSAPI_KEY=your_key_here
SITE_URL=http://localhost:5000
```

### Local Development
```bash
# Install all dependencies
npm run install:all

# Run frontend + backend in parallel
npm run dev:server   # Express on :5000
npm run dev:frontend # Vite on :5173 (proxies API to :5000)
```

### Production Build
```bash
npm run build   # builds frontend/dist, installs server deps
npm start       # serves everything from Express on $PORT
```

---

## Deployment (Railway)

The `railway.json` configures:
- **Build**: `npm run install:all && npm run build`
- **Start**: `npm start`

Set `OPENROUTER_API_KEY`, `NEWSAPI_KEY`, and `SITE_URL` as Railway environment variables.

---

## Onboarding Sessions

| Session | Covers | Completion trigger |
|---|---|---|
| Session 1 | Age, country, income, dependents, goal, emergency fund, debt | `<ONBOARDING_COMPLETE>` stores 7-field profile |
| Session 2 | Income sources, occupation, insurance, monthly expenses | `<ONBOARDING_COMPLETE>` updates profile |
| Session 3 | Assets (stocks, MFs, crypto, property, FDs) + liabilities | `<ONBOARDING_COMPLETE>` updates profile |
| Session 4 | Behavioral risk profiling — 4 scenarios → risk archetype | `<ONBOARDING_COMPLETE>` records risk profile |

Sessions are never auto-chained. Each session completion is recorded as a `user_fact` so the LLM never restarts a completed session.
