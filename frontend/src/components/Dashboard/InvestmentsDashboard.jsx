import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, Landmark, Globe, Target, PieChart } from 'lucide-react';
import axios from 'axios';

const ASSET_META = {
  stocks:         { color: '#FF6B35', label: 'Stocks'         },
  mutual_funds:   { color: '#EF4444', label: 'Mutual Funds'   },
  fixed_deposits: { color: '#3B82F6', label: 'Fixed Deposits' },
  crypto:         { color: '#A855F7', label: 'Crypto'         },
  cash:           { color: '#6B7280', label: 'Cash'           },
};

const TABS = [
  { id: 'stocks',         label: 'Stocks'         },
  { id: 'mutual_funds',   label: 'Mutual Funds'   },
  { id: 'fixed_deposits', label: 'Fixed Deposits' },
  { id: 'crypto',         label: 'Crypto'         },
];

const DonutChart = ({ allocation, netWorth, fmt }) => {
  const r = 72;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;
  const segments = Object.entries(allocation).map(([key, item]) => {
    const dashLen = (item.pct / 100) * circ;
    const offset  = circ - (cumulative / 100) * circ;
    cumulative += item.pct;
    return { key, dashLen, offset, color: ASSET_META[key]?.color || '#888' };
  });

  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="22" />
        {segments.map(({ key, dashLen, offset, color }) => (
          <circle
            key={key}
            cx="100" cy="100" r={r}
            fill="none"
            stroke={color}
            strokeWidth="22"
            strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest">Net Worth</p>
        <p className="text-sm font-black leading-tight mt-0.5">{fmt(netWorth)}</p>
      </div>
    </div>
  );
};

const GoalRing = ({ pct }) => {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#FF6B35" strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  );
};

const InvestmentsDashboard = ({ user, onBack }) => {
  const [data, setData]       = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stocks');

  useEffect(() => {
    Promise.all([axios.get('/api/portfolio'), axios.get('/api/portfolio/summary')])
      .then(([p, s]) => { setData(p.data); setSummary(s.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (val) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(val);

  const pnlColor = (v) => v >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlSign  = (v) => v >= 0 ? '+' : '';

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
    </div>
  );
  if (!summary || !data) return null;

  return (
    <div className="min-h-screen bg-dark text-white font-sans">

      {/* Sticky nav bar */}
      <div className="sticky top-0 z-10 bg-dark/90 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">Back to AI Chat</span>
        </button>
        <p className="text-xs text-gray-500 tracking-wide">Portfolio · {user?.name}</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 space-y-8">

        {/* ── Hero: net worth + 3 key stats ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.2em] mb-2">Total Net Worth</p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight">{fmt(summary.net_worth)}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Total Assets',  value: fmt(summary.total_assets),       color: 'text-white'      },
              { label: 'Liabilities',   value: fmt(summary.total_liabilities),   color: 'text-red-400'   },
              { label: 'Total P&L',
                value: `${pnlSign(summary.pnl.total)}${fmt(summary.pnl.total)}`,
                color: pnlColor(summary.pnl.total) },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-5 py-3.5 min-w-[130px]">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-[15px] font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Allocation donut + Goals ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Donut chart */}
          <div className="lg:col-span-2 bg-charcoal border border-white/[0.06] rounded-2xl p-6">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieChart size={12} className="text-brand-orange" />
              Asset Allocation
            </p>
            <DonutChart allocation={summary.allocation} netWorth={summary.net_worth} fmt={fmt} />
            <div className="mt-6 space-y-3">
              {Object.entries(summary.allocation).map(([key, item]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ASSET_META[key]?.color || '#888' }} />
                    <span className="text-gray-400">{ASSET_META[key]?.label || key}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">{fmt(item.value)}</span>
                    <span className="font-bold w-10 text-right tabular-nums">{item.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals grid */}
          <div className="lg:col-span-3 bg-charcoal border border-white/[0.06] rounded-2xl p-6">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Target size={12} className="text-brand-orange" />
              Financial Goals
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summary.goals.map(goal => (
                <div
                  key={goal.id}
                  className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 flex items-start gap-3 hover:border-brand-orange/20 transition-colors"
                >
                  <div className="relative shrink-0">
                    <GoalRing pct={goal.progress_pct} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[8px] font-black">{goal.progress_pct}%</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-tight truncate">{goal.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">by {goal.deadline}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">{fmt(goal.current)} saved</span>
                      <span className="text-[10px] text-brand-orange font-semibold">{fmt(goal.target - goal.current)} left</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Holdings ── */}
        <div className="bg-charcoal border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Underline tab bar */}
          <div className="flex border-b border-white/[0.06] px-6 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'text-brand-orange border-brand-orange'
                    : 'text-gray-500 border-transparent hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 overflow-x-auto">

            {activeTab === 'stocks' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-4 font-semibold uppercase tracking-wider">Symbol</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Qty</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Avg Buy</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Current</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Value</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stocks.map((s, i) => {
                    const val = s.quantity * s.current_price;
                    const pnl = (s.current_price - s.avg_buy_price) * s.quantity;
                    const pct = ((s.current_price - s.avg_buy_price) / s.avg_buy_price) * 100;
                    return (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <p className="font-bold">{s.symbol}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{s.name}</p>
                        </td>
                        <td className="py-4 text-right tabular-nums">{s.quantity}</td>
                        <td className="py-4 text-right text-gray-400 tabular-nums">{fmt(s.avg_buy_price)}</td>
                        <td className="py-4 text-right font-medium tabular-nums">{fmt(s.current_price)}</td>
                        <td className="py-4 text-right font-semibold tabular-nums">{fmt(val)}</td>
                        <td className={`py-4 text-right font-bold tabular-nums ${pnlColor(pnl)}`}>
                          <p>{pnlSign(pnl)}{fmt(pnl)}</p>
                          <p className="text-[9px] opacity-70">{pnlSign(pct)}{pct.toFixed(2)}%</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTab === 'mutual_funds' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-4 font-semibold uppercase tracking-wider">Scheme</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Units</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">NAV</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Invested</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Value</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mutual_funds.map((mf, i) => {
                    const val = mf.units * mf.nav;
                    const ret = val - mf.invested_amount;
                    const retPct = (ret / mf.invested_amount) * 100;
                    return (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 pr-4">
                          <p className="font-bold max-w-[200px] leading-snug">{mf.scheme_name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{mf.category}</p>
                        </td>
                        <td className="py-4 text-right tabular-nums">{mf.units}</td>
                        <td className="py-4 text-right text-gray-400 tabular-nums">{fmt(mf.nav)}</td>
                        <td className="py-4 text-right text-gray-400 tabular-nums">{fmt(mf.invested_amount)}</td>
                        <td className="py-4 text-right font-semibold tabular-nums">{fmt(val)}</td>
                        <td className={`py-4 text-right font-bold tabular-nums ${pnlColor(ret)}`}>
                          <p>{pnlSign(ret)}{fmt(ret)}</p>
                          <p className="text-[9px] opacity-70">{pnlSign(retPct)}{retPct.toFixed(2)}%</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTab === 'fixed_deposits' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-4 font-semibold uppercase tracking-wider">Bank</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Principal</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Rate</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Maturity Date</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Maturity Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fixed_deposits.map((fd, i) => (
                    <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Landmark size={13} className="text-blue-400" />
                          </div>
                          <p className="font-bold">{fd.bank}</p>
                        </div>
                      </td>
                      <td className="py-4 text-right tabular-nums">{fmt(fd.principal)}</td>
                      <td className="py-4 text-right">
                        <span className="text-blue-400 font-bold">{fd.interest_rate}%</span>
                      </td>
                      <td className="py-4 text-right text-gray-400">{fd.maturity_date}</td>
                      <td className="py-4 text-right font-bold text-emerald-400 tabular-nums">{fmt(fd.maturity_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'crypto' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-4 font-semibold uppercase tracking-wider">Asset</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Qty</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Avg Buy</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Current</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">Value</th>
                    <th className="pb-4 font-semibold uppercase tracking-wider text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.crypto.map((coin, i) => {
                    const val = coin.quantity * coin.current_price_inr;
                    const pnl = (coin.current_price_inr - coin.avg_buy_price_inr) * coin.quantity;
                    const pct = ((coin.current_price_inr - coin.avg_buy_price_inr) / coin.avg_buy_price_inr) * 100;
                    return (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                              <Globe size={13} className="text-purple-400" />
                            </div>
                            <div>
                              <p className="font-bold">{coin.coin}</p>
                              <p className="text-[10px] text-gray-500">{coin.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right tabular-nums">{coin.quantity}</td>
                        <td className="py-4 text-right text-gray-400 tabular-nums">{fmt(coin.avg_buy_price_inr)}</td>
                        <td className="py-4 text-right font-medium tabular-nums">{fmt(coin.current_price_inr)}</td>
                        <td className="py-4 text-right font-semibold tabular-nums">{fmt(val)}</td>
                        <td className={`py-4 text-right font-bold tabular-nums ${pnlColor(pnl)}`}>
                          <p>{pnlSign(pnl)}{fmt(pnl)}</p>
                          <p className="text-[9px] opacity-70">{pnlSign(pct)}{pct.toFixed(2)}%</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Liabilities ── */}
        <div className="bg-charcoal border border-white/[0.06] rounded-2xl p-6">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
            <TrendingDown size={12} className="text-red-400" />
            Outstanding Liabilities
          </p>
          <div className="flex flex-wrap gap-4">
            {data.liabilities.map((loan, i) => (
              <div
                key={i}
                className="flex-1 min-w-[200px] bg-red-500/[0.04] border border-red-500/10 rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-bold">{loan.type}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{loan.lender}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-red-400 tabular-nums">{fmt(loan.outstanding)}</p>
                  {loan.emi && <p className="text-[10px] text-gray-500 mt-0.5">EMI: {fmt(loan.emi)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
};

export default InvestmentsDashboard;
