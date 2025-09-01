@echo off
echo === Database Delete Test ===
echo.
echo Current databases:
if exist LiquorInventory.db (
    echo LiquorInventory.db EXISTS
) else (
    echo LiquorInventory.db NOT FOUND
)
if exist StoreInformation.db (
    echo StoreInformation.db EXISTS
) else (
    echo StoreInformation.db NOT FOUND
)
echo.
echo Deleting databases...
del /F /Q LiquorInventory.db 2>nul
del /F /Q StoreInformation.db 2>nul
del /F /Q LiquorInventory.db-journal 2>nul
del /F /Q StoreInformation.db-journal 2>nul
del /F /Q LiquorInventory.db-wal 2>nul
del /F /Q StoreInformation.db-wal 2>nul
del /F /Q LiquorInventory.db-shm 2>nul
del /F /Q StoreInformation.db-shm 2>nul
echo.
echo After deletion:
if exist LiquorInventory.db (
    echo LiquorInventory.db STILL EXISTS - DELETION FAILED
) else (
    echo LiquorInventory.db DELETED SUCCESSFULLY
)
if exist StoreInformation.db (
    echo StoreInformation.db STILL EXISTS - DELETION FAILED
) else (
    echo StoreInformation.db DELETED SUCCESSFULLY
)
echo.
echo === Test Complete ===
pause