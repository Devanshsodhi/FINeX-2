import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LoginView from './components/Login/LoginView';
import DashboardView from './components/Dashboard/DashboardView';

const ProtectedRoute = ({ user, children }) => {
  const storedUser = localStorage.getItem('finex_user');
  if (!user && !storedUser) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const AnimatedRoutes = ({ user, onLogin, onLogout }) => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" replace /> : 
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
            >
              <LoginView onLogin={onLogin} />
            </motion.div>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute user={user}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
              >
                <DashboardView user={user} onLogout={onLogout} />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route path="/dashboard/investments" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('finex_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (userData) => {
    const userToStore = { name: userData.name, email: userData.email };
    localStorage.setItem('finex_user', JSON.stringify(userToStore));
    setUser(userToStore);
  };

  const handleLogout = () => {
    localStorage.removeItem('finex_user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark">
        <AnimatedRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
      </div>
    </BrowserRouter>
  );
}

export default App;
