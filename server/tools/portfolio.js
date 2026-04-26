import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_FILE = path.join(__dirname, '..', 'db', 'portfolio.json');

const readPortfolio = () => JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));

// ── helpers ────────────────────────────────────────────────────────────────

const yearsSince = (dateStr) => {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 86400000);
};

const cagr = (currentVal, costVal, years) => {
  if (!years || years < 0.08 || costVal <= 0 || currentVal <= 0) return null;
  return +((Math.pow(currentVal / costVal, 1 / years) - 1) * 100).toFixed(2);
};

// Box-Muller normal random
const randn = () => {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const monteCarlo = (goal, simulations = 1000) => {
  const today = new Date();
  const months = Math.max(1, Math.round((new Date(goal.deadline) - today) / (30 * 86400000)));
  // 10% annual expected return, 15% annual vol — reasonable for a mixed portfolio
  const mu = Math.log(1 + 0.10) / 12;
  const sigma = 0.15 / Math.sqrt(12);

  const results = [];
  for (let i = 0; i < simulations; i++) {
    let value = goal.current;
    for (let m = 0; m < months; m++) {
      value *= Math.exp(mu + sigma * randn());
    }
    results.push(value);
  }
  results.sort((a, b) => a - b);
  const successes = results.filter(v => v >= goal.target).length;

  return {
    success_probability_pct: Math.round((successes / simulations) * 100),
    p10_outcome: Math.round(results[Math.floor(simulations * 0.10)]),
    p50_outcome: Math.round(results[Math.floor(simulations * 0.50)]),
    p90_outcome: Math.round(results[Math.floor(simulations * 0.90)]),
    months_to_deadline: months,
    note: 'Assumes 10% annual return, 15% volatility, current corpus only (no new contributions)',
  };
};

// ── main summary ───────────────────────────────────────────────────────────

const computeSummary = (p) => {
  const stocksValue = p.stocks.reduce((s, h) => s + h.quantity * h.current_price, 0);
  const mfValue     = p.mutual_funds.reduce((s, h) => s + h.units * h.nav, 0);
  const fdValue     = p.fixed_deposits.reduce((s, h) => s + h.principal, 0);
  const cryptoValue = p.crypto.reduce((s, h) => s + h.quantity * h.current_price_inr, 0);
  const cashValue   = p.savings_accounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets = stocksValue + mfValue + fdValue + cryptoValue + cashValue;
  const totalLiabilities = p.liabilities.reduce((s, l) => s + l.outstanding, 0);
  const netWorth = totalAssets - totalLiabilities;

  const stocksPnl  = p.stocks.reduce((s, h) => s + h.quantity * (h.current_price - h.avg_buy_price), 0);
  const mfPnl      = p.mutual_funds.reduce((s, h) => s + (h.units * h.nav - h.invested_amount), 0);
  const cryptoPnl  = p.crypto.reduce((s, h) => s + h.quantity * (h.current_price_inr - h.avg_buy_price_inr), 0);

  // ── CAGR per holding ────────────────────────────────────────────────────
  const stocksCagr = p.stocks.map(s => ({
    symbol: s.symbol,
    cagr_pct: cagr(s.quantity * s.current_price, s.quantity * s.avg_buy_price, yearsSince(s.buy_date)),
    years_held: s.buy_date ? +yearsSince(s.buy_date).toFixed(2) : null,
  }));

  const mfCagr = p.mutual_funds.map(mf => ({
    scheme: mf.scheme_name,
    cagr_pct: cagr(mf.units * mf.nav, mf.invested_amount, yearsSince(mf.start_date)),
    years_held: mf.start_date ? +yearsSince(mf.start_date).toFixed(2) : null,
  }));

  const cryptoCagr = p.crypto.map(c => ({
    coin: c.coin,
    cagr_pct: cagr(c.quantity * c.current_price_inr, c.quantity * c.avg_buy_price_inr, yearsSince(c.buy_date)),
    years_held: c.buy_date ? +yearsSince(c.buy_date).toFixed(2) : null,
  }));

  // ── Portfolio-level Sharpe ratio ────────────────────────────────────────
  // Collect annualized returns (CAGR%) for each tradeable holding
  const allCAGRs = [
    ...stocksCagr.map(s => s.cagr_pct),
    ...mfCagr.map(m => m.cagr_pct),
    ...cryptoCagr.map(c => c.cagr_pct),
  ].filter(r => r !== null);

  let sharpeRatio = null;
  if (allCAGRs.length >= 2) {
    const riskFreeRate = 7.0; // India 10-yr G-sec ~7%
    const avgReturn = allCAGRs.reduce((s, r) => s + r, 0) / allCAGRs.length;
    const variance  = allCAGRs.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / allCAGRs.length;
    const stdDev    = Math.sqrt(variance);
    sharpeRatio = stdDev > 0 ? +((avgReturn - riskFreeRate) / stdDev).toFixed(2) : null;
  }

  // ── Max drawdown (worst single holding loss from cost basis) ───────────
  const allReturnPcts = [
    ...p.stocks.map(s => ((s.current_price - s.avg_buy_price) / s.avg_buy_price) * 100),
    ...p.mutual_funds.map(mf => ((mf.units * mf.nav - mf.invested_amount) / mf.invested_amount) * 100),
    ...p.crypto.map(c => ((c.current_price_inr - c.avg_buy_price_inr) / c.avg_buy_price_inr) * 100),
  ];
  const maxDrawdownPct = allReturnPcts.length ? +Math.min(...allReturnPcts).toFixed(2) : null;

  // Find worst holding name
  let worstHolding = null;
  let worstPct = Infinity;
  [...p.stocks.map(s => ({ name: s.symbol, pct: ((s.current_price - s.avg_buy_price) / s.avg_buy_price) * 100 })),
   ...p.mutual_funds.map(mf => ({ name: mf.scheme_name.split(' ').slice(0, 3).join(' '), pct: ((mf.units * mf.nav - mf.invested_amount) / mf.invested_amount) * 100 })),
   ...p.crypto.map(c => ({ name: c.coin, pct: ((c.current_price_inr - c.avg_buy_price_inr) / c.avg_buy_price_inr) * 100 })),
  ].forEach(h => { if (h.pct < worstPct) { worstPct = h.pct; worstHolding = h.name; } });

  // ── Monte Carlo for goals ───────────────────────────────────────────────
  const goalsWithMonteCarlo = p.goals.map(g => {
    const progressPct = +((g.current / g.target) * 100).toFixed(1);
    const deadline = new Date(g.deadline);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.round((deadline - today) / 86400000));
    const monthsRemaining = +(daysRemaining / 30).toFixed(1);
    const amountRemaining = g.target - g.current;
    const requiredMonthly = monthsRemaining > 0 ? Math.round(amountRemaining / monthsRemaining) : null;
    const mc = monteCarlo(g);
    return {
      ...g,
      progress_pct: progressPct,
      days_remaining: daysRemaining,
      months_remaining: monthsRemaining,
      amount_remaining: amountRemaining,
      required_monthly_contribution: requiredMonthly,
      monte_carlo: mc,
    };
  });

  return {
    net_worth: Math.round(netWorth),
    total_assets: Math.round(totalAssets),
    total_liabilities: Math.round(totalLiabilities),
    allocation: {
      stocks:         { value: Math.round(stocksValue), pct: +((stocksValue / totalAssets) * 100).toFixed(1) },
      mutual_funds:   { value: Math.round(mfValue),     pct: +((mfValue / totalAssets) * 100).toFixed(1) },
      fixed_deposits: { value: Math.round(fdValue),     pct: +((fdValue / totalAssets) * 100).toFixed(1) },
      crypto:         { value: Math.round(cryptoValue), pct: +((cryptoValue / totalAssets) * 100).toFixed(1) },
      cash:           { value: Math.round(cashValue),   pct: +((cashValue / totalAssets) * 100).toFixed(1) },
    },
    pnl: {
      stocks:       Math.round(stocksPnl),
      mutual_funds: Math.round(mfPnl),
      crypto:       Math.round(cryptoPnl),
      total:        Math.round(stocksPnl + mfPnl + cryptoPnl),
    },
    performance_metrics: {
      cagr_by_holding: { stocks: stocksCagr, mutual_funds: mfCagr, crypto: cryptoCagr },
      sharpe_ratio: sharpeRatio,
      sharpe_note: 'Risk-free rate: 7% (India 10-yr G-sec). Based on annualized returns across holdings.',
      max_drawdown_pct: maxDrawdownPct,
      worst_holding: worstHolding,
    },
    goals: goalsWithMonteCarlo,
  };
};

export const get_portfolio     = async () => readPortfolio();
export const get_portfolio_summary = async () => computeSummary(readPortfolio());
