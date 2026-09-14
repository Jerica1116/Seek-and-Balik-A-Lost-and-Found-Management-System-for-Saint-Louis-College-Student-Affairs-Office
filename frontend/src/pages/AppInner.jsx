import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import LoginModal from '../components/LoginModal';

import PublicBoard from './PublicLanding';


import { useNavigate } from 'react-router-dom';

const AppInner = () => {
  const { setLogin } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (role) => {
  setLogin(role);
  setShowLogin(false);

  navigate('/dashboard', { replace: true });
};

  return (
    <>
      <PublicBoard onOpenLogin={() => setShowLogin(true)} />
      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
    </>
  );
};

export default AppInner;