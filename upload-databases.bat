@echo off
echo Uploading databases to Fly.io...

REM Check if databases exist locally
if not exist "LiquorDatabase.db" (
    echo Error: LiquorDatabase.db not found!
    exit /b 1
)

if not exist "LiquorInventory.db" (
    echo Error: LiquorInventory.db not found!
    exit /b 1
)

if not exist "StoreInformation.db" (
    echo Error: StoreInformation.db not found!
    exit /b 1
)

echo All database files found. Starting upload...

REM Create data directory on Fly.io
echo Creating /data directory...
flyctl ssh console -C "mkdir -p /data" -a your-pos-app

REM Upload databases using scp through fly proxy
echo Uploading databases...
flyctl proxy 10022:22 -a your-pos-app &
timeout /t 3 >nul

REM Note: We'll use a different approach for Windows
echo Please run these commands manually in a new terminal:
echo 1. flyctl ssh console -a your-pos-app
echo 2. Once connected, run: exit
echo 3. Then run: flyctl ssh sftp shell -a your-pos-app
echo 4. In the SFTP shell, run:
echo    put LiquorDatabase.db /data/LiquorDatabase.db
echo    put LiquorInventory.db /data/LiquorInventory.db  
echo    put StoreInformation.db /data/StoreInformation.db
echo    exit

pause