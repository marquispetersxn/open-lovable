import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import HomePage from './pages/HomePage'
import GenerationPage from './pages/GenerationPage'
import SettingsPage from './pages/SettingsPage'
import Sidebar from './components/Sidebar'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [keysValid, setKeysValid] = useState<boolean | null>(null)
  const [backendPort, setBackendPort] = useState<number>(3001)

  useEffect(() => {
    // Get backend port
    window.electronAPI?.getBackendPort().then(setBackendPort)

    // Check if API keys are configured
    checkApiKeys()
  }, [])

  const checkApiKeys = async () => {
    try {
      const port = await window.electronAPI?.getBackendPort()
      const response = await fetch(`http://localhost:${port}/api/validate-keys`)
      const data = await response.json()
      setKeysValid(data.valid)

      // Redirect to settings if no keys configured
      if (!data.valid && location.pathname !== '/settings') {
        navigate('/settings')
      }
    } catch (error) {
      console.error('Failed to validate keys:', error)
      setKeysValid(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar keysValid={keysValid} />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/generate"
            element={<GenerationPage backendPort={backendPort} />}
          />
          <Route
            path="/settings"
            element={<SettingsPage onKeysUpdated={checkApiKeys} />}
          />
        </Routes>
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}
