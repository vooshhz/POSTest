@echo off
REM Backup Web Configuration Files
REM This creates a backup of all web deployment files

echo Creating backup of web deployment files...

REM Create backup directory with timestamp
set BACKUP_DIR=web-deployment-backup-%date:~-4%-%date:~4,2%-%date:~7,2%-%time:~0,2%-%time:~3,2%-%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir %BACKUP_DIR%

echo Backing up to: %BACKUP_DIR%
echo.

REM Copy critical web files
echo Copying web deployment files...
copy Dockerfile %BACKUP_DIR%\
copy fly.toml %BACKUP_DIR%\
copy .dockerignore %BACKUP_DIR%\
copy server-fly-fixed.js %BACKUP_DIR%\
copy DEPLOYMENT.md %BACKUP_DIR%\
copy deploy.bat %BACKUP_DIR%\
copy deploy.sh %BACKUP_DIR%\

REM Copy web API files
echo Copying API layer files...
mkdir %BACKUP_DIR%\api
copy src\api\webApiLayer.ts %BACKUP_DIR%\api\
copy src\api\webApiLayerComplete.ts %BACKUP_DIR%\api\
copy src\api\apiLayer.ts %BACKUP_DIR%\api\

echo.
echo ========================================
echo Backup complete!
echo Location: %BACKUP_DIR%
echo ========================================
echo.
echo These files are critical for web deployment.
echo Keep this backup safe!
echo.
pause