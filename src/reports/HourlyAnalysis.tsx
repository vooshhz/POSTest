import { useState, useEffect } from "react";
import "./HourlyAnalysis.css";

export default function HourlyAnalysis() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  useEffect(() => {
    fetchHourlyData();
  }, [selectedDate]);

  const fetchHourlyData = async () => {
    try {
      const result = await window.api.getDailySales(selectedDate);
      if (result.success && result.data) {
        setHourlyData(result.data.hourlyBreakdown || []);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const maxAmount = Math.max(...hourlyData.map(h => h.amount), 1);

  return (
    <div className="hourly-analysis-container">
      <div className="hourly-header">
        <h3>Hourly Sales Analysis</h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="date-picker"
        />
      </div>

      <div className="hourly-chart">
        <h4>Sales by Hour</h4>
        <div className="chart-container">
          {Array.from({ length: 24 }, (_, hour) => {
            const data = hourlyData.find(h => h.hour === hour);
            const amount = data?.amount || 0;
            const sales = data?.sales || 0;
            const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
            
            return (
              <div key={hour} className="hour-column">
                <div className="bar-wrapper">
                  <div 
                    className="hour-bar"
                    style={{ height: `${height}%` }}
                    title={`${formatCurrency(amount)} - ${sales} sales`}
                  >
                    {amount > 0 && (
                      <span className="bar-value">{sales}</span>
                    )}
                  </div>
                </div>
                <span className="hour-label">{hour}:00</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="peak-hours">
        <h4>Peak Hours</h4>
        <div className="peak-list">
          {hourlyData
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map((hour, index) => (
              <div key={index} className="peak-item">
                <span className="peak-rank">#{index + 1}</span>
                <span className="peak-time">{hour.hour}:00 - {hour.hour + 1}:00</span>
                <span className="peak-amount">{formatCurrency(hour.amount)}</span>
                <span className="peak-sales">{hour.sales} sales</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}