@echo off
REM POS System Web Deployment Script for Windows
REM This script builds and deploys your app to Fly.io

echo Starting deployment process...
echo.

REM Step 1: Build the web version
echo Building web version...
call pnpm run build:web

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed! Please fix errors and try again.
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.

REM Step 2: Deploy to Fly.io
echo Deploying to Fly.io...
call flyctl deploy

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo Deployment failed! Check the logs with: flyctl logs
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment successful!
echo Your app is now live at: https://your-pos-app.fly.dev/
echo ========================================
echo.
echo Commands:
echo - View logs: flyctl logs
echo - SSH into server: flyctl ssh console
echo.
pause