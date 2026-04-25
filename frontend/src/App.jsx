import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LoginView from './components/Login/LoginView';
import DashboardView from './components/Dashboard/DashboardView';

function App() {
  const [view, setView] = useState('login'); // 'login' or 'dashboard'
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    localStorage.setItem('finex_user', JSON.stringify({ name: userData.name }));
    setUser(userData);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('finex_user');
    setUser(null);
    setView('login');
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {view === 'login' ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.5 }}
          >
            <LoginView onLogin={handleLogin} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
          >
            <DashboardView user={user} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
