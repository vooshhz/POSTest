# Windows Build Guide for LiquorPOS Lite

## 📋 Pre-Build Checklist

Before building, ensure you have:

- [ ] Node.js 18+ installed
- [ ] pnpm package manager installed (`npm install -g pnpm`)
- [ ] Windows SDK (comes with Visual Studio 2019/2022 Community)
- [ ] All database files present (LiquorDatabase.db, LiquorInventory.db, StoreInformation.db)
- [ ] Updated version number in package.json
- [ ] Custom icon file at `build/icon.ico` (256x256 recommended)
- [ ] Tested the app in development mode (`pnpm dev`)

## 🔨 Build Commands

### Quick Build Commands

```powershell
# Development build (fastest, for testing)
pnpm run build:test

# Production build - Windows 64-bit (recommended)
pnpm run build:win64

# Production build - Windows 32-bit
pnpm run build:win32

# Production build - Both architectures
pnpm run build:win-all

# Portable version (no installation required)
pnpm run build:portable

# Clean all build artifacts
pnpm run clean
```

### Using PowerShell Script (Recommended)

```powershell
# Build 64-bit installer
.\scripts\build-windows.ps1

# Build 32-bit installer
.\scripts\build-windows.ps1 -Architecture ia32

# Build both architectures
.\scripts\build-windows.ps1 -Architecture all

# Build portable version
.\scripts\build-windows.ps1 -Type portable

# Clean build
.\scripts\build-windows.ps1 -Clean

# Skip tests for faster build
.\scripts\build-windows.ps1 -SkipTests
```

### Using Batch Script

```batch
# Build 64-bit installer
scripts\build-windows.bat

# Build 32-bit installer
scripts\build-windows.bat ia32

# Clean and build
scripts\build-windows.bat x64 clean
```

## 📦 Database Handling

### Development vs Production Paths

**Development Mode:**
- Databases are loaded from the project root directory
- Direct file access for development

**Production Mode:**
- Databases are copied to `%APPDATA%\LiquorPOS Lite\databases\`
- First run copies from installer resources
- Subsequent runs use the user's local copy
- Updates preserve existing data

### Database Locations

```
Production Database Paths:
C:\Users\[Username]\AppData\Roaming\LiquorPOS Lite\databases\
  ├── LiquorDatabase.db      (Product catalog - read-only)
  ├── LiquorInventory.db     (Inventory & transactions)
  └── StoreInformation.db    (Store config & users)
```

## ✅ Testing Checklist

### Installation Testing

- [ ] **Clean Installation**
  - [ ] Install on Windows 10 (clean system)
  - [ ] Install on Windows 11 (clean system)
  - [ ] Verify Start Menu shortcut created
  - [ ] Verify Desktop shortcut created
  - [ ] Check installation directory permissions

- [ ] **First Run**
  - [ ] Application launches without errors
  - [ ] Databases are initialized correctly
  - [ ] Default admin user can log in
  - [ ] Store setup wizard appears (if applicable)

### Functionality Testing

- [ ] **Core Features**
  - [ ] User login/logout works
  - [ ] Product scanning/search works
  - [ ] Cart operations (add/remove/update)
  - [ ] Payment processing
  - [ ] Receipt printing/preview
  - [ ] Inventory management
  - [ ] Reports generation

- [ ] **Database Operations**
  - [ ] Products load from catalog
  - [ ] Transactions save correctly
  - [ ] Inventory updates properly
  - [ ] User activity logs work

- [ ] **Printer Testing**
  - [ ] Receipt printer detected
  - [ ] Test print successful
  - [ ] Receipt formatting correct

### Uninstallation Testing

- [ ] **Clean Uninstall**
  - [ ] Uninstaller runs without errors
  - [ ] Program files removed
  - [ ] Start Menu shortcuts removed
  - [ ] Desktop shortcut removed
  - [ ] Option to keep/remove user data works
  - [ ] Registry entries cleaned

## 🚀 Distribution

### File Naming Convention

```
Release files:
LiquorPOS-Setup-1.0.0-x64.exe    (64-bit installer)
LiquorPOS-Setup-1.0.0-ia32.exe   (32-bit installer)
LiquorPOS-Portable-1.0.0.exe     (Portable version)
```

### Distribution Channels

1. **Direct Download**
   - Host on secure server with HTTPS
   - Provide checksums (SHA256) for verification
   - Include system requirements

2. **Beta Testing**
   - Use services like Google Drive, Dropbox, or OneDrive
   - Password protect the download link
   - Track tester feedback

3. **Version Control**
   - Tag releases in Git: `git tag v1.0.0`
   - Create GitHub Release (if using GitHub)
   - Attach built executables to release

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### "Windows protected your PC" SmartScreen Warning

**Solution:**
```
1. Right-click the installer
2. Select "Properties"
3. Check "Unblock" at the bottom
4. Click "Apply" and "OK"
5. Run installer again
```

**For testers:** This is normal for unsigned software. The warning will disappear after enough users have safely run the program.

#### Missing Visual C++ Redistributables

**Error:** "VCRUNTIME140.dll was not found"

**Solution:**
```powershell
# Install Visual C++ Redistributables
# Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
```

#### SQLite Database Locked Errors

**Error:** "database is locked"

**Solutions:**
1. Ensure only one instance of the app is running
2. Check antivirus isn't scanning the database files
3. Verify write permissions on database directory

#### White Screen on Startup

**Solutions:**
1. Delete cache: `%APPDATA%\LiquorPOS Lite\Cache`
2. Run as administrator (first time)
3. Check Windows Event Viewer for errors
4. Reinstall with antivirus disabled temporarily

#### Native Module Errors

**Error:** "The module was compiled against a different Node.js version"

**Solution:**
```powershell
# Rebuild native modules
pnpm run rebuild
pnpm run build:win64
```

#### Permission Denied Errors

**Solutions:**
1. Run installer as administrator
2. Check UAC settings
3. Verify installation directory permissions
4. Disable controlled folder access temporarily

### Windows Security Considerations

#### Antivirus False Positives

Common antivirus that may flag the app:
- Windows Defender
- McAfee
- Norton
- Avast

**Prevention:**
1. Submit exe to antivirus vendors for whitelisting
2. Sign the executable (requires code signing certificate)
3. Build reputation over time

#### Code Signing (Optional for Testing)

For production release, consider getting a code signing certificate:

```powershell
# Sign the executable (requires certificate)
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "release\1.0.0\LiquorPOS-Setup-1.0.0-x64.exe"
```

## 📊 Performance Optimization

### Build Size Optimization

```javascript
// In electron-builder.json5
{
  "compression": "maximum",  // Smaller file size
  "nsis": {
    "differentialPackage": false  // Full installer
  }
}
```

### Startup Optimization

1. Enable V8 snapshots
2. Lazy load heavy modules
3. Optimize database queries
4. Implement splash screen

## 📝 Build Verification

After building, verify:

```powershell
# Check file size (should be 50-150 MB)
Get-Item "release\1.0.0\*.exe" | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length/1MB,2)}}

# Verify with Windows Defender
Windows Defender SmartScreen /Check "release\1.0.0\LiquorPOS-Setup-1.0.0-x64.exe"

# Test silent installation
.\LiquorPOS-Setup-1.0.0-x64.exe /S /D=C:\TestInstall
```

## 🎯 Quick Start for Testers

### For Testers - Installation Steps:

1. **Download the installer** from the provided link
2. **Right-click** the downloaded file and select **"Run as administrator"**
3. **If Windows Defender SmartScreen appears:**
   - Click "More info"
   - Click "Run anyway"
4. **Follow the installation wizard:**
   - Accept the license agreement
   - Choose installation directory (or use default)
   - Select "Create desktop shortcut"
   - Click "Install"
5. **Launch the application** from desktop or Start Menu
6. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin123`
7. **Complete initial setup:**
   - Enter store information
   - Set tax rate
   - Create additional users if needed

## 📞 Support

For build issues:
- Check the error logs in `%APPDATA%\LiquorPOS Lite\logs\`
- Run in debug mode: Set environment variable `ELECTRON_ENABLE_LOGGING=1`
- Check Windows Event Viewer for application errors

## Next Steps

1. **Test the installer** on multiple Windows versions
2. **Gather feedback** from beta testers
3. **Consider code signing** for production release
4. **Set up auto-update server** for seamless updates
5. **Create user documentation** and training materials