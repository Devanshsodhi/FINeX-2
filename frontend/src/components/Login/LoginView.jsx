import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, LogIn, ArrowRight, TrendingUp, Wallet, CheckCircle, PieChart, Coffee, Landmark, X, Calendar, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Logo = ({ className }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative w-9 h-9">
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-orange to-brand-red rounded-xl rotate-45 opacity-20 animate-pulse" />
      <svg viewBox="0 0 40 40" className="w-9 h-9 relative z-10">
        <defs>
          <linearGradient id="swirlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="100%" stopColor="#E63946" />
          </linearGradient>
        </defs>
        <path 
          d="M20 5C11.7157 5 5 11.7157 5 20C5 28.2843 11.7157 35 20 35C28.2843 35 35 28.2843 35 20" 
          stroke="url(#swirlGrad)" 
          strokeWidth="6" 
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="20" cy="20" r="4" fill="url(#swirlGrad)" />
      </svg>
    </div>
    <span className="text-[28px] font-extrabold text-white tracking-tighter">FINeX</span>
  </div>
);

const FloatingWidget = ({ icon: Icon, label, value, subValue, x, y, rotation, delay = 0, color="ai-green" }) => (
  <motion.div 
    className="absolute glass-frosted p-3 md:p-3.5 flex items-center gap-3 z-30 pointer-events-none"
    style={{ left: x, top: y, rotate: `${rotation}deg` }}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ 
        opacity: 1, 
        scale: 1,
        y: [0, -12, 0],
        x: [0, 8, 0]
    }}
    transition={{ 
        opacity: { duration: 1, delay },
        scale: { duration: 1, delay },
        y: { repeat: Infinity, duration: 5 + delay, ease: "easeInOut" },
        x: { repeat: Infinity, duration: 7 + delay, ease: "easeInOut" }
    }}
  >
    <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-${color}`}>
      <Icon size={18} />
    </div>
    <div className="flex flex-col">
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-[15px] font-bold text-white leading-none">{value}</p>
        {subValue && <span className={`text-[10px] font-bold ${subValue.includes('↑') || subValue.includes('+') ? 'text-ai-green' : 'text-brand-red'}`}>{subValue}</span>}
      </div>
    </div>
  </motion.div>
);

const LoginView = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Invalid email or password');
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-y-auto overflow-x-hidden font-sans bg-white">
      {/* Left Panel: Abstract Constellation Hero (55% Width) */}
      <div className="hidden md:flex md:w-[55%] flex-col justify-between p-16 relative overflow-hidden bg-dark"
           style={{
             background: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #121212 50%, #0e0e0e 100%)'
           }}>
        
        {/* Noise & Dot Grid Overlays */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none noise-texture" />
        <div className="absolute inset-0 opacity-[0.03] dot-grid" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-brand-orange/[0.08] blur-[160px] rounded-full pointer-events-none z-10" />
        
        {/* Top Header Logo */}
        <Logo className="relative z-50 opacity-90 scale-90 origin-left" />

        {/* Constellation Layout Container */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          
          {/* Central Typography Gravity Anchor */}
          <div className="relative z-30 text-center max-w-lg">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
            >
                <h1 className="text-[56px] font-extrabold text-white leading-tight mb-2 tracking-tight drop-shadow-lg">
                    Manage your
                </h1>
                <h1 className="text-[64px] font-black bg-gradient-to-r from-brand-orange to-brand-red bg-clip-text text-transparent leading-[1.1] pb-2 mb-6 tracking-tighter drop-shadow-xl">
                    money
                </h1>
                <p className="text-gray-400 text-[15px] font-medium leading-relaxed max-w-[280px] mx-auto opacity-90">
                    Track, grow, and control your finances — all in one place.
                </p>
            </motion.div>
          </div>

          {/* Orbiting Widgets */}
          {/* 1. Portfolio Value (Top-Left) */}
          <FloatingWidget 
            icon={Landmark}
            label="Portfolio Value"
            value="$12,345.67"
            subValue="↑ 1.24%"
            x="8%" y="22%" rotation={-3.5}
            delay={0.1}
          />

          {/* 2. This Month (Top-Right) */}
          <FloatingWidget 
            icon={TrendingUp}
            label="This Month"
            value="+12.4% Returns"
            subValue="Sparkline"
            x="64%" y="12%" rotation={2.8}
            delay={0.4}
            color="ai-green"
          />

          {/* 3. Active Investments (Left-Center) */}
          <FloatingWidget 
            icon={PieChart}
            label="Active Investments"
            value="6 Assets"
            x="5%" y="45%" rotation={-1.5}
            delay={0.7}
            color="brand-orange"
          />

          {/* 4. Savings Goal (Right-Center) */}
          <FloatingWidget 
            icon={CheckCircle}
            label="Savings Goal"
            value="78% Reached"
            x="70%" y="48%" rotation={3.2}
            delay={1.1}
            color="brand-orange"
          />

          {/* 5. Last Transaction (Bottom-Left) */}
          <FloatingWidget 
            icon={Coffee}
            label="Last Transaction"
            value="-$45.00 Coffee"
            x="12%" y="70%" rotation={-2.4}
            delay={1.5}
            color="brand-red"
          />

          {/* 6. Net Worth (Bottom-Right) */}
          <FloatingWidget 
            icon={Wallet}
            label="Net Worth"
            value="$48,210"
            subValue="↑ 3.2%"
            x="68%" y="72%" rotation={1.8}
            delay={1.9}
            color="ai-green"
          />

          {/* 7. Next Bill Due (Bottom-Center) */}
          <FloatingWidget 
            icon={Calendar}
            label="Next Bill Due"
            value="Apr 28 — Netflix"
            subValue="$15.99"
            x="38%" y="80%" rotation={-1}
            delay={2.3}
            color="brand-red"
          />
        </div>

        {/* Footer branding - Centered to avoid alignment issues */}
        <div className="absolute bottom-8 left-0 right-0 z-0 opacity-20 pointer-events-none hidden md:block text-center">
            <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Financial Intelligence • 2025</p>
        </div>
      </div>

      {/* Right Panel: Login Form (45% Width) */}
      <div className="flex-1 md:w-[45%] flex flex-col items-center justify-center p-8 md:p-12 relative overflow-y-auto bg-white">
        
        <div className="w-full max-w-[420px] relative z-10">
          <div className="mb-14 text-center md:text-left">
            <h2 className="text-[40px] font-bold text-navy-dark leading-tight tracking-tight mb-2">
              Sign In
            </h2>
            <p className="text-gray-400 font-medium">Welcome back! Please enter your details.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-gray-500 tracking-[0.5px] uppercase">
                Email or Username
              </label>
              <input
                type="text"
                className="input-field h-[54px]"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 relative">
              <div className="flex justify-between items-center pr-1">
                <label className="text-[13px] font-semibold text-gray-500 tracking-[0.5px] uppercase">Password</label>
                <a href="#" className="text-[13.5px] font-bold text-brand-orange hover:text-brand-red transition-colors">Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field h-[54px] pr-14"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-50 text-red-500 text-[13px] font-semibold rounded-xl border border-red-100 flex items-center gap-3"
              >
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[58px] btn-gradient rounded-xl flex items-center justify-center gap-3 shadow-xl"
            >
              <span className="text-lg font-bold tracking-wide">Sign In to Dashboard</span>
              <ArrowRight size={22} className="text-white opacity-80" />
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-[14.5px] text-gray-500 font-medium">
                Don't have an account? <a href="#" className="font-extrabold text-brand-orange hover:text-brand-red transition-colors underline decoration-brand-orange/30 underline-offset-4">Sign Up</a>
            </p>
          </div>

          <div className="mt-24 flex justify-between items-center text-[11px] font-semibold text-gray-400">
             <p className="tracking-widest uppercase opacity-80">© 2025 FINeX GLOBAL</p>
             <div className="flex gap-6">
                <a href="#" className="hover:text-navy-dark transition-all">Support</a>
                <a href="#" className="hover:text-navy-dark transition-all">Privacy</a>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
