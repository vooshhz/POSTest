@echo off
REM Batch script to build LiquorPOS for Windows
REM Usage: build-windows.bat [x64|ia32|all] [clean]

setlocal enabledelayedexpansion

echo ========================================
echo   LiquorPOS Windows Build Script
echo ========================================
echo.

REM Parse arguments
set ARCH=%1
set CLEAN=%2

if "%ARCH%"=="" set ARCH=x64
if "%ARCH%"=="clean" (
    set CLEAN=clean
    set ARCH=x64
)

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18 or higher.
    exit /b 1
)

REM Check pnpm
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo pnpm not found. Installing pnpm globally...
    call npm install -g pnpm
)

echo Building for architecture: %ARCH%

REM Clean if requested
if "%CLEAN%"=="clean" (
    echo Cleaning previous builds...
    call pnpm run clean
    if exist "build\temp" rmdir /s /q "build\temp"
)

REM Check databases
echo Checking database files...
if not exist "LiquorDatabase.db" (
    echo Warning: LiquorDatabase.db not found. Creating empty file...
    type nul > LiquorDatabase.db
)
if not exist "LiquorInventory.db" (
    echo Warning: LiquorInventory.db not found. Creating empty file...
    type nul > LiquorInventory.db
)
if not exist "StoreInformation.db" (
    echo Warning: StoreInformation.db not found. Creating empty file...
    type nul > StoreInformation.db
)

REM Create build directory
if not exist "build" mkdir build

REM Install dependencies
echo Installing dependencies...
call pnpm install

REM Rebuild native modules
echo Rebuilding native modules for Electron...
call pnpm run rebuild

REM Type check
echo Running type check...
call pnpm run typecheck

REM Build based on architecture
echo Starting build process...
if "%ARCH%"=="ia32" (
    call pnpm run build:win32
) else if "%ARCH%"=="all" (
    call pnpm run build:win-all
) else (
    call pnpm run build:win64
)

if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Output files are in: release\
echo.
echo Next steps:
echo   1. Test the installer on a clean Windows machine
echo   2. Check Windows Defender doesn't flag the exe
echo   3. Distribute to testers
echo.

endlocal