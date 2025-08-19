import { api } from './api/apiLayer';
import React, { useState, useEffect } from 'react';
import './TimeTracking.css';

interface TimeEntry {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  punch_in: string;
  punch_out: string | null;
  shift_date: string;
  duration_minutes: number | null;
}

interface GroupedEntries {
  [date: string]: TimeEntry[];
}

const TimeTracking: React.FC = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<number | 'all'>('all');
  const [users, setUsers] = useState<Array<{ id: number; username: string; full_name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'entries' | 'daily'>('summary');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadUsers();
    loadEntries();
  }, [selectedUser, dateRange]);

  const loadUsers = async () => {
    try {
      const result = await api.getUsers();
      if (result.success && result.users) {
        setUsers(result.users.filter(u => u.active === 1));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const filters: any = {
        startDate: dateRange.start,
        endDate: dateRange.end
      };
      
      if (selectedUser !== 'all') {
        filters.userId = selectedUser;
      }
      
      const result = await api.getTimeClockEntries(filters);
      if (result.success && result.data) {
        setEntries(result.data);
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Active';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateTotalHours = (userEntries: TimeEntry[]) => {
    const totalMinutes = userEntries.reduce((sum, entry) => {
      return sum + (entry.duration_minutes || 0);
    }, 0);
    return totalMinutes / 60;
  };

  const groupEntriesByDate = (entries: TimeEntry[]): GroupedEntries => {
    const grouped: GroupedEntries = {};
    entries.forEach(entry => {
      if (!grouped[entry.shift_date]) {
        grouped[entry.shift_date] = [];
      }
      grouped[entry.shift_date].push(entry);
    });
    return grouped;
  };

  const groupEntriesByUser = () => {
    const byUser: { [key: string]: TimeEntry[] } = {};
    entries.forEach(entry => {
      const key = entry.full_name;
      if (!byUser[key]) {
        byUser[key] = [];
      }
      byUser[key].push(entry);
    });
    return byUser;
  };

  const exportToCSV = () => {
    const headers = ['Employee', 'Date', 'Punch In', 'Punch Out', 'Duration', 'Hours'];
    const rows = entries.map(entry => [
      entry.full_name,
      entry.shift_date,
      formatTime(entry.punch_in),
      entry.punch_out ? formatTime(entry.punch_out) : 'Active',
      formatDuration(entry.duration_minutes),
      entry.duration_minutes ? (entry.duration_minutes / 60).toFixed(2) : '0'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_tracking_${dateRange.start}_to_${dateRange.end}.csv`;
    a.click();
  };

  const byUser = groupEntriesByUser();

  return (
    <div className="time-tracking">
      <div className="time-tracking-header">
        <h1>Time Tracking</h1>
        <button className="export-btn" onClick={exportToCSV}>
          Export to CSV
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Employee:</label>
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Employees</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.username})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Start Date:</label>
          <input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>

        <div className="filter-group">
          <label>End Date:</label>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Employee Summary
        </button>
        <button 
          className={`tab-button ${activeTab === 'entries' ? 'active' : ''}`}
          onClick={() => setActiveTab('entries')}
        >
          Detailed Entries
        </button>
        <button 
          className={`tab-button ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Daily Summary
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading">Loading time entries...</div>
        ) : entries.length === 0 ? (
          <div className="no-data">No time entries found for the selected period.</div>
        ) : (
          <>
            {activeTab === 'summary' && (
              <div className="summary-cards">
                {Object.entries(byUser).map(([userName, userEntries]) => {
                  const totalHours = calculateTotalHours(userEntries);
                  const activeShift = userEntries.find(e => !e.punch_out);
                  
                  return (
                    <div key={userName} className="employee-card">
                      <div className="employee-name">{userName}</div>
                      <div className="employee-stats">
                        <div className="stat">
                          <span className="stat-label">Total Hours:</span>
                          <span className="stat-value">{totalHours.toFixed(2)}h</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Shifts:</span>
                          <span className="stat-value">{userEntries.length}</span>
                        </div>
                        {activeShift && (
                          <div className="active-indicator">
                            Currently Clocked In
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'entries' && (
              <div className="entries-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Punch In</th>
                      <th>Punch Out</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.shift_date)}</td>
                        <td>{entry.full_name}</td>
                        <td>{formatTime(entry.punch_in)}</td>
                        <td>{entry.punch_out ? formatTime(entry.punch_out) : '-'}</td>
                        <td>{formatDuration(entry.duration_minutes)}</td>
                        <td>
                          {entry.punch_out ? (
                            <span className="status-complete">Complete</span>
                          ) : (
                            <span className="status-active">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'daily' && (
              <div className="daily-summary-container">
                {Object.entries(groupEntriesByDate(entries))
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([date, dateEntries]) => {
                    const totalMinutes = dateEntries.reduce((sum, entry) => 
                      sum + (entry.duration_minutes || 0), 0
                    );
                    const totalHours = totalMinutes / 60;
                    
                    return (
                      <div key={date} className="daily-summary">
                        <div className="summary-date">{formatDate(date)}</div>
                        <div className="summary-details">
                          <span>{dateEntries.length} shifts</span>
                          <span className="separator">•</span>
                          <span>{totalHours.toFixed(2)} total hours</span>
                          <span className="separator">•</span>
                          <span>{dateEntries.filter(e => !e.punch_out).length} active</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TimeTracking;