# 📦 Distribution Instructions for LiquorPOS Lite

## Build Status ✅
Your Windows application has been successfully built!

## Available Build Artifacts

### 📁 Location: `release\1.0.0\`

1. **Portable Version (Ready for Distribution)**
   - File: `LiquorPOS-Portable-1.0.0-x64.zip` (116 MB)
   - Type: Portable ZIP - No installation required
   - Platform: Windows 64-bit

2. **Unpacked Application**
   - Folder: `win-unpacked\` - 64-bit version
   - Folder: `win-ia32-unpacked\` - 32-bit version
   - Can be run directly by executing `LiquorPOS Lite.exe`

## 🚀 Distribution Options

### Option 1: Portable ZIP (Recommended for Testing)

**For You (Developer):**
1. Navigate to `release\1.0.0\`
2. Find `LiquorPOS-Portable-1.0.0-x64.zip`
3. Upload to your preferred file sharing service:
   - Google Drive
   - Dropbox
   - OneDrive
   - WeTransfer
   - Company file server

**For Testers:**
1. Download the ZIP file
2. Extract to any folder (e.g., Desktop or C:\LiquorPOS)
3. Open the extracted folder
4. Double-click `LiquorPOS Lite.exe` to run
5. If Windows SmartScreen appears:
   - Click "More info"
   - Click "Run anyway"

### Option 2: Direct Folder Copy

**For Local Testing:**
1. Copy the entire `win-unpacked` folder to the test machine
2. Rename it to `LiquorPOS Lite`
3. Create a desktop shortcut to `LiquorPOS Lite.exe`
4. Run the application

## 📝 Instructions for Testers

### Quick Start Guide

**Installation Steps (Portable Version):**
1. **Download** the file: `LiquorPOS-Portable-1.0.0-x64.zip`
2. **Extract** to a folder of your choice:
   - Right-click the ZIP file
   - Select "Extract All..."
   - Choose destination (e.g., `C:\Program Files\LiquorPOS`)
3. **Create Desktop Shortcut** (Optional):
   - Right-click on `LiquorPOS Lite.exe`
   - Select "Send to" → "Desktop (create shortcut)"

**First Run:**
1. Double-click `LiquorPOS Lite.exe`
2. If Windows Defender SmartScreen appears:
   - This is normal for unsigned software
   - Click "More info" → "Run anyway"
3. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`

**Initial Setup:**
1. Complete store information setup
2. Set your local tax rate
3. Create additional user accounts as needed
4. Import or enter initial inventory

## 🔍 Testing Checklist for Testers

Please verify the following:

### Basic Functionality
- [ ] Application launches without errors
- [ ] Can login with default credentials
- [ ] Store setup wizard works
- [ ] Can create new users

### POS Operations
- [ ] Product search/scanning works
- [ ] Cart operations (add/remove items)
- [ ] Checkout process completes
- [ ] Receipt preview/printing works

### Inventory Management
- [ ] Can view inventory
- [ ] Can add new products
- [ ] Can adjust quantities
- [ ] Inventory updates after sales

### Reports
- [ ] Daily sales report generates
- [ ] Inventory reports work
- [ ] Can export data

### System Requirements
- Windows 10 or Windows 11
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space
- Internet connection (for initial setup only)

## 📧 Feedback Collection

### What to Include in Bug Reports:
1. **System Information:**
   - Windows version (10/11)
   - RAM and processor
   - Antivirus software

2. **Issue Details:**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if possible

3. **Error Messages:**
   - Exact error text
   - When it occurred
   - What you were doing

### Where to Send Feedback:
- Email: [your-email@example.com]
- Issue Tracker: [your-issue-tracker-url]
- Include "LiquorPOS Beta Feedback" in subject

## ⚠️ Known Issues

1. **No Installer Yet**: Currently only portable version available
2. **No Custom Icon**: Using default Electron icon
3. **SmartScreen Warning**: Normal for unsigned apps
4. **Database Location**: Databases are in the app folder (not AppData)

## 🛡️ Security Notes for Testers

- This is a BETA version for testing only
- Do not use with real transaction data yet
- Databases are stored locally in the application folder
- No data is sent to external servers
- Change default admin password immediately

## 📊 File Structure Distributed

```
LiquorPOS-Portable-1.0.0-x64/
├── LiquorPOS Lite.exe          # Main application
├── resources/
│   ├── app.asar               # Application code
│   └── databases/              # Database files
│       ├── LiquorDatabase.db
│       ├── LiquorInventory.db
│       └── StoreInformation.db
├── locales/                    # Language files
└── [various DLL files]         # Required libraries
```

## 🎯 Next Steps

### For You (Developer):
1. Share the portable ZIP with testers
2. Collect feedback for 1-2 weeks
3. Fix reported issues
4. Create proper installer with custom icon
5. Consider code signing for future releases

### For Production Release:
1. Get a proper code signing certificate
2. Create a professional icon
3. Build NSIS installer
4. Set up auto-update server
5. Create user documentation

## 💡 Tips for Smooth Testing

1. **Create a Testing Package** with:
   - The portable ZIP file
   - This instruction document
   - Sample data for testing
   - Known issues list

2. **Set Up a Feedback Channel**:
   - Create a simple Google Form
   - Or use a shared spreadsheet
   - Schedule weekly check-ins

3. **Version Control**:
   - Tag this release in Git: `git tag v1.0.0-beta`
   - Keep track of which version testers have

## ✅ Distribution Checklist

Before sending to testers:
- [x] Application builds successfully
- [x] Portable ZIP created
- [x] Default login credentials work
- [x] Databases are included
- [ ] Test on a clean Windows machine
- [ ] Prepare feedback collection method
- [ ] Create tester communication channel
- [ ] Document known issues

---

**Ready to distribute!** 

The portable version at `release\1.0.0\LiquorPOS-Portable-1.0.0-x64.zip` is ready to share with your testers.

Remember: This is a beta version without an installer. The portable version is perfect for testing and getting initial feedback before creating the final installer.