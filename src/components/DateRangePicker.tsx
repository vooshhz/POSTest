import { useState, useRef, useEffect } from 'react';
import './DateRangePicker.css';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  min?: string;
  max?: string;
  className?: string;
  presetRanges?: boolean;
}

export default function DateRangePicker({ 
  startDate, 
  endDate, 
  onChange, 
  min, 
  max, 
  className,
  presetRanges = true 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [selectingEndDate, setSelectingEndDate] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = startDate ? new Date(startDate) : new Date();
    return { month: date.getMonth(), year: date.getFullYear() };
  });
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('left');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customDateRef = useRef<HTMLInputElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Adjust dropdown position to stay within viewport
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const dropdown = dropdownRef.current;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();
      
      // Check if dropdown would overflow the right edge of viewport
      if (rect.left + dropdownRect.width > window.innerWidth - 20) {
        setDropdownPosition('right');
      } else {
        setDropdownPosition('left');
      }
      
      // Also check vertical space and adjust if needed
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < dropdownRect.height && spaceAbove > dropdownRect.height) {
        dropdown.style.bottom = `${rect.height + 8}px`;
        dropdown.style.top = 'auto';
      } else {
        dropdown.style.top = `${rect.height + 8}px`;
        dropdown.style.bottom = 'auto';
      }
    }
  }, [isOpen]);

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
    const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (startStr: string, endStr: string): string => {
    if (!startStr && !endStr) return 'Select date range';
    
    const formatSingle = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    };
    
    const start = formatSingle(startStr);
    const end = formatSingle(endStr);
    
    if (!end || start === end) return start;
    return `${start} - ${end}`;
  };

  const handleDayClick = (date: Date) => {
    const dateStr = formatDate(date);
    
    if (!selectingEndDate) {
      // First click - set start date
      setTempStartDate(dateStr);
      setTempEndDate('');
      setSelectingEndDate(true);
    } else {
      // Second click - set end date
      if (dateStr < tempStartDate) {
        // If end date is before start date, swap them
        setTempEndDate(tempStartDate);
        setTempStartDate(dateStr);
      } else {
        setTempEndDate(dateStr);
      }
      setSelectingEndDate(false);
    }
  };

  const handleConfirm = () => {
    onChange(tempStartDate, tempEndDate || tempStartDate);
    setIsOpen(false);
    setSelectingEndDate(false);
  };

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsOpen(false);
    setSelectingEndDate(false);
  };

  const handleMonthChange = (direction: number) => {
    setViewMonth(prev => {
      const newDate = new Date(prev.year, prev.month + direction, 1);
      return { month: newDate.getMonth(), year: newDate.getFullYear() };
    });
  };

  const handlePresetRange = (preset: string) => {
    const today = new Date();
    const todayStr = formatDate(today);
    let start = '';
    let end = todayStr;

    switch (preset) {
      case 'today':
        start = todayStr;
        end = todayStr;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = formatDate(yesterday);
        end = formatDate(yesterday);
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        start = formatDate(last7);
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        start = formatDate(last30);
        break;
      case 'thisMonth':
        start = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        start = formatDate(lastMonth);
        end = formatDate(lastMonthEnd);
        break;
      case 'thisYear':
        start = formatDate(new Date(today.getFullYear(), 0, 1));
        break;
    }

    setTempStartDate(start);
    setTempEndDate(end);
    onChange(start, end);
    setIsOpen(false);
  };

  const startEditingDate = () => {
    setIsEditingDate(true);
    const dateRange = tempStartDate && tempEndDate 
      ? `${tempStartDate} to ${tempEndDate}`
      : tempStartDate || formatDate(new Date());
    setCustomDateInput(dateRange);
    setTimeout(() => {
      customDateRef.current?.focus();
      customDateRef.current?.select();
    }, 50);
  };

  const handleCustomDateSubmit = () => {
    // Parse the input - expecting format like "2024-01-01 to 2024-01-31" or just "2024-01-01"
    const parts = customDateInput.split(' to ');
    const start = parts[0]?.trim();
    const end = parts[1]?.trim() || start;
    
    if (start) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);
        
        // Check bounds
        if ((!min || startStr >= min) && (!max || endStr <= max)) {
          setTempStartDate(startStr);
          setTempEndDate(endStr);
          setViewMonth({ month: startDate.getMonth(), year: startDate.getFullYear() });
          setIsEditingDate(false);
        }
      }
    }
  };

  const handleCustomDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomDateSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingDate(false);
      setCustomDateInput('');
    }
  };

  const days = generateCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = formatDate(date);
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const isDateInRange = (date: Date): boolean => {
    const dateStr = formatDate(date);
    if (!tempStartDate) return false;
    if (!tempEndDate) return dateStr === tempStartDate;
    return dateStr >= tempStartDate && dateStr <= tempEndDate;
  };

  const isDateRangeStart = (date: Date): boolean => {
    const dateStr = formatDate(date);
    return dateStr === tempStartDate;
  };

  const isDateRangeEnd = (date: Date): boolean => {
    const dateStr = formatDate(date);
    return dateStr === tempEndDate;
  };

  return (
    <div className={`date-range-picker-container ${className || ''}`} ref={containerRef}>
      <div 
        className="date-range-picker-input"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTempStartDate(startDate);
            setTempEndDate(endDate);
            setSelectingEndDate(false);
            if (startDate) {
              const date = new Date(startDate);
              setViewMonth({ month: date.getMonth(), year: date.getFullYear() });
            }
          }
        }}
        tabIndex={0}
      >
        <span className="date-range-display">{formatDisplayDate(startDate, endDate)}</span>
        <svg className="calendar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>

      {isOpen && (
        <div 
          className={`date-range-picker-dropdown ${dropdownPosition === 'right' ? 'align-right' : ''}`}
          ref={dropdownRef}
        >
          {presetRanges && (
            <div className="preset-ranges">
              <button onClick={() => handlePresetRange('today')}>Today</button>
              <button onClick={() => handlePresetRange('yesterday')}>Yesterday</button>
              <button onClick={() => handlePresetRange('last7')}>Last 7 Days</button>
              <button onClick={() => handlePresetRange('last30')}>Last 30 Days</button>
              <button onClick={() => handlePresetRange('thisMonth')}>This Month</button>
              <button onClick={() => handlePresetRange('lastMonth')}>Last Month</button>
              <button onClick={() => handlePresetRange('thisYear')}>This Year</button>
            </div>
          )}

          <div className="date-range-status">
            {selectingEndDate 
              ? 'Select end date...' 
              : tempStartDate 
                ? `${formatDisplayDate(tempStartDate, tempEndDate)}`
                : 'Select start date...'}
          </div>

          <div className="date-picker-header">
            <button 
              className="month-nav-btn"
              onClick={() => handleMonthChange(-1)}
              type="button"
            >
              ‹
            </button>
            {isEditingDate ? (
              <div className="custom-date-input-wrapper">
                <input
                  ref={customDateRef}
                  type="text"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  onKeyDown={handleCustomDateKeyDown}
                  onBlur={handleCustomDateSubmit}
                  placeholder="YYYY-MM-DD to YYYY-MM-DD"
                  className="custom-date-range-input"
                />
              </div>
            ) : (
              <div 
                className="month-year-display clickable"
                onClick={startEditingDate}
                title="Click to enter custom date range"
              >
                {monthNames[viewMonth.month]} {viewMonth.year}
              </div>
            )}
            <button 
              className="month-nav-btn"
              onClick={() => handleMonthChange(1)}
              type="button"
            >
              ›
            </button>
          </div>

          <div className="date-picker-days-header">
            {dayNames.map(day => (
              <div key={day} className="day-name">{day}</div>
            ))}
          </div>

          <div className="date-picker-days">
            {days.map((date, index) => {
              const dateStr = formatDate(date);
              const isDisabled = isDateDisabled(date);
              const isInRange = isDateInRange(date);
              const isStart = isDateRangeStart(date);
              const isEnd = isDateRangeEnd(date);
              const isToday = dateStr === formatDate(new Date());
              const isOtherMonth = date.getMonth() !== viewMonth.month;

              return (
                <button
                  key={index}
                  className={`day-cell 
                    ${isInRange ? 'in-range' : ''} 
                    ${isStart ? 'range-start' : ''} 
                    ${isEnd ? 'range-end' : ''}
                    ${isToday ? 'today' : ''} 
                    ${isOtherMonth ? 'other-month' : ''} 
                    ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => !isDisabled && handleDayClick(date)}
                  disabled={isDisabled}
                  type="button"
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button 
              className="date-picker-btn cancel-btn"
              onClick={handleCancel}
              type="button"
            >
              <span>✕</span> Cancel
            </button>
            <button 
              className="date-picker-btn confirm-btn"
              onClick={handleConfirm}
              type="button"
              disabled={!tempStartDate}
            >
              <span>✓</span> Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}