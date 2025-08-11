import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerInventoryIpc } from './db'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  
  // Set fixed dimensions with 16:10 aspect ratio (common for POS systems)
  // Use 90% of screen height and calculate width based on aspect ratio
  const windowHeight = Math.floor(screenHeight * 0.9)
  const windowWidth = Math.floor(windowHeight * 1.6) // 16:10 aspect ratio
  
  // Center the window
  const x = Math.floor((screenWidth - windowWidth) / 2)
  const y = Math.floor((screenHeight - windowHeight) / 2)

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    resizable: false,
    maximizable: false,
    fullScreenable: false
  })

  // Set aspect ratio to maintain consistent layout
  win.setAspectRatio(16/10)
  
  // Prevent window from being moved or resized
  win.setMovable(false)
  win.setResizable(false)
  
  // Show window after all settings are applied
  win.show()

  // Prevent any window state changes
  win.on('minimize', (event) => {
    event.preventDefault()
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

app.whenReady().then(() => {
  createWindow()
  registerInventoryIpc(ipcMain)
})
