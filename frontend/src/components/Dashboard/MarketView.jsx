import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink, Radio } from 'lucide-react';

const SIGNAL_CONFIG = {
  BULLISH:  { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400', icon: TrendingUp },
  BEARISH:  { color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',         dot: 'bg-red-400',     icon: TrendingDown },
  NEUTRAL:  { color: 'text-gray-400',    bg: 'bg-gray-400/10 border-gray-400/20',        dot: 'bg-gray-400',    icon: Minus },
};

const REGIME_CONFIG = {
  green:  { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  red:    { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400',     dot: 'bg-red-400' },
  yellow: { bg: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-400',   dot: 'bg-amber-400' },
};

const fmt = (score) => (score >= 0 ? '+' : '') + score.toFixed(2);

const ScoreBar = ({ score }) => {
  const pct = Math.round(((score + 1) / 2) * 100);
  const color = score > 0.12 ? 'bg-emerald-400' : score < -0.12 ? 'bg-red-400' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${score > 0.12 ? 'text-emerald-400' : score < -0.12 ? 'text-red-400' : 'text-gray-400'}`}>
        {fmt(score)}
      </span>
    </div>
  );
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const sentimentOpacity = (publishedAt) => {
  const h = (Date.now() - new Date(publishedAt || Date.now()).getTime()) / 3_600_000;
  return Math.max(0.4, Math.exp(-0.03 * h));
};

const MarketView = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      const res = await axios.get('/api/market/sentiment');
      setData(res.data);
      const symbols = Object.keys(res.data.symbols || {});
      if (symbols.length && !activeSymbol) setActiveSymbol(symbols[0]);
    } catch (e) {
      setError('Failed to load market data. Check your NEWSAPI_KEY env variable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Scanning news & sentiment…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm underline">Go back</button>
        </div>
      </div>
    );
  }

  const { symbols = {}, regime, cachedAt } = data || {};
  const symbolKeys = Object.keys(symbols);
  const activeData = activeSymbol ? symbols[activeSymbol] : null;
  const regimeCfg = REGIME_CONFIG[regime?.color] || REGIME_CONFIG.yellow;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Nav */}
      <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-white/5 bg-dark/80 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-brand-orange" />
          <span className="text-sm font-bold tracking-wide">Market Pulse</span>
        </div>
        <button
          onClick={() => load(true)}
          className={`flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition-colors ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* Regime Banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${regimeCfg.bg}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${regimeCfg.dot} animate-pulse`} />
            <div>
              <span className={`font-bold text-sm ${regimeCfg.text}`}>{regime?.label}</span>
              <span className="text-gray-400 text-sm ml-2">— {regime?.description}</span>
            </div>
            {cachedAt && (
              <span className="ml-auto text-gray-600 text-xs shrink-0">
                Updated {timeAgo(cachedAt)}
              </span>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Left: Symbol list */}
            <div className="lg:col-span-2 bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Your Holdings</p>
              </div>
              <div className="divide-y divide-white/5">
                {symbolKeys.map(sym => {
                  const d = symbols[sym];
                  const cfg = SIGNAL_CONFIG[d.signal] || SIGNAL_CONFIG.NEUTRAL;
                  const Icon = cfg.icon;
                  const isActive = activeSymbol === sym;
                  return (
                    <button
                      key={sym}
                      onClick={() => setActiveSymbol(sym)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="font-bold text-sm flex-1">{sym}</span>
                      <div className="flex items-center gap-1.5">
                        <ScoreBar score={d.score} />
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${cfg.bg} ${cfg.color} shrink-0`}>
                          {d.signal}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: News feed for active symbol */}
            <div className="lg:col-span-3 bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  News — {activeSymbol}
                </p>
                {activeData?.stocktwits && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="text-emerald-400 font-bold">{activeData.stocktwits.bullish}↑</span>
                    <span className="text-red-400 font-bold">{activeData.stocktwits.bearish}↓</span>
                    <span>StockTwits</span>
                  </div>
                )}
              </div>

              <div className="divide-y divide-white/5">
                {activeData?.articles?.length ? activeData.articles.map((article, i) => {
                  const sentCfg = SIGNAL_CONFIG[article.sentiment > 0.12 ? 'BULLISH' : article.sentiment < -0.12 ? 'BEARISH' : 'NEUTRAL'];
                  const opacity = sentimentOpacity(article.publishedAt);
                  return (
                    <div key={i} className="px-4 py-3.5" style={{ opacity }}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${sentCfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 leading-snug mb-1 line-clamp-2">
                            {article.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-gray-500">{article.source}</span>
                            <span className="text-[10px] text-gray-600">·</span>
                            <span className="text-[10px] text-gray-500">{timeAgo(article.publishedAt)}</span>
                            <span className={`text-[10px] font-bold ${sentCfg.color}`}>{fmt(article.sentiment)}</span>
                            {article.url && (
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-gray-600 hover:text-gray-400 transition-colors"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No news found for {activeSymbol}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: All symbols summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {symbolKeys.map(sym => {
              const d = symbols[sym];
              const cfg = SIGNAL_CONFIG[d.signal] || SIGNAL_CONFIG.NEUTRAL;
              return (
                <button
                  key={sym}
                  onClick={() => setActiveSymbol(sym)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${activeSymbol === sym ? cfg.bg + ' border-opacity-60' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
                >
                  <span className="text-xs font-black">{sym}</span>
                  <span className={`text-lg font-black font-mono ${d.score > 0.12 ? 'text-emerald-400' : d.score < -0.12 ? 'text-red-400' : 'text-gray-400'}`}>
                    {fmt(d.score)}
                  </span>
                  <span className={`text-[9px] font-black uppercase ${cfg.color}`}>{d.signal}</span>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default MarketView;
