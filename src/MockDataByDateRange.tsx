import { useState, useEffect } from "react";
import "./MockDataByDateRange.css";

interface SKUPerformance {
  upc: string;
  description: string;
  performance_tier: 'high' | 'average' | 'low';
  daily_velocity: number;
  volume: string;
  cost: number;
  price: number;
}

interface GenerationStats {
  totalTransactions: number;
  totalItemsSold: number;
  totalRevenue: number;
  inventoryConsumed: { [key: string]: number };
  performanceDistribution: {
    high: number;
    average: number;
    low: number;
  };
}

export default function MockDataByDateRange() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [selectedSKUs, setSelectedSKUs] = useState<SKUPerformance[]>([]);
  const [error, setError] = useState("");

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const selectAndWeightSKUs = async () => {
    setProgressMessage("Selecting and weighting SKUs...");
    setProgress(10);
    
    try {
      // Get 100 random SKUs from the product database
      const result = await window.api.getRandomProducts(100);
      
      if (!result.success || !result.products) {
        throw new Error("Failed to fetch products");
      }

      // Assign performance tiers
      const weightedSKUs: SKUPerformance[] = result.products.map((product: {
        upc: string;
        description: string;
        volume: string;
        wac: number;
        retail: number;
        category: string;
        subcategory: string;
      }, index: number) => {
        let tier: 'high' | 'average' | 'low';
        let velocity: number;
        
        if (index < 20) {
          // Top 20% - high performers
          tier = 'high';
          velocity = Math.floor(Math.random() * 8) + 8; // 8-15 units/day
        } else if (index < 80) {
          // Middle 60% - average performers
          tier = 'average';
          velocity = Math.floor(Math.random() * 5) + 3; // 3-7 units/day
        } else {
          // Bottom 20% - low performers
          tier = 'low';
          velocity = Math.floor(Math.random() * 3) + 1; // 1-3 units/day
        }

        return {
          upc: product.upc,
          description: product.description || 'Unknown Product',
          performance_tier: tier,
          daily_velocity: velocity,
          volume: product.volume || '750ML',
          cost: product.wac || 10.00,
          price: product.retail || 15.00
        };
      });

      setSelectedSKUs(weightedSKUs);
      return weightedSKUs;
    } catch (err) {
      console.error("Error selecting SKUs:", err);
      throw err;
    }
  };

  const calculateInventoryRequirements = (skus: SKUPerformance[], startDate: string, endDate: string) => {
    setProgressMessage("Calculating inventory requirements...");
    setProgress(25);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const inventoryRequirements: { [upc: string]: number } = {};
    
    skus.forEach(sku => {
      let totalUnitsNeeded = 0;
      
      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const dayOfWeek = currentDate.getDay();
        
        let dailyMultiplier = 1.0;
        
        // Apply day-of-week multipliers
        if (dayOfWeek === 0) {
          // Sunday - slow day
          dailyMultiplier = 0.75;
        } else if (dayOfWeek >= 4) {
          // Thursday, Friday, Saturday - busy days
          dailyMultiplier = 1.25;
        }
        
        totalUnitsNeeded += Math.ceil(sku.daily_velocity * dailyMultiplier);
      }
      
      // Add 20% buffer to prevent stockouts
      inventoryRequirements[sku.upc] = Math.ceil(totalUnitsNeeded * 1.2);
    });
    
    return inventoryRequirements;
  };

  const generateDailyTransactions = async (
    skus: SKUPerformance[], 
    date: Date,
    remainingInventory: { [upc: string]: number }
  ) => {
    const dayOfWeek = date.getDay();
    
    const transactionsToday = Math.round(100 * (0.9 + Math.random() * 0.2)); // 90-110 transactions
    const transactions = [];
    
    for (let t = 0; t < transactionsToday; t++) {
      const itemCount = Math.floor(Math.random() * 15) + 1; // 1-15 items
      const items = [];
      
      for (let i = 0; i < itemCount; i++) {
        // Weighted random selection based on performance tier
        const rand = Math.random();
        let selectedSKU: SKUPerformance;
        
        if (rand < 0.5) {
          // 50% chance to pick from high performers
          const highPerformers = skus.filter(s => s.performance_tier === 'high');
          selectedSKU = highPerformers[Math.floor(Math.random() * highPerformers.length)];
        } else if (rand < 0.85) {
          // 35% chance to pick from average performers
          const avgPerformers = skus.filter(s => s.performance_tier === 'average');
          selectedSKU = avgPerformers[Math.floor(Math.random() * avgPerformers.length)];
        } else {
          // 15% chance to pick from low performers
          const lowPerformers = skus.filter(s => s.performance_tier === 'low');
          selectedSKU = lowPerformers[Math.floor(Math.random() * lowPerformers.length)];
        }
        
        // Check if item is in stock
        if (remainingInventory[selectedSKU.upc] > 0) {
          const quantity = Math.min(
            Math.floor(Math.random() * 3) + 1, // 1-3 units per line item
            remainingInventory[selectedSKU.upc]
          );
          
          if (quantity > 0) {
            items.push({
              upc: selectedSKU.upc,
              description: selectedSKU.description,
              quantity,
              price: selectedSKU.price,
              cost: selectedSKU.cost
            });
            
            remainingInventory[selectedSKU.upc] -= quantity;
          }
        }
      }
      
      if (items.length > 0) {
        // Generate transaction time (store hours 9 AM - 10 PM)
        const hour = Math.floor(Math.random() * 13) + 9;
        const minute = Math.floor(Math.random() * 60);
        const transactionTime = new Date(date);
        transactionTime.setHours(hour, minute, 0, 0);
        
        transactions.push({
          timestamp: transactionTime.toISOString(),
          items,
          total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          payment_method: Math.random() > 0.3 ? 'credit' : 'cash'
        });
      }
    }
    
    return transactions;
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      setError("Start date must be before end date");
      return;
    }
    
    setIsGenerating(true);
    setError("");
    setStats(null);
    setProgress(0);
    
    try {
      // Step 1: Select and weight SKUs
      const skus = await selectAndWeightSKUs();
      
      // Step 2: Calculate inventory requirements
      const inventoryReqs = calculateInventoryRequirements(skus, startDate, endDate);
      
      // Step 3: Clear existing mock data
      setProgressMessage("Clearing existing mock data...");
      setProgress(30);
      await window.api.clearMockData();
      
      // Step 4: Set up initial inventory
      setProgressMessage("Setting up initial inventory...");
      setProgress(40);
      
      for (const sku of skus) {
        await window.api.addToInventory({
          upc: sku.upc,
          quantity: inventoryReqs[sku.upc],
          cost: sku.cost,
          price: sku.price
        });
      }
      
      // Step 5: Generate daily transactions
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const remainingInventory = { ...inventoryReqs };
      let allTransactions = [];
      let totalRevenue = 0;
      let totalItems = 0;
      
      for (let day = 0; day < totalDays; day++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + day);
        
        setProgressMessage(`Generating transactions for ${currentDate.toLocaleDateString()}...`);
        setProgress(40 + (day / totalDays) * 50);
        
        const dayTransactions = await generateDailyTransactions(skus, currentDate, remainingInventory);
        
        // Save transactions to database
        for (const transaction of dayTransactions) {
          await window.api.saveMockTransaction(transaction);
          totalRevenue += transaction.total;
          totalItems += transaction.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
        }
        
        allTransactions = allTransactions.concat(dayTransactions);
      }
      
      // Step 6: Calculate final stats
      setProgressMessage("Calculating statistics...");
      setProgress(95);
      
      const inventoryConsumed: { [key: string]: number } = {};
      skus.forEach(sku => {
        inventoryConsumed[sku.upc] = inventoryReqs[sku.upc] - remainingInventory[sku.upc];
      });
      
      const finalStats: GenerationStats = {
        totalTransactions: allTransactions.length,
        totalItemsSold: totalItems,
        totalRevenue: totalRevenue,
        inventoryConsumed,
        performanceDistribution: {
          high: skus.filter(s => s.performance_tier === 'high').length,
          average: skus.filter(s => s.performance_tier === 'average').length,
          low: skus.filter(s => s.performance_tier === 'low').length
        }
      };
      
      setStats(finalStats);
      setProgress(100);
      setProgressMessage("Mock data generation complete!");
      
    } catch (err) {
      console.error("Error generating mock data:", err);
      setError(`Failed to generate mock data: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mock-data-container">
      <div className="mock-data-header">
        <h3>Mock Data By Date Range</h3>
        <p>Generate realistic sales data with inventory-aware transactions</p>
      </div>
      
      <div className="date-range-section">
        <div className="date-input-group">
          <label htmlFor="start-date">Start Date:</label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isGenerating}
          />
        </div>
        
        <div className="date-input-group">
          <label htmlFor="end-date">End Date:</label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isGenerating}
          />
        </div>
        
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={isGenerating || !startDate || !endDate}
        >
          {isGenerating ? "Generating..." : "Generate Mock Data"}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {isGenerating && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="progress-message">{progressMessage}</p>
        </div>
      )}
      
      {stats && (
        <div className="stats-section">
          <h4>Generation Summary</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Transactions:</span>
              <span className="stat-value">{stats.totalTransactions.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Items Sold:</span>
              <span className="stat-value">{stats.totalItemsSold.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Revenue:</span>
              <span className="stat-value">${stats.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">SKU Distribution:</span>
              <span className="stat-value">
                High: {stats.performanceDistribution.high} | 
                Avg: {stats.performanceDistribution.average} | 
                Low: {stats.performanceDistribution.low}
              </span>
            </div>
          </div>
          
          {selectedSKUs.length > 0 && (
            <div className="sku-performance-preview">
              <h5>Top 10 SKUs by Velocity</h5>
              <div className="sku-list">
                {selectedSKUs
                  .sort((a, b) => b.daily_velocity - a.daily_velocity)
                  .slice(0, 10)
                  .map(sku => (
                    <div key={sku.upc} className="sku-item">
                      <span className={`performance-badge ${sku.performance_tier}`}>
                        {sku.performance_tier}
                      </span>
                      <span className="sku-desc">{sku.description}</span>
                      <span className="sku-velocity">{sku.daily_velocity} units/day</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}