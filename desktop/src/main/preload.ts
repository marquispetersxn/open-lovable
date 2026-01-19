import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
  setApiKey: (keyName: string, keyValue: string) =>
    ipcRenderer.invoke('set-api-key', keyName, keyValue),
  deleteApiKey: (keyName: string) => ipcRenderer.invoke('delete-api-key', keyName),

  // Config Management
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('set-config', key, value),

  // Backend
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),

  // Docker
  checkDocker: () => ipcRenderer.invoke('check-docker'),

  // Platform info
  platform: process.platform,
})

// TypeScript declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getApiKeys: () => Promise<Record<string, string>>
      setApiKey: (keyName: string, keyValue: string) => Promise<boolean>
      deleteApiKey: (keyName: string) => Promise<boolean>
      getConfig: () => Promise<Record<string, unknown>>
      setConfig: (key: string, value: unknown) => Promise<boolean>
      getBackendPort: () => Promise<number>
      checkDocker: () => Promise<{ available: boolean; error?: string }>
      platform: NodeJS.Platform
    }
  }
}
