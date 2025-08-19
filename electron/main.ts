import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerInventoryIpc } from './db'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const transactionWindows = new Map<string, BrowserWindow>()

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    show: false,
    frame: true,
    titleBarStyle: 'default',
    fullscreen: false,
    maximizable: true,
    minimizable: true,
    resizable: true
  })
  
  // Maximize the window
  win.maximize()
  
  // Then show it
  win.once('ready-to-show', () => {
    win?.show()
  })
  
  // Whenever the window is restored from minimize, maximize it again
  win.on('restore', () => {
    win?.maximize()
  })
  
  // If someone tries to unmaximize, re-maximize it
  win.on('unmaximize', () => {
    setTimeout(() => {
      win?.maximize()
    }, 10)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Handle window focus
ipcMain.handle('focus-window', async () => {
  if (win) {
    win.focus();
    // Also try to bring the window to front
    win.setAlwaysOnTop(true);
    setTimeout(() => {
      win?.setAlwaysOnTop(false);
    }, 100);
  }
});

// Handle opening transaction details window
ipcMain.handle('open-transaction-details', async (_event, transactionData) => {
  const transactionId = `transaction-${transactionData.id}`
  
  // Check if window already exists
  if (transactionWindows.has(transactionId)) {
    const existingWindow = transactionWindows.get(transactionId)
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus()
      return
    }
  }
  
  // Create new window for transaction details
  const detailsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: `Transaction #${transactionData.id}`,
    parent: win || undefined
  })
  
  // Store window reference
  transactionWindows.set(transactionId, detailsWindow)
  
  // Load transaction details page with data
  const encodedData = encodeURIComponent(JSON.stringify(transactionData))
  
  if (VITE_DEV_SERVER_URL) {
    detailsWindow.loadURL(`${VITE_DEV_SERVER_URL}transaction-details.html?transaction=${encodedData}`)
  } else {
    const detailsPath = path.join(RENDERER_DIST, 'transaction-details.html')
    detailsWindow.loadURL(`file://${detailsPath}?transaction=${encodedData}`)
  }
  
  // Clean up when window is closed
  detailsWindow.on('closed', () => {
    transactionWindows.delete(transactionId)
  })
})

app.whenReady().then(() => {
  createWindow()
  registerInventoryIpc(ipcMain)
})
