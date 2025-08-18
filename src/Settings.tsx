import { useState, useEffect } from "react";
import UserManagement from "./UserManagement";
import StoreInfo from "./StoreInfo";
import ReceiptSettings from "./ReceiptSettings";
import TillSettings from "./TillSettings";
import "./Settings.css";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'users' | 'store' | 'receipts' | 'till' | 'system'>('users');
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
        {currentUser?.role === 'admin' && (
          <button 
            className={`settings-tab ${activeTab === 'till' ? 'active' : ''}`}
            onClick={() => setActiveTab('till')}
          >
            Till
          </button>
        )}
        <button 
          className={`settings-tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System
        </button>
      </div>
      
      <div className="settings-content">
        {activeTab === 'users' && <UserManagement currentUser={currentUser} onUserUpdate={checkCurrentUser} />}
        {activeTab === 'store' && <StoreInfo />}
        {activeTab === 'receipts' && <ReceiptSettings />}
        {activeTab === 'till' && <TillSettings currentUser={currentUser} />}
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