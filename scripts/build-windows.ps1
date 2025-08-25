# PowerShell script to build LiquorPOS for Windows
# Usage: .\scripts\build-windows.ps1 [-Architecture <x64|ia32|all>] [-Type <installer|portable>] [-Clean]

param(
    [ValidateSet('x64', 'ia32', 'all')]
    [string]$Architecture = 'x64',
    
    [ValidateSet('installer', 'portable', 'both')]
    [string]$Type = 'installer',
    
    [switch]$Clean,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LiquorPOS Windows Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (!(Test-Command "node")) {
    Write-Error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
}

if (!(Test-Command "pnpm")) {
    Write-Host "pnpm not found. Installing pnpm globally..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Get current version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "Building LiquorPOS version: $version" -ForegroundColor Green

# Clean if requested
if ($Clean) {
    Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
    pnpm run clean
    if (Test-Path "build/temp") {
        Remove-Item -Recurse -Force "build/temp"
    }
}

# Ensure databases exist
Write-Host "Checking database files..." -ForegroundColor Yellow
$databases = @("LiquorDatabase.db", "LiquorInventory.db", "StoreInformation.db")
foreach ($db in $databases) {
    if (!(Test-Path $db)) {
        Write-Host "Warning: $db not found. Creating empty database..." -ForegroundColor Yellow
        New-Item -ItemType File -Path $db -Force | Out-Null
    } else {
        Write-Host "✓ $db found" -ForegroundColor Green
    }
}

# Create build resources if they don't exist
Write-Host "Preparing build resources..." -ForegroundColor Yellow
if (!(Test-Path "build")) {
    New-Item -ItemType Directory -Path "build" -Force | Out-Null
}

# Check for icon
if (!(Test-Path "build/icon.ico")) {
    Write-Host "Warning: icon.ico not found in build directory" -ForegroundColor Yellow
    Write-Host "Using default icon. Add custom icon to build/icon.ico" -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install

# Rebuild native modules for Electron
Write-Host "Rebuilding native modules for Electron..." -ForegroundColor Yellow
pnpm run rebuild

# Run tests if not skipped
if (!$SkipTests) {
    Write-Host "Running type check..." -ForegroundColor Yellow
    pnpm run typecheck
    
    Write-Host "Running linter..." -ForegroundColor Yellow
    pnpm run lint
}

# Build based on parameters
Write-Host "Starting build process..." -ForegroundColor Yellow
Write-Host "Architecture: $Architecture" -ForegroundColor Cyan
Write-Host "Type: $Type" -ForegroundColor Cyan

$buildCommand = "pnpm run "

# Determine build command based on type and architecture
if ($Type -eq 'portable') {
    $buildCommand += "build:portable"
} else {
    switch ($Architecture) {
        'x64' { $buildCommand += "build:win64" }
        'ia32' { $buildCommand += "build:win32" }
        'all' { $buildCommand += "build:win-all" }
    }
}

Write-Host "Executing: $buildCommand" -ForegroundColor Yellow
Invoke-Expression $buildCommand

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Display output location
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output files location:" -ForegroundColor Yellow
Write-Host "  release/$version/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files created:" -ForegroundColor Yellow
Get-ChildItem "release/$version/*.exe" | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name) (${size} MB)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the installer on a clean Windows machine" -ForegroundColor White
Write-Host "  2. Check Windows Defender doesn't flag the exe" -ForegroundColor White
Write-Host "  3. Distribute to testers via secure channel" -ForegroundColor White
Write-Host ""