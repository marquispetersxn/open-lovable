import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Server,
  Plus,
  Globe,
  Cpu,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface SettingsPageProps {
  onKeysUpdated: () => void
}

interface CustomAIProvider {
  name: string
  baseUrl: string
  apiKeyHeader: string
  apiKeyPrefix: string
  modelEndpoint: string
  defaultModel: string
  supportsStreaming: boolean
  requestFormat: 'openai' | 'anthropic' | 'custom'
  enabled: boolean
}

interface CustomScrapingProvider {
  name: string
  baseUrl: string
  apiKeyHeader: string
  apiKeyPrefix: string
  scrapeEndpoint: string
  requestMethod: 'GET' | 'POST'
  urlParamName: string
  responseContentPath: string
  supportsScreenshot: boolean
  enabled: boolean
}

const BUILT_IN_AI_PROVIDERS = [
  { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY', url: 'https://console.groq.com' },
  { id: 'anthropic', name: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', url: 'https://console.anthropic.com' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY', url: 'https://platform.openai.com' },
  { id: 'google', name: 'Google (Gemini)', envKey: 'GEMINI_API_KEY', url: 'https://aistudio.google.com' },
]

const BUILT_IN_SCRAPING_PROVIDERS = [
  { id: 'jina', name: 'Jina AI Reader', envKey: null, url: 'https://jina.ai', note: 'Free, no API key needed' },
  { id: 'firecrawl', name: 'Firecrawl', envKey: 'FIRECRAWL_API_KEY', url: 'https://firecrawl.dev' },
  { id: 'local', name: 'Local (Puppeteer)', envKey: null, url: null, note: 'Runs locally, no API needed' },
]

const DEFAULT_CUSTOM_AI_PROVIDER: CustomAIProvider = {
  name: '',
  baseUrl: '',
  apiKeyHeader: 'Authorization',
  apiKeyPrefix: 'Bearer ',
  modelEndpoint: '/v1/chat/completions',
  defaultModel: '',
  supportsStreaming: true,
  requestFormat: 'openai',
  enabled: true,
}

const DEFAULT_CUSTOM_SCRAPING_PROVIDER: CustomScrapingProvider = {
  name: '',
  baseUrl: '',
  apiKeyHeader: 'Authorization',
  apiKeyPrefix: 'Bearer ',
  scrapeEndpoint: '/api/scrape',
  requestMethod: 'POST',
  urlParamName: 'url',
  responseContentPath: 'content',
  supportsScreenshot: false,
  enabled: true,
}

export default function SettingsPage({ onKeysUpdated }: SettingsPageProps) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null)

  // Custom providers
  const [customAIProviders, setCustomAIProviders] = useState<CustomAIProvider[]>([])
  const [customScrapingProviders, setCustomScrapingProviders] = useState<CustomScrapingProvider[]>([])

  // Edit states
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  // Custom provider forms
  const [showAddAIProvider, setShowAddAIProvider] = useState(false)
  const [showAddScrapingProvider, setShowAddScrapingProvider] = useState(false)
  const [newAIProvider, setNewAIProvider] = useState<CustomAIProvider>(DEFAULT_CUSTOM_AI_PROVIDER)
  const [newScrapingProvider, setNewScrapingProvider] = useState<CustomScrapingProvider>(DEFAULT_CUSTOM_SCRAPING_PROVIDER)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ai: true,
    scraping: true,
    sandbox: false,
    advanced: false,
  })

  useEffect(() => {
    loadSettings()
    checkDocker()
  }, [])

  const loadSettings = async () => {
    try {
      const apiKeys = await window.electronAPI?.getApiKeys()
      setKeys(apiKeys || {})

      const appConfig = await window.electronAPI?.getConfig()
      setConfig(appConfig || {})

      // Load custom providers from config
      if (appConfig?.customAIProviders) {
        setCustomAIProviders(appConfig.customAIProviders as CustomAIProvider[])
      }
      if (appConfig?.customScrapingProviders) {
        setCustomScrapingProviders(appConfig.customScrapingProviders as CustomScrapingProvider[])
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    }
  }

  const checkDocker = async () => {
    try {
      const result = await window.electronAPI?.checkDocker()
      setDockerAvailable(result?.available || false)
    } catch {
      setDockerAvailable(false)
    }
  }

  const saveKey = async (envKey: string) => {
    if (!newKeyValue.trim()) {
      toast.error('Please enter a valid API key')
      return
    }

    try {
      await window.electronAPI?.setApiKey(envKey, newKeyValue)
      toast.success('API key saved securely')
      setEditingKey(null)
      setNewKeyValue('')
      loadSettings()
      onKeysUpdated()
    } catch {
      toast.error('Failed to save API key')
    }
  }

  const deleteKey = async (envKey: string) => {
    try {
      await window.electronAPI?.deleteApiKey(envKey)
      toast.success('API key deleted')
      loadSettings()
      onKeysUpdated()
    } catch {
      toast.error('Failed to delete API key')
    }
  }

  const updateConfig = async (key: string, value: unknown) => {
    try {
      await window.electronAPI?.setConfig(key, value)
      setConfig((prev) => ({ ...prev, [key]: value }))
      toast.success('Setting updated')
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const addCustomAIProvider = async () => {
    if (!newAIProvider.name || !newAIProvider.baseUrl) {
      toast.error('Name and Base URL are required')
      return
    }

    const updated = [...customAIProviders, newAIProvider]
    setCustomAIProviders(updated)
    await updateConfig('customAIProviders', updated)
    setNewAIProvider(DEFAULT_CUSTOM_AI_PROVIDER)
    setShowAddAIProvider(false)
    toast.success('Custom AI provider added')
  }

  const removeCustomAIProvider = async (name: string) => {
    const updated = customAIProviders.filter((p) => p.name !== name)
    setCustomAIProviders(updated)
    await updateConfig('customAIProviders', updated)
    // Also remove the API key
    await window.electronAPI?.deleteApiKey(`CUSTOM_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`)
    toast.success('Custom AI provider removed')
  }

  const addCustomScrapingProvider = async () => {
    if (!newScrapingProvider.name || !newScrapingProvider.baseUrl) {
      toast.error('Name and Base URL are required')
      return
    }

    const updated = [...customScrapingProviders, newScrapingProvider]
    setCustomScrapingProviders(updated)
    await updateConfig('customScrapingProviders', updated)
    setNewScrapingProvider(DEFAULT_CUSTOM_SCRAPING_PROVIDER)
    setShowAddScrapingProvider(false)
    toast.success('Custom scraping provider added')
  }

  const removeCustomScrapingProvider = async (name: string) => {
    const updated = customScrapingProviders.filter((p) => p.name !== name)
    setCustomScrapingProviders(updated)
    await updateConfig('customScrapingProviders', updated)
    await window.electronAPI?.deleteApiKey(`CUSTOM_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`)
    toast.success('Custom scraping provider removed')
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const renderKeyInput = (envKey: string, isVisible: boolean) => (
    <div className="mt-3 flex gap-2">
      <input
        type={isVisible ? 'text' : 'password'}
        value={newKeyValue}
        onChange={(e) => setNewKeyValue(e.target.value)}
        placeholder="Enter API key..."
        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
        autoFocus
      />
      <button
        onClick={() => setShowKey((prev) => ({ ...prev, [envKey]: !isVisible }))}
        className="p-2 text-gray-400 hover:text-white"
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <button
        onClick={() => saveKey(envKey)}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm flex items-center gap-1"
      >
        <Save size={16} />
        Save
      </button>
      <button
        onClick={() => { setEditingKey(null); setNewKeyValue('') }}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
      >
        Cancel
      </button>
    </div>
  )

  const isConfigured = (config.aiProvider === 'custom' && customAIProviders.length > 0) ||
    (config.aiProvider !== 'custom' && BUILT_IN_AI_PROVIDERS.some((p) => p.id === config.aiProvider && keys[p.envKey]))

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 mb-8">
          Configure your custom AI and web scraping providers
        </p>

        {/* Status Banner */}
        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-amber-400">Setup Required</h3>
              <p className="text-sm text-gray-400">
                Configure at least one AI provider (built-in or custom) to use Open Lovable.
              </p>
            </div>
          </div>
        )}

        {/* AI Providers Section */}
        <section className="mb-6">
          <button
            onClick={() => toggleSection('ai')}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Cpu size={20} className="text-purple-400" />
              </span>
              <div className="text-left">
                <h2 className="text-lg font-semibold">AI Providers</h2>
                <p className="text-sm text-gray-400">Configure AI models for code generation</p>
              </div>
            </div>
            {expandedSections.ai ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.ai && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-800">
              {/* AI Provider Selection */}
              <div className="p-4 bg-gray-800/30 rounded-lg">
                <label className="block font-medium mb-2">Active AI Provider</label>
                <select
                  value={(config.aiProvider as string) || 'groq'}
                  onChange={(e) => updateConfig('aiProvider', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <optgroup label="Built-in Providers">
                    {BUILT_IN_AI_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  {customAIProviders.length > 0 && (
                    <optgroup label="Custom Providers">
                      {customAIProviders.map((p) => (
                        <option key={p.name} value={`custom:${p.name}`}>{p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Built-in Provider Keys */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Built-in Provider API Keys</h3>
                {BUILT_IN_AI_PROVIDERS.map((provider) => (
                  <div key={provider.id} className="p-4 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        {keys[provider.envKey] && <CheckCircle className="text-green-500" size={16} />}
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={provider.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-purple-400">
                          <ExternalLink size={16} />
                        </a>
                        <button onClick={() => setEditingKey(provider.envKey)} className="p-2 text-gray-400 hover:text-white">
                          <Key size={16} />
                        </button>
                        {keys[provider.envKey] && (
                          <button onClick={() => deleteKey(provider.envKey)} className="p-2 text-gray-400 hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingKey === provider.envKey && renderKeyInput(provider.envKey, showKey[provider.envKey])}
                    {keys[provider.envKey] && editingKey !== provider.envKey && (
                      <code className="text-xs text-gray-500 mt-2 block">{keys[provider.envKey]}</code>
                    )}
                  </div>
                ))}
              </div>

              {/* Custom AI Providers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Custom AI Providers</h3>
                  <button
                    onClick={() => setShowAddAIProvider(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 rounded"
                  >
                    <Plus size={14} />
                    Add Custom
                  </button>
                </div>

                {customAIProviders.map((provider) => (
                  <div key={provider.name} className="p-4 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{provider.name}</span>
                        <p className="text-xs text-gray-500">{provider.baseUrl}</p>
                      </div>
                      <button onClick={() => removeCustomAIProvider(provider.name)} className="p-2 text-gray-400 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {showAddAIProvider && (
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-purple-500/30 space-y-4">
                    <h4 className="font-medium">Add Custom AI Provider</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Provider Name *</label>
                        <input
                          type="text"
                          value={newAIProvider.name}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, name: e.target.value })}
                          placeholder="My AI Service"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Base URL *</label>
                        <input
                          type="text"
                          value={newAIProvider.baseUrl}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, baseUrl: e.target.value })}
                          placeholder="https://api.myservice.com"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Chat Endpoint</label>
                        <input
                          type="text"
                          value={newAIProvider.modelEndpoint}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, modelEndpoint: e.target.value })}
                          placeholder="/v1/chat/completions"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Default Model</label>
                        <input
                          type="text"
                          value={newAIProvider.defaultModel}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, defaultModel: e.target.value })}
                          placeholder="gpt-4"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">API Key Header</label>
                        <input
                          type="text"
                          value={newAIProvider.apiKeyHeader}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, apiKeyHeader: e.target.value })}
                          placeholder="Authorization"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">API Key Prefix</label>
                        <input
                          type="text"
                          value={newAIProvider.apiKeyPrefix}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, apiKeyPrefix: e.target.value })}
                          placeholder="Bearer "
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Request Format</label>
                        <select
                          value={newAIProvider.requestFormat}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, requestFormat: e.target.value as 'openai' | 'anthropic' | 'custom' })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                          <option value="openai">OpenAI Compatible</option>
                          <option value="anthropic">Anthropic Compatible</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newAIProvider.supportsStreaming}
                          onChange={(e) => setNewAIProvider({ ...newAIProvider, supportsStreaming: e.target.checked })}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-400">Supports Streaming</label>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddAIProvider(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                        Cancel
                      </button>
                      <button onClick={addCustomAIProvider} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm">
                        Add Provider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Web Scraping Section */}
        <section className="mb-6">
          <button
            onClick={() => toggleSection('scraping')}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Globe size={20} className="text-blue-400" />
              </span>
              <div className="text-left">
                <h2 className="text-lg font-semibold">Web Scraping</h2>
                <p className="text-sm text-gray-400">Configure web scraping for website cloning</p>
              </div>
            </div>
            {expandedSections.scraping ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.scraping && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-800">
              {/* Scraping Provider Selection */}
              <div className="p-4 bg-gray-800/30 rounded-lg">
                <label className="block font-medium mb-2">Active Scraping Provider</label>
                <select
                  value={(config.scrapingProvider as string) || 'jina'}
                  onChange={(e) => updateConfig('scrapingProvider', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <optgroup label="Built-in Providers">
                    {BUILT_IN_SCRAPING_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} {p.note && `(${p.note})`}</option>
                    ))}
                  </optgroup>
                  {customScrapingProviders.length > 0 && (
                    <optgroup label="Custom Providers">
                      {customScrapingProviders.map((p) => (
                        <option key={p.name} value={`custom:${p.name}`}>{p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Firecrawl API Key */}
              {(config.scrapingProvider === 'firecrawl') && (
                <div className="p-4 bg-gray-800/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Firecrawl API Key</span>
                      {keys['FIRECRAWL_API_KEY'] && <CheckCircle className="text-green-500" size={16} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-purple-400">
                        <ExternalLink size={16} />
                      </a>
                      <button onClick={() => setEditingKey('FIRECRAWL_API_KEY')} className="p-2 text-gray-400 hover:text-white">
                        <Key size={16} />
                      </button>
                    </div>
                  </div>
                  {editingKey === 'FIRECRAWL_API_KEY' && renderKeyInput('FIRECRAWL_API_KEY', showKey['FIRECRAWL_API_KEY'])}
                </div>
              )}

              {/* Custom Scraping Providers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Custom Scraping Providers</h3>
                  <button
                    onClick={() => setShowAddScrapingProvider(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    <Plus size={14} />
                    Add Custom
                  </button>
                </div>

                {customScrapingProviders.map((provider) => (
                  <div key={provider.name} className="p-4 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{provider.name}</span>
                        <p className="text-xs text-gray-500">{provider.baseUrl}{provider.scrapeEndpoint}</p>
                      </div>
                      <button onClick={() => removeCustomScrapingProvider(provider.name)} className="p-2 text-gray-400 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {showAddScrapingProvider && (
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-blue-500/30 space-y-4">
                    <h4 className="font-medium">Add Custom Scraping Provider</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Provider Name *</label>
                        <input
                          type="text"
                          value={newScrapingProvider.name}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, name: e.target.value })}
                          placeholder="My Scraper"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Base URL *</label>
                        <input
                          type="text"
                          value={newScrapingProvider.baseUrl}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, baseUrl: e.target.value })}
                          placeholder="https://api.myscraper.com"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Scrape Endpoint</label>
                        <input
                          type="text"
                          value={newScrapingProvider.scrapeEndpoint}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, scrapeEndpoint: e.target.value })}
                          placeholder="/api/scrape"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Request Method</label>
                        <select
                          value={newScrapingProvider.requestMethod}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, requestMethod: e.target.value as 'GET' | 'POST' })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">URL Parameter Name</label>
                        <input
                          type="text"
                          value={newScrapingProvider.urlParamName}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, urlParamName: e.target.value })}
                          placeholder="url"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Response Content Path</label>
                        <input
                          type="text"
                          value={newScrapingProvider.responseContentPath}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, responseContentPath: e.target.value })}
                          placeholder="data.content"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">API Key Header</label>
                        <input
                          type="text"
                          value={newScrapingProvider.apiKeyHeader}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, apiKeyHeader: e.target.value })}
                          placeholder="Authorization"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">API Key Prefix</label>
                        <input
                          type="text"
                          value={newScrapingProvider.apiKeyPrefix}
                          onChange={(e) => setNewScrapingProvider({ ...newScrapingProvider, apiKeyPrefix: e.target.value })}
                          placeholder="Bearer "
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddScrapingProvider(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                        Cancel
                      </button>
                      <button onClick={addCustomScrapingProvider} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                        Add Provider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Sandbox Section */}
        <section className="mb-6">
          <button
            onClick={() => toggleSection('sandbox')}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Server size={20} className="text-green-400" />
              </span>
              <div className="text-left">
                <h2 className="text-lg font-semibold">Code Sandbox</h2>
                <p className="text-sm text-gray-400">Configure code execution environment</p>
              </div>
            </div>
            {expandedSections.sandbox ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.sandbox && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-800">
              <div className="p-4 bg-gray-800/30 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium">Local Docker</h3>
                    <p className="text-sm text-gray-400">Run code locally using Docker</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dockerAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-400">
                      {dockerAvailable === null ? 'Checking...' : dockerAvailable ? 'Available' : 'Not available'}
                    </span>
                  </div>
                </div>

                <label className="block font-medium mb-2">Sandbox Provider</label>
                <select
                  value={(config.sandboxProvider as string) || 'docker'}
                  onChange={(e) => updateConfig('sandboxProvider', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value="docker">Local Docker (Recommended)</option>
                  <option value="e2b">E2B Cloud</option>
                  <option value="vercel">Vercel Sandbox</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Advanced Settings */}
        <section className="mb-6">
          <button
            onClick={() => toggleSection('advanced')}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-gray-600/20 rounded-lg flex items-center justify-center">
                <Settings2 size={20} className="text-gray-400" />
              </span>
              <div className="text-left">
                <h2 className="text-lg font-semibold">Advanced Settings</h2>
                <p className="text-sm text-gray-400">Model parameters and preferences</p>
              </div>
            </div>
            {expandedSections.advanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.advanced && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-800">
              <div className="p-4 bg-gray-800/30 rounded-lg">
                <label className="block font-medium mb-2">
                  Temperature: {(config.temperature as number) || 0.7}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={(config.temperature as number) || 0.7}
                  onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-400 mt-1">Lower = more focused, Higher = more creative</p>
              </div>

              <div className="p-4 bg-gray-800/30 rounded-lg">
                <label className="block font-medium mb-2">
                  Max Tokens: {(config.maxTokens as number) || 64000}
                </label>
                <input
                  type="range"
                  min="1000"
                  max="128000"
                  step="1000"
                  value={(config.maxTokens as number) || 64000}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
