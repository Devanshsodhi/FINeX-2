import React, { useState, useEffect } from 'react';
import { Radio, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import axios from 'axios';

const DOT_COLOR = { BULLISH: 'bg-emerald-400', BEARISH: 'bg-red-400', NEUTRAL: 'bg-gray-400' };
const REGIME_COLOR = { green: 'text-emerald-400', red: 'text-red-400', yellow: 'text-amber-400' };

const MarketCard = ({ onOpen }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/market/sentiment')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-center h-32 animate-pulse">
        <div className="w-6 h-6 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { symbols = {}, regime } = data;
  const topSymbols = Object.entries(symbols).slice(0, 4);
  const regimeColor = REGIME_COLOR[regime?.color] || 'text-gray-400';

  return (
    <div className="bg-gradient-to-br from-charcoal to-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-w-sm transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange">
            <Radio size={14} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Market Pulse</span>
          {regime && (
            <span className={`ml-auto text-[10px] font-black uppercase ${regimeColor}`}>
              ● {regime.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {topSymbols.map(([sym, d]) => (
            <div key={sym} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-2.5 py-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLOR[d.signal] || 'bg-gray-400'}`} />
              <span className="text-[11px] font-bold flex-1 truncate">{sym}</span>
              <span className={`text-[10px] font-black ${d.score > 0.12 ? 'text-emerald-400' : d.score < -0.12 ? 'text-red-400' : 'text-gray-400'}`}>
                {d.score >= 0 ? '+' : ''}{d.score.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onOpen}
          className="w-full group flex items-center justify-center gap-2 py-2.5 bg-brand-orange text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all active:scale-[0.98] shadow-lg shadow-brand-orange/20"
        >
          Open Market Dashboard
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default MarketCard;
