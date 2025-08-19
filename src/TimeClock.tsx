import React, { useState, useEffect } from 'react';
import './TimeClock.css';

interface TimeClockProps {
  user: any;
  onClose: () => void;
}

const TimeClock: React.FC<TimeClockProps> = ({ user, onClose }) => {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    checkCurrentShift();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkCurrentShift = async () => {
    try {
      const result = await window.api.getCurrentShift(user.id);
      if (result.success && result.data) {
        setCurrentShift(result.data);
      }
    } catch (error) {
      console.error('Error checking shift:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = async () => {
    try {
      setLoading(true);
      const result = await window.api.punchIn(user.id);
      if (result.success) {
        await checkCurrentShift();
        alert('Successfully punched in!');
      } else {
        alert(result.error || 'Failed to punch in');
      }
    } catch (error) {
      console.error('Error punching in:', error);
      alert('Failed to punch in');
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setLoading(true);
      const result = await window.api.punchOut(user.id);
      if (result.success) {
        setCurrentShift(null);
        alert('Successfully punched out!');
        onClose();
      } else {
        alert(result.error || 'Failed to punch out');
      }
    } catch (error) {
      console.error('Error punching out:', error);
      alert('Failed to punch out');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueShift = () => {
    onClose();
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <div className="timeclock-overlay">
        <div className="timeclock-modal">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeclock-overlay">
      <div className="timeclock-modal">
        <div className="timeclock-header">
          <h2>Time Clock</h2>
          <div className="current-time">{formatTime(currentTime)}</div>
        </div>

        <div className="timeclock-content">
          <div className="employee-info">
            <h3>Welcome, {user.username}</h3>
            <p className="employee-role">{user.role}</p>
          </div>

          {!currentShift ? (
            <div className="punch-in-section">
              <p className="status-message">You are not currently clocked in</p>
              <button 
                className="punch-btn punch-in"
                onClick={handlePunchIn}
                disabled={loading}
              >
                <span className="btn-icon">🕐</span>
                <span className="btn-text">Punch In for Shift</span>
              </button>
            </div>
          ) : (
            <div className="shift-active-section">
              <div className="shift-info">
                <h4>Current Shift</h4>
                <div className="shift-details">
                  <div className="detail-row">
                    <span className="label">Punched in at:</span>
                    <span className="value">{formatTime(currentShift.punch_in)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Duration:</span>
                    <span className="value duration">{formatDuration(currentShift.punch_in)}</span>
                  </div>
                </div>
              </div>

              <div className="shift-actions">
                <button 
                  className="punch-btn continue"
                  onClick={handleContinueShift}
                >
                  <span className="btn-icon">➡️</span>
                  <span className="btn-text">Continue Shift</span>
                </button>
                <button 
                  className="punch-btn punch-out"
                  onClick={handlePunchOut}
                  disabled={loading}
                >
                  <span className="btn-icon">🔚</span>
                  <span className="btn-text">Punch Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {!currentShift && (
          <div className="timeclock-footer">
            <button className="cancel-btn" onClick={onClose}>
              Skip for Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeClock;