@echo off
echo === Complete Factory Reset Test ===
echo.

echo Before reset:
sqlite3 StoreInformation.db "SELECT 'Users: ' || COUNT(*) FROM users;"
sqlite3 StoreInformation.db "SELECT 'Store info: ' || COUNT(*) FROM store_info;"

echo.
echo Simulating factory reset...

REM Drop all tables
sqlite3 StoreInformation.db "DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS store_info; DROP TABLE IF EXISTS user_activity; DROP TABLE IF EXISTS time_clock;"
sqlite3 LiquorInventory.db "DROP TABLE IF EXISTS inventory; DROP TABLE IF EXISTS transactions; DROP TABLE IF EXISTS inventory_adjustments; DROP TABLE IF EXISTS till_settings; DROP TABLE IF EXISTS daily_till; DROP TABLE IF EXISTS payouts; DROP TABLE IF EXISTS employee_time_clock;" 2>nul

REM Create marker file
echo factory-reset-performed > .factory-reset

echo.
echo After reset:
sqlite3 StoreInformation.db ".tables"
if "%ERRORLEVEL%"=="0" (
    echo Tables still exist - FAILED
) else (
    echo No tables - SUCCESS
)

echo.
echo Marker file created: .factory-reset
echo.
echo === Test Complete ===
echo When app starts next, it will show initial setup.
pause