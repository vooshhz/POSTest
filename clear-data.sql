-- Clear all inventory and transaction data
DELETE FROM inventory;
DELETE FROM transactions;
DELETE FROM inventory_adjustments;

-- Reset the auto-increment counters
DELETE FROM sqlite_sequence WHERE name IN ('inventory', 'transactions', 'inventory_adjustments');

SELECT 'Data cleared successfully' as result;