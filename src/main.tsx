import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './App.css'

// Wrapper component to handle app remounting
function AppWrapper() {
  const [appKey, setAppKey] = useState(0);
  
  useEffect(() => {
    // Listen for a custom event to trigger app remount
    const handleRemount = () => {
      setAppKey(prev => prev + 1);
    };
    
    window.addEventListener('app-remount', handleRemount);
    return () => window.removeEventListener('app-remount', handleRemount);
  }, []);
  
  return <App key={appKey} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
)
