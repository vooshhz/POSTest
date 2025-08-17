import { useState } from "react";
import DailySales from "../DailySales";
import WeeklySummary from "./WeeklySummary";
import "./Sales.css";

type SalesPeriod = 'daily' | 'weekly' | 'monthly' | 'ytd';

export default function Sales() {
  const [activePeriod, setActivePeriod] = useState<SalesPeriod>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const periods: { id: SalesPeriod; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'ytd', label: 'Year to Date' }
  ];

  return (
    <div className="sales-reports-container">
      <div className="sales-header">
        <h3>Sales Reports</h3>
        <div className="sales-period-selector">
          {periods.map(period => (
            <button
              key={period.id}
              className={`period-btn ${activePeriod === period.id ? 'active' : ''}`}
              onClick={() => setActivePeriod(period.id)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sales-content">
        {activePeriod === 'daily' && (
          <DailySales />
        )}
        
        {activePeriod === 'weekly' && (
          <WeeklySummary periodType="week" />
        )}
        
        {activePeriod === 'monthly' && (
          <WeeklySummary periodType="month" />
        )}
        
        {activePeriod === 'ytd' && (
          <div className="ytd-sales">
            <div className="date-selector">
              <label>Year: </label>
              <input
                type="number"
                min="2020"
                max={new Date().getFullYear()}
                value={new Date(selectedDate).getFullYear()}
                onChange={(e) => {
                  const year = e.target.value;
                  setSelectedDate(`${year}-01-01`);
                }}
                className="year-input"
              />
            </div>
            
            <div className="ytd-content">
              <WeeklySummary periodType="ytd" customDate={selectedDate} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}