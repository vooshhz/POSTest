import { api } from './api/apiLayer';
import { useState, useEffect } from "react";
import "./TillSettings.css";

interface TillSettings {
  enabled: boolean;
  denominations: {
    ones: number;
    fives: number;
    tens: number;
    twenties: number;
    fifties: number;
    hundreds: number;
  };
}

interface Props {
  currentUser: any;
}

export default function TillSettings({ currentUser }: Props) {
  const [settings, setSettings] = useState<TillSettings>({
    enabled: false,
    denominations: {
      ones: 0,
      fives: 0,
      tens: 0,
      twenties: 0,
      fifties: 0,
      hundreds: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTillSettings();
  }, []);

  const loadTillSettings = async () => {
    try {
      const result = await api.getTillSettings();
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (err) {
      console.error("Error loading till settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage("");
    
    try {
      const result = await api.saveTillSettings(settings);
      if (result.success) {
        setMessage("Till settings saved successfully!");
        // If enabling, initialize the till automatically
        if (settings.enabled) {
          await api.initializeTill(settings.denominations);
        }
      } else {
        setMessage(result.error || "Failed to save settings");
      }
    } catch (err) {
      setMessage("Error saving settings");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDenominationChange = (denom: keyof typeof settings.denominations, value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings(prev => ({
      ...prev,
      denominations: {
        ...prev.denominations,
        [denom]: numValue
      }
    }));
  };

  const calculateTotal = (denoms: typeof settings.denominations) => {
    return (
      denoms.ones * 1 +
      denoms.fives * 5 +
      denoms.tens * 10 +
      denoms.twenties * 20 +
      denoms.fifties * 50 +
      denoms.hundreds * 100
    );
  };


  // Only show till settings to admin users
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="settings-panel">
        <h3>Till Management</h3>
        <div className="access-denied">
          Only administrators can access till settings.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="settings-panel">
        <h3>Till Management</h3>
        <div className="loading">Loading till settings...</div>
      </div>
    );
  }

  return (
    <div className="till-settings">
      <h3>Till Management</h3>
      
      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="till-settings-section">
        <h4>Default Till Settings</h4>
        
        <div className="enable-till">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span>Enable Default Till Settings</span>
          </label>
          <p className="help-text">
            When enabled, the till will automatically start each day with the specified bill counts
          </p>
        </div>

        {settings.enabled && (
          <div className="denominations-section">
            <h5>Starting Bill Count</h5>
            <p className="help-text">Enter the number of bills for each denomination at start of day</p>
            
            <div className="denominations-grid">
              <div className="denomination-input">
                <label>$1 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.ones}
                  onChange={(e) => handleDenominationChange('ones', e.target.value)}
                />
                <span className="total">${settings.denominations.ones * 1}</span>
              </div>

              <div className="denomination-input">
                <label>$5 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.fives}
                  onChange={(e) => handleDenominationChange('fives', e.target.value)}
                />
                <span className="total">${settings.denominations.fives * 5}</span>
              </div>

              <div className="denomination-input">
                <label>$10 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.tens}
                  onChange={(e) => handleDenominationChange('tens', e.target.value)}
                />
                <span className="total">${settings.denominations.tens * 10}</span>
              </div>

              <div className="denomination-input">
                <label>$20 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.twenties}
                  onChange={(e) => handleDenominationChange('twenties', e.target.value)}
                />
                <span className="total">${settings.denominations.twenties * 20}</span>
              </div>

              <div className="denomination-input">
                <label>$50 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.fifties}
                  onChange={(e) => handleDenominationChange('fifties', e.target.value)}
                />
                <span className="total">${settings.denominations.fifties * 50}</span>
              </div>

              <div className="denomination-input">
                <label>$100 Bills</label>
                <input
                  type="number"
                  min="0"
                  value={settings.denominations.hundreds}
                  onChange={(e) => handleDenominationChange('hundreds', e.target.value)}
                />
                <span className="total">${settings.denominations.hundreds * 100}</span>
              </div>
            </div>

            <div className="total-cash">
              <strong>Total Starting Cash:</strong>
              <span className="amount">${calculateTotal(settings.denominations)}</span>
            </div>
          </div>
        )}

        <div className="settings-actions">
          <button 
            className="save-btn"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}