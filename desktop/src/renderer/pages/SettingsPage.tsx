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
} from 'lucide-react'

interface SettingsPageProps {
  onKeysUpdated: () => void
}

interface ApiKeyConfig {
  name: string
  envKey: string
  description: string
  required: boolean
  url: string
  category: 'ai' | 'services' | 'sandbox'
}

const API_KEYS: ApiKeyConfig[] = [
  {
    name: 'Firecrawl',
    envKey: 'FIRECRAWL_API_KEY',
    description: 'Required for web scraping and website cloning',
    required: true,
    url: 'https://firecrawl.dev',
    category: 'services',
  },
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    description: 'Fast inference with Llama and Kimi models',
    required: false,
    url: 'https://console.groq.com',
    category: 'ai',
  },
  {
    name: 'Anthropic (Claude)',
    envKey: 'ANTHROPIC_API_KEY',
    description: 'Claude models for high-quality code generation',
    required: false,
    url: 'https://console.anthropic.com',
    category: 'ai',
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    description: 'GPT models for code generation',
    required: false,
    url: 'https://platform.openai.com',
    category: 'ai',
  },
  {
    name: 'Google (Gemini)',
    envKey: 'GEMINI_API_KEY',
    description: 'Gemini models for code generation',
    required: false,
    url: 'https://aistudio.google.com',
    category: 'ai',
  },
  {
    name: 'E2B',
    envKey: 'E2B_API_KEY',
    description: 'Cloud sandbox for code execution',
    required: false,
    url: 'https://e2b.dev',
    category: 'sandbox',
  },
  {
    name: 'Vercel Token',
    envKey: 'VERCEL_TOKEN',
    description: 'Vercel sandbox for code execution',
    required: false,
    url: 'https://vercel.com/account/tokens',
    category: 'sandbox',
  },
  {
    name: 'Morph (Fast Apply)',
    envKey: 'MORPH_API_KEY',
    description: 'Optional - faster code editing',
    required: false,
    url: 'https://morphllm.com',
    category: 'services',
  },
]

export default function SettingsPage({ onKeysUpdated }: SettingsPageProps) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null)

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
    } catch (error) {
      toast.error('Failed to save API key')
    }
  }

  const deleteKey = async (envKey: string) => {
    try {
      await window.electronAPI?.deleteApiKey(envKey)
      toast.success('API key deleted')
      loadSettings()
      onKeysUpdated()
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  const updateConfig = async (key: string, value: unknown) => {
    try {
      await window.electronAPI?.setConfig(key, value)
      setConfig((prev) => ({ ...prev, [key]: value }))
      toast.success('Setting updated')
    } catch (error) {
      toast.error('Failed to update setting')
    }
  }

  const hasAtLeastOneAiKey = API_KEYS.filter((k) => k.category === 'ai').some(
    (k) => keys[k.envKey]
  )

  const renderKeyRow = (keyConfig: ApiKeyConfig) => {
    const isEditing = editingKey === keyConfig.envKey
    const hasKey = !!keys[keyConfig.envKey]
    const isVisible = showKey[keyConfig.envKey]

    return (
      <div
        key={keyConfig.envKey}
        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{keyConfig.name}</span>
            {keyConfig.required && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                Required
              </span>
            )}
            {hasKey && (
              <CheckCircle className="text-green-500" size={16} />
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{keyConfig.description}</p>

          {isEditing ? (
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
                onClick={() => setShowKey((prev) => ({ ...prev, [keyConfig.envKey]: !isVisible }))}
                className="p-2 text-gray-400 hover:text-white"
              >
                {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                onClick={() => saveKey(keyConfig.envKey)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm flex items-center gap-1"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={() => {
                  setEditingKey(null)
                  setNewKeyValue('')
                }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          ) : hasKey ? (
            <div className="mt-2 flex items-center gap-2">
              <code className="text-sm text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                {keys[keyConfig.envKey]}
              </code>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <a
            href={keyConfig.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
            title="Get API key"
          >
            <ExternalLink size={18} />
          </a>
          {!isEditing && (
            <>
              <button
                onClick={() => setEditingKey(keyConfig.envKey)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title={hasKey ? 'Update key' : 'Add key'}
              >
                <Key size={18} />
              </button>
              {hasKey && (
                <button
                  onClick={() => deleteKey(keyConfig.envKey)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete key"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 mb-8">
          Configure your API keys and preferences for Open Lovable Desktop
        </p>

        {/* Status Banner */}
        {!hasAtLeastOneAiKey && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-amber-400">Setup Required</h3>
              <p className="text-sm text-gray-400">
                You need to configure at least one AI provider (Groq, Anthropic,
                OpenAI, or Google) and the Firecrawl API key to use Open Lovable.
              </p>
            </div>
          </div>
        )}

        {/* AI Providers */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-600/20 rounded flex items-center justify-center">
              <Wand2 size={18} className="text-purple-400" />
            </span>
            AI Providers
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Configure at least one AI provider for code generation.
          </p>
          <div className="space-y-3">
            {API_KEYS.filter((k) => k.category === 'ai').map(renderKeyRow)}
          </div>
        </section>

        {/* Services */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center">
              <Key size={18} className="text-blue-400" />
            </span>
            Services
          </h2>
          <div className="space-y-3">
            {API_KEYS.filter((k) => k.category === 'services').map(renderKeyRow)}
          </div>
        </section>

        {/* Sandbox Providers */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-600/20 rounded flex items-center justify-center">
              <Server size={18} className="text-green-400" />
            </span>
            Sandbox Providers
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Choose how to run and preview generated code.
          </p>

          {/* Docker Status */}
          <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Local Docker</h3>
                <p className="text-sm text-gray-400">
                  Run code locally using Docker containers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    dockerAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-400">
                  {dockerAvailable === null
                    ? 'Checking...'
                    : dockerAvailable
                    ? 'Available'
                    : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          {/* Sandbox Provider Selection */}
          <div className="p-4 bg-gray-800/50 rounded-lg mb-4">
            <label className="block font-medium mb-2">Default Sandbox Provider</label>
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

          {/* Cloud Sandbox Keys */}
          <div className="space-y-3">
            {API_KEYS.filter((k) => k.category === 'sandbox').map(renderKeyRow)}
          </div>
        </section>

        {/* Model Settings */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Model Settings</h2>

          <div className="space-y-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <label className="block font-medium mb-2">Default AI Model</label>
              <select
                value={(config.defaultModel as string) || 'moonshotai/kimi-k2-instruct-0905'}
                onChange={(e) => updateConfig('defaultModel', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              >
                <optgroup label="Groq">
                  <option value="moonshotai/kimi-k2-instruct-0905">Kimi K2 (Fast)</option>
                  <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="anthropic/claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="anthropic/claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="google/gemini-1.5-pro">Gemini 1.5 Pro</option>
                </optgroup>
              </select>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg">
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
              <p className="text-sm text-gray-400 mt-1">
                Lower = more focused, Higher = more creative
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// Add missing icon import
function Wand2(props: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" />
      <path d="m14 7 3 3" />
      <path d="M5 6v4" />
      <path d="M19 14v4" />
      <path d="M10 2v2" />
      <path d="M7 8H3" />
      <path d="M21 16h-4" />
      <path d="M11 3H9" />
    </svg>
  )
}
