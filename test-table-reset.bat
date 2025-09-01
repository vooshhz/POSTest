@echo off
echo === Testing Table Drop and Recreate ===
echo.
sqlite3 StoreInformation.db "SELECT COUNT(*) as 'Users before:' FROM users;"
sqlite3 StoreInformation.db "SELECT COUNT(*) as 'Store info before:' FROM store_info;"
echo.
echo Dropping tables...
sqlite3 StoreInformation.db "DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS store_info; DROP TABLE IF EXISTS user_activity; DROP TABLE IF EXISTS time_clock;"
echo.
echo Recreating tables...
sqlite3 StoreInformation.db "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, pin TEXT, role TEXT NOT NULL, last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
sqlite3 StoreInformation.db "CREATE TABLE store_info (id INTEGER PRIMARY KEY AUTOINCREMENT, store_name TEXT NOT NULL, address_line1 TEXT NOT NULL, address_line2 TEXT, city TEXT NOT NULL, state TEXT NOT NULL, zip_code TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, tax_rate REAL NOT NULL, receipt_header TEXT, receipt_footer TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
echo.
sqlite3 StoreInformation.db "SELECT COUNT(*) as 'Users after:' FROM users;"
sqlite3 StoreInformation.db "SELECT COUNT(*) as 'Store info after:' FROM store_info;"
echo.
echo === Test Complete ===
pause