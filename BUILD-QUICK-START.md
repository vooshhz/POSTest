# 🚀 Quick Start - Building LiquorPOS for Windows

## Prerequisites Installation (One-time setup)
```powershell
# 1. Install Node.js 18+ from https://nodejs.org
# 2. Install pnpm globally
npm install -g pnpm

# 3. Install Windows Build Tools (if needed)
npm install -g windows-build-tools
```

## Build Your First Windows Installer (3 Steps)

### Step 1: Prepare
```powershell
# Navigate to project directory
cd C:\POSTest\pos-lite

# Install dependencies
pnpm install

# Rebuild native modules for Electron
pnpm run rebuild
```

### Step 2: Build
```powershell
# For 64-bit Windows (most common)
pnpm run build:win64

# Or use the PowerShell script for more options
.\scripts\build-windows.ps1
```

### Step 3: Find Your Installer
```powershell
# Your installer will be in:
# release\1.0.0\LiquorPOS-Setup-1.0.0-x64.exe

# Open the folder
explorer release\1.0.0\
```

## ⚠️ Important Notes

1. **First Build Takes Longer** - Expect 5-10 minutes for the first build
2. **Icon Warning** - Add your custom icon to `build\icon.ico` or the default will be used
3. **Database Files** - Ensure all .db files exist in the project root
4. **Antivirus** - May need to temporarily disable during build

## 🎯 Quick Commands Reference

| Task | Command |
|------|---------|
| Build 64-bit installer | `pnpm run build:win64` |
| Build 32-bit installer | `pnpm run build:win32` |
| Build portable version | `pnpm run build:portable` |
| Clean build artifacts | `pnpm run clean` |
| Test without building | `pnpm dev` |
| Rebuild native modules | `pnpm run rebuild` |

## 📦 What Gets Built?

```
release/
└── 1.0.0/
    ├── LiquorPOS-Setup-1.0.0-x64.exe  (Installer for users)
    ├── LiquorPOS-Setup-1.0.0-x64.exe.blockmap
    └── latest.yml  (Auto-update info)
```

## 🔧 Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| "Module not found" | Run `pnpm install` |
| "Native module error" | Run `pnpm run rebuild` |
| "Build failed" | Run `pnpm run clean` then try again |
| "Permission denied" | Run PowerShell as Administrator |
| "Virus detected" | False positive - add to antivirus exceptions |

## 📤 Distributing to Testers

1. **Upload the .exe file** from `release\1.0.0\` to:
   - Google Drive / Dropbox / OneDrive
   - Company file server
   - GitHub Releases (if using GitHub)

2. **Tell testers to:**
   - Download the .exe file
   - Right-click → "Run as administrator"
   - If SmartScreen appears → "More info" → "Run anyway"
   - Follow installation wizard

3. **Provide default login:**
   - Username: `admin`
   - Password: `admin123`

## ✅ Pre-Release Checklist

- [ ] Updated version in package.json
- [ ] Tested in development mode (`pnpm dev`)
- [ ] Added custom icon to `build\icon.ico`
- [ ] All database files present
- [ ] Run `pnpm run lint` - no errors
- [ ] Build completed successfully
- [ ] Tested installer on clean Windows machine
- [ ] Created backup of databases

## Need Help?

- Full guide: See `WINDOWS-BUILD-GUIDE.md`
- Build scripts: Check `scripts\` folder
- Logs: `%APPDATA%\LiquorPOS Lite\logs\`

---
**Ready to build? Run:** `pnpm run build:win64` 🎉