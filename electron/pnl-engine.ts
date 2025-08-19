import Database from "better-sqlite3";

export interface PnLPeriod {
  startDate: string;
  endDate: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: {
    labor: number;
    rent: number;
    utilities: number;
    other: number;
    total: number;
  };
  netIncome: number;
  netMargin: number;
  transactions: number;
  unitsS: number;
  averageTransactionValue: number;
}

export interface PnLBreakdown {
  daily: PnLPeriod[];
  weekly: PnLPeriod[];
  monthly: PnLPeriod[];
  quarterly: PnLPeriod[];
  yearly: PnLPeriod[];
  custom?: PnLPeriod;
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  unitsSold: number;
  transactions: number;
}

export interface ProductPerformance {
  upc: string;
  description: string;
  category: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  unitsSold: number;
  averageSellingPrice: number;
  inventoryTurnover: number;
}

export interface ExpenseEntry {
  id?: number;
  category: 'labor' | 'rent' | 'utilities' | 'marketing' | 'supplies' | 'insurance' | 'other';
  subcategory?: string;
  amount: number;
  description: string;
  date: string;
  recurring: boolean;
  created_at?: string;
  created_by?: string;
}

export class PnLEngine {
  private inventoryDb: Database.Database;
  private productsDb: Database.Database;
  
  constructor(inventoryDb: Database.Database, productsDb: Database.Database) {
    this.inventoryDb = inventoryDb;
    this.productsDb = productsDb;
    this.initializeExpenseTables();
  }
  
  private initializeExpenseTables() {
    this.inventoryDb.exec(`
      CREATE TABLE IF NOT EXISTS operating_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK(category IN ('labor', 'rent', 'utilities', 'marketing', 'supplies', 'insurance', 'other')),
        subcategory TEXT,
        amount REAL NOT NULL,
        description TEXT,
        expense_date DATE NOT NULL,
        recurring INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON operating_expenses(expense_date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON operating_expenses(category);
      
      CREATE TABLE IF NOT EXISTS expense_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        monthly_budget REAL NOT NULL,
        yearly_budget REAL NOT NULL,
        effective_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  
  calculatePnL(startDate: string, endDate: string): PnLPeriod {
    const revenue = this.calculateRevenue(startDate, endDate);
    const cogs = this.calculateCOGS(startDate, endDate);
    const expenses = this.calculateOperatingExpenses(startDate, endDate);
    const transactionData = this.getTransactionMetrics(startDate, endDate);
    
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netIncome = grossProfit - expenses.total;
    const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
    
    return {
      startDate,
      endDate,
      revenue,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMargin,
      operatingExpenses: expenses,
      netIncome,
      netMargin,
      transactions: transactionData.count,
      unitsSold: transactionData.units,
      averageTransactionValue: transactionData.count > 0 ? revenue / transactionData.count : 0
    };
  }
  
  private calculateRevenue(startDate: string, endDate: string): number {
    const result = this.inventoryDb.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue
      FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).get(startDate, endDate) as { revenue: number };
    
    return result.revenue;
  }
  
  private calculateCOGS(startDate: string, endDate: string): number {
    const transactions = this.inventoryDb.prepare(`
      SELECT items FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).all(startDate, endDate) as { items: string }[];
    
    let totalCOGS = 0;
    
    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          const inventoryItem = this.inventoryDb.prepare(`
            SELECT cost FROM inventory WHERE upc = ?
          `).get(item.upc) as { cost: number } | undefined;
          
          if (inventoryItem) {
            totalCOGS += inventoryItem.cost * item.quantity;
          }
        }
      } catch (error) {
        console.error('Error parsing transaction items:', error);
      }
    }
    
    return totalCOGS;
  }
  
  private calculateOperatingExpenses(startDate: string, endDate: string) {
    const expenses = this.inventoryDb.prepare(`
      SELECT 
        category,
        COALESCE(SUM(amount), 0) as total
      FROM operating_expenses
      WHERE DATE(expense_date) >= DATE(?)
      AND DATE(expense_date) <= DATE(?)
      GROUP BY category
    `).all(startDate, endDate) as { category: string; total: number }[];
    
    const result = {
      labor: 0,
      rent: 0,
      utilities: 0,
      other: 0,
      total: 0
    };
    
    for (const expense of expenses) {
      const category = expense.category as keyof typeof result;
      if (category in result && category !== 'total') {
        result[category] = expense.total;
      }
      result.total += expense.total;
    }
    
    return result;
  }
  
  private getTransactionMetrics(startDate: string, endDate: string) {
    const countResult = this.inventoryDb.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).get(startDate, endDate) as { count: number };
    
    const transactions = this.inventoryDb.prepare(`
      SELECT items FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).all(startDate, endDate) as { items: string }[];
    
    let totalUnits = 0;
    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          totalUnits += item.quantity || 1;
        }
      } catch (error) {
        console.error('Error parsing transaction items:', error);
      }
    }
    
    return {
      count: countResult.count,
      units: totalUnits
    };
  }
  
  getCategoryPerformance(startDate: string, endDate: string): CategoryPerformance[] {
    const transactions = this.inventoryDb.prepare(`
      SELECT items, subtotal FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).all(startDate, endDate) as { items: string; subtotal: number }[];
    
    const categoryMap = new Map<string, CategoryPerformance>();
    
    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          const product = this.productsDb.prepare(`
            SELECT "Category Name" as category FROM products WHERE UPC = ?
          `).get(item.upc) as { category: string } | undefined;
          
          if (product) {
            const category = product.category || 'Uncategorized';
            const existing = categoryMap.get(category) || {
              category,
              revenue: 0,
              costOfGoodsSold: 0,
              grossProfit: 0,
              grossMargin: 0,
              unitsSold: 0,
              transactions: 0
            };
            
            const inventoryItem = this.inventoryDb.prepare(`
              SELECT cost FROM inventory WHERE upc = ?
            `).get(item.upc) as { cost: number } | undefined;
            
            const itemRevenue = item.price * item.quantity;
            const itemCost = (inventoryItem?.cost || 0) * item.quantity;
            
            existing.revenue += itemRevenue;
            existing.costOfGoodsSold += itemCost;
            existing.unitsSold += item.quantity;
            existing.transactions += 1;
            
            categoryMap.set(category, existing);
          }
        }
      } catch (error) {
        console.error('Error parsing transaction items:', error);
      }
    }
    
    return Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      grossProfit: cat.revenue - cat.costOfGoodsSold,
      grossMargin: cat.revenue > 0 ? ((cat.revenue - cat.costOfGoodsSold) / cat.revenue) * 100 : 0
    }));
  }
  
  getProductPerformance(startDate: string, endDate: string, limit: number = 50): ProductPerformance[] {
    const transactions = this.inventoryDb.prepare(`
      SELECT items FROM transactions
      WHERE DATE(created_at) >= DATE(?)
      AND DATE(created_at) <= DATE(?)
    `).all(startDate, endDate) as { items: string }[];
    
    const productMap = new Map<string, ProductPerformance>();
    
    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          const existing = productMap.get(item.upc) || {
            upc: item.upc,
            description: item.description || 'Unknown Product',
            category: '',
            revenue: 0,
            costOfGoodsSold: 0,
            grossProfit: 0,
            grossMargin: 0,
            unitsSold: 0,
            averageSellingPrice: 0,
            inventoryTurnover: 0
          };
          
          const product = this.productsDb.prepare(`
            SELECT "Category Name" as category FROM products WHERE UPC = ?
          `).get(item.upc) as { category: string } | undefined;
          
          if (product) {
            existing.category = product.category;
          }
          
          const inventoryItem = this.inventoryDb.prepare(`
            SELECT cost, quantity FROM inventory WHERE upc = ?
          `).get(item.upc) as { cost: number; quantity: number } | undefined;
          
          const itemRevenue = item.price * item.quantity;
          const itemCost = (inventoryItem?.cost || 0) * item.quantity;
          
          existing.revenue += itemRevenue;
          existing.costOfGoodsSold += itemCost;
          existing.unitsSold += item.quantity;
          
          productMap.set(item.upc, existing);
        }
      } catch (error) {
        console.error('Error parsing transaction items:', error);
      }
    }
    
    const products = Array.from(productMap.values()).map(product => {
      const avgInventory = this.inventoryDb.prepare(`
        SELECT AVG(quantity) as avg_qty FROM inventory WHERE upc = ?
      `).get(product.upc) as { avg_qty: number } | undefined;
      
      return {
        ...product,
        grossProfit: product.revenue - product.costOfGoodsSold,
        grossMargin: product.revenue > 0 ? ((product.revenue - product.costOfGoodsSold) / product.revenue) * 100 : 0,
        averageSellingPrice: product.unitsSold > 0 ? product.revenue / product.unitsSold : 0,
        inventoryTurnover: avgInventory?.avg_qty > 0 ? product.unitsSold / avgInventory.avg_qty : 0
      };
    });
    
    return products
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }
  
  generatePnLBreakdown(startDate: string, endDate: string): PnLBreakdown {
    const dailyPeriods = this.generateDailyPeriods(startDate, endDate);
    const weeklyPeriods = this.generateWeeklyPeriods(startDate, endDate);
    const monthlyPeriods = this.generateMonthlyPeriods(startDate, endDate);
    const quarterlyPeriods = this.generateQuarterlyPeriods(startDate, endDate);
    const yearlyPeriods = this.generateYearlyPeriods(startDate, endDate);
    
    return {
      daily: dailyPeriods.map(period => this.calculatePnL(period.start, period.end)),
      weekly: weeklyPeriods.map(period => this.calculatePnL(period.start, period.end)),
      monthly: monthlyPeriods.map(period => this.calculatePnL(period.start, period.end)),
      quarterly: quarterlyPeriods.map(period => this.calculatePnL(period.start, period.end)),
      yearly: yearlyPeriods.map(period => this.calculatePnL(period.start, period.end)),
      custom: this.calculatePnL(startDate, endDate)
    };
  }
  
  private generateDailyPeriods(startDate: string, endDate: string) {
    const periods = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      periods.push({
        start: current.toISOString().split('T')[0],
        end: current.toISOString().split('T')[0]
      });
      current.setDate(current.getDate() + 1);
    }
    
    return periods;
  }
  
  private generateWeeklyPeriods(startDate: string, endDate: string) {
    const periods = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    current.setDate(current.getDate() - current.getDay());
    
    while (current <= end) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      if (weekEnd > end) {
        weekEnd.setTime(end.getTime());
      }
      
      periods.push({
        start: current.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0]
      });
      
      current.setDate(current.getDate() + 7);
    }
    
    return periods;
  }
  
  private generateMonthlyPeriods(startDate: string, endDate: string) {
    const periods = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    current.setDate(1);
    
    while (current <= end) {
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      if (monthEnd > end) {
        monthEnd.setTime(end.getTime());
      }
      
      periods.push({
        start: current.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0]
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return periods;
  }
  
  private generateQuarterlyPeriods(startDate: string, endDate: string) {
    const periods = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    const quarterMonth = Math.floor(current.getMonth() / 3) * 3;
    current.setMonth(quarterMonth, 1);
    
    while (current <= end) {
      const quarterEnd = new Date(current.getFullYear(), current.getMonth() + 3, 0);
      
      if (quarterEnd > end) {
        quarterEnd.setTime(end.getTime());
      }
      
      periods.push({
        start: current.toISOString().split('T')[0],
        end: quarterEnd.toISOString().split('T')[0]
      });
      
      current.setMonth(current.getMonth() + 3);
    }
    
    return periods;
  }
  
  private generateYearlyPeriods(startDate: string, endDate: string) {
    const periods = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    current.setMonth(0, 1);
    
    while (current <= end) {
      const yearEnd = new Date(current.getFullYear(), 11, 31);
      
      if (yearEnd > end) {
        yearEnd.setTime(end.getTime());
      }
      
      periods.push({
        start: current.toISOString().split('T')[0],
        end: yearEnd.toISOString().split('T')[0]
      });
      
      current.setFullYear(current.getFullYear() + 1);
    }
    
    return periods;
  }
  
  addExpense(expense: ExpenseEntry): void {
    this.inventoryDb.prepare(`
      INSERT INTO operating_expenses (category, subcategory, amount, description, expense_date, recurring, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      expense.category,
      expense.subcategory || null,
      expense.amount,
      expense.description,
      expense.date,
      expense.recurring ? 1 : 0,
      expense.created_by || 'system'
    );
  }
  
  getExpenses(startDate: string, endDate: string): ExpenseEntry[] {
    return this.inventoryDb.prepare(`
      SELECT * FROM operating_expenses
      WHERE DATE(expense_date) >= DATE(?)
      AND DATE(expense_date) <= DATE(?)
      ORDER BY expense_date DESC
    `).all(startDate, endDate) as ExpenseEntry[];
  }
  
  comparePerformance(currentPeriod: PnLPeriod, previousPeriod: PnLPeriod) {
    return {
      revenueChange: {
        amount: currentPeriod.revenue - previousPeriod.revenue,
        percentage: previousPeriod.revenue > 0 
          ? ((currentPeriod.revenue - previousPeriod.revenue) / previousPeriod.revenue) * 100 
          : 0
      },
      grossProfitChange: {
        amount: currentPeriod.grossProfit - previousPeriod.grossProfit,
        percentage: previousPeriod.grossProfit > 0
          ? ((currentPeriod.grossProfit - previousPeriod.grossProfit) / previousPeriod.grossProfit) * 100
          : 0
      },
      netIncomeChange: {
        amount: currentPeriod.netIncome - previousPeriod.netIncome,
        percentage: previousPeriod.netIncome !== 0
          ? ((currentPeriod.netIncome - previousPeriod.netIncome) / Math.abs(previousPeriod.netIncome)) * 100
          : 0
      },
      marginChange: {
        gross: currentPeriod.grossMargin - previousPeriod.grossMargin,
        net: currentPeriod.netMargin - previousPeriod.netMargin
      }
    };
  }
}