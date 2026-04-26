import React, { useState, useEffect } from 'react';
import { Wallet, ArrowRight, TrendingUp } from 'lucide-react';
import axios from 'axios';

const DashboardCard = ({ onOpen }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get('/api/portfolio/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Error fetching portfolio summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-center h-32 animate-pulse">
        <div className="w-6 h-6 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-gradient-to-br from-charcoal to-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-w-sm transition-all duration-300 scale-100 opacity-100">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange">
            <Wallet size={14} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your Portfolio</span>
        </div>

        <div className="mb-4">
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Net Worth</p>
          <h4 className="text-2xl font-black tracking-tight">{formatCurrency(summary.net_worth)}</h4>
        </div>

        <div className="flex gap-2 mb-5">
          {Object.entries(summary.allocation).slice(0, 3).map(([key, item]) => (
            <div key={key} className="flex-1 bg-white/[0.03] border border-white/5 p-2 rounded-xl">
              <p className="text-[9px] text-gray-500 uppercase font-black truncate">{key.replace('_', ' ')}</p>
              <p className="text-[11px] font-bold">{item.pct}%</p>
            </div>
          ))}
          <div className="flex-1 bg-brand-orange/10 border border-brand-orange/20 p-2 rounded-xl flex items-center justify-center">
             <TrendingUp size={12} className="text-brand-orange" />
          </div>
        </div>

        <button 
          onClick={onOpen}
          className="w-full group flex items-center justify-center gap-2 py-2.5 bg-brand-orange text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all active:scale-[0.98] shadow-lg shadow-brand-orange/20"
        >
          Open Full Dashboard
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default DashboardCard;
