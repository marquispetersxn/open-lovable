import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { startBackendServer } from './server'
import { SecureStorage } from './secure-storage'
import { ConfigStore } from './config-store'

let mainWindow: BrowserWindow | null = null
let backendPort: number = 3001

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
    backgroundColor: '#0a0a0a',
  })

  // Start backend server
  backendPort = await startBackendServer()
  console.log(`Backend server running on port ${backendPort}`)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC Handlers for API Key Management
const secureStorage = new SecureStorage()
const configStore = new ConfigStore()

// Get all API keys (masked)
ipcMain.handle('get-api-keys', async () => {
  const keys = await secureStorage.getAllKeys()
  // Return masked versions for display
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(keys)) {
    if (value) {
      masked[key] = value.substring(0, 8) + '...' + value.substring(value.length - 4)
    } else {
      masked[key] = ''
    }
  }
  return masked
})

// Set an API key
ipcMain.handle('set-api-key', async (_, keyName: string, keyValue: string) => {
  await secureStorage.setKey(keyName, keyValue)
  return true
})

// Delete an API key
ipcMain.handle('delete-api-key', async (_, keyName: string) => {
  await secureStorage.deleteKey(keyName)
  return true
})

// Get raw API key (for backend use)
ipcMain.handle('get-api-key-raw', async (_, keyName: string) => {
  return await secureStorage.getKey(keyName)
})

// Config management
ipcMain.handle('get-config', async () => {
  return configStore.getAll()
})

ipcMain.handle('set-config', async (_, key: string, value: unknown) => {
  configStore.set(key, value)
  return true
})

// Get backend port
ipcMain.handle('get-backend-port', () => {
  return backendPort
})

// Check if Docker is available
ipcMain.handle('check-docker', async () => {
  try {
    const Docker = require('dockerode')
    const docker = new Docker()
    await docker.ping()
    return { available: true }
  } catch {
    return { available: false, error: 'Docker is not running or not installed' }
  }
})
