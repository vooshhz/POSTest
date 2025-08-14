import { useState, useEffect } from "react";
import UserManagement from "./UserManagement";
import "./Settings.css";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'users' | 'store' | 'receipts' | 'system'>('users');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const result = await window.api.getCurrentUser();
    if (result.success) {
      setCurrentUser(result.user);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        {currentUser && (
          <div className="current-user-info">
            Logged in as: <strong>{currentUser.username}</strong> ({currentUser.role})
          </div>
        )}
      </div>
      
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={`settings-tab ${activeTab === 'store' ? 'active' : ''}`}
          onClick={() => setActiveTab('store')}
        >
          Store Info
        </button>
        <button 
          className={`settings-tab ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipts')}
        >
          Receipts
        </button>
        <button 
          className={`settings-tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System
        </button>
      </div>
      
      <div className="settings-content">
        {activeTab === 'users' && <UserManagement currentUser={currentUser} onUserUpdate={checkCurrentUser} />}
        {activeTab === 'store' && (
          <div className="settings-panel">
            <h3>Store Information</h3>
            <p>Store configuration settings will go here...</p>
          </div>
        )}
        {activeTab === 'receipts' && (
          <div className="settings-panel">
            <h3>Receipt Settings</h3>
            <p>Receipt header and footer customization will go here...</p>
          </div>
        )}
        {activeTab === 'system' && (
          <div className="settings-panel">
            <h3>System Settings</h3>
            <p>System preferences and configuration will go here...</p>
          </div>
        )}
      </div>
    </div>
  );
}