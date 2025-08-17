import { useState, useRef, useEffect } from 'react';
import './DatePicker.css';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  className?: string;
}

export default function DatePicker({ value, onChange, min, max, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = value ? new Date(value) : new Date();
    return { month: date.getMonth(), year: date.getFullYear() };
  });
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('left');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
        // Position dropdown to align with right edge of input
        setDropdownPosition('right');
      } else {
        setDropdownPosition('left');
      }
      
      // Also check vertical space and adjust if needed
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < dropdownRect.height && spaceAbove > dropdownRect.height) {
        // Position above if not enough space below
        dropdown.style.bottom = `${rect.height + 8}px`;
        dropdown.style.top = 'auto';
      } else {
        // Default position below
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

  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return 'Select date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleDayClick = (date: Date) => {
    const dateStr = formatDate(date);
    setTempDate(dateStr);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempDate(value);
    setIsOpen(false);
  };

  const handleMonthChange = (direction: number) => {
    setViewMonth(prev => {
      const newDate = new Date(prev.year, prev.month + direction, 1);
      return { month: newDate.getMonth(), year: newDate.getFullYear() };
    });
  };

  const startEditingDate = () => {
    setIsEditingDate(true);
    // Initialize with current temp date or today's date
    const dateToEdit = tempDate || formatDate(new Date());
    setCustomDateInput(dateToEdit);
    setTimeout(() => {
      customDateRef.current?.focus();
      customDateRef.current?.select();
    }, 50);
  };

  const handleCustomDateSubmit = () => {
    // Validate the date
    const date = new Date(customDateInput);
    if (!isNaN(date.getTime())) {
      const dateStr = formatDate(date);
      
      // Check if within min/max bounds
      if ((!min || dateStr >= min) && (!max || dateStr <= max)) {
        setTempDate(dateStr);
        setViewMonth({ month: date.getMonth(), year: date.getFullYear() });
        setIsEditingDate(false);
      } else {
        // Invalid date - shake animation or show error
        if (customDateRef.current) {
          customDateRef.current.style.animation = 'shake 0.3s';
          setTimeout(() => {
            if (customDateRef.current) {
              customDateRef.current.style.animation = '';
            }
          }, 300);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (isOpen) {
        e.preventDefault();
        // Keep calendar open and adjust date
        const current = tempDate ? new Date(tempDate) : new Date();
        const adjustment = e.key === 'ArrowUp' ? -7 : 7; // Move by week
        current.setDate(current.getDate() + adjustment);
        const newDateStr = formatDate(current);
        setTempDate(newDateStr);
        
        // Update view month if needed
        if (current.getMonth() !== viewMonth.month || current.getFullYear() !== viewMonth.year) {
          setViewMonth({ month: current.getMonth(), year: current.getFullYear() });
        }
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (isOpen) {
        e.preventDefault();
        // Keep calendar open and adjust date
        const current = tempDate ? new Date(tempDate) : new Date();
        const adjustment = e.key === 'ArrowLeft' ? -1 : 1; // Move by day
        current.setDate(current.getDate() + adjustment);
        const newDateStr = formatDate(current);
        setTempDate(newDateStr);
        
        // Update view month if needed
        if (current.getMonth() !== viewMonth.month || current.getFullYear() !== viewMonth.year) {
          setViewMonth({ month: current.getMonth(), year: current.getFullYear() });
        }
      }
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

  return (
    <div className={`date-picker-container ${className || ''}`} ref={containerRef}>
      <div 
        className="date-picker-input"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTempDate(value);
            if (value) {
              const date = new Date(value);
              setViewMonth({ month: date.getMonth(), year: date.getFullYear() });
            }
          }
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      >
        <span className="date-display">{formatDisplayDate(value)}</span>
        <svg className="calendar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>

      {isOpen && (
        <div 
          className={`date-picker-dropdown ${dropdownPosition === 'right' ? 'align-right' : ''}`}
          ref={dropdownRef}
        >
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
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  onKeyDown={handleCustomDateKeyDown}
                  onBlur={handleCustomDateSubmit}
                  min={min}
                  max={max}
                  className="custom-date-input"
                />
              </div>
            ) : (
              <div 
                className="month-year-display clickable"
                onClick={startEditingDate}
                title="Click to enter custom date"
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
              const isSelected = dateStr === tempDate;
              const isToday = dateStr === formatDate(new Date());
              const isOtherMonth = date.getMonth() !== viewMonth.month;

              return (
                <button
                  key={index}
                  className={`day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isOtherMonth ? 'other-month' : ''} ${isDisabled ? 'disabled' : ''}`}
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
            >
              <span>✓</span> Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}