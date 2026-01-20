import Store from 'electron-store'

// Custom provider configuration
interface CustomProvider {
  name: string
  baseUrl: string
  apiKeyHeader: string  // e.g., 'Authorization', 'X-API-Key', 'Bearer'
  apiKeyPrefix: string  // e.g., 'Bearer ', 'Api-Key ', ''
  enabled: boolean
}

interface CustomAIProvider extends CustomProvider {
  modelEndpoint: string      // e.g., '/v1/chat/completions'
  modelsListEndpoint?: string // e.g., '/v1/models'
  defaultModel: string
  supportsStreaming: boolean
  requestFormat: 'openai' | 'anthropic' | 'custom'
  // For custom format, define the request/response mapping
  customRequestTemplate?: string
  customResponsePath?: string  // JSON path to extract response, e.g., 'choices[0].message.content'
}

interface CustomScrapingProvider extends CustomProvider {
  scrapeEndpoint: string     // e.g., '/api/scrape'
  requestMethod: 'GET' | 'POST'
  urlParamName: string       // e.g., 'url' for POST body or query param
  responseContentPath: string // JSON path to content, e.g., 'data.content' or 'markdown'
  supportsScreenshot: boolean
  screenshotPath?: string    // JSON path to screenshot data
}

interface AppConfig {
  // AI Settings
  aiProvider: 'groq' | 'anthropic' | 'openai' | 'google' | 'custom'
  defaultModel: string
  temperature: number
  maxTokens: number
  customAIProviders: CustomAIProvider[]
  activeCustomAIProvider: string  // name of active custom provider

  // Web Scraping Settings
  scrapingProvider: 'firecrawl' | 'jina' | 'custom' | 'local'
  customScrapingProviders: CustomScrapingProvider[]
  activeCustomScrapingProvider: string

  // Sandbox Settings
  sandboxProvider: 'vercel' | 'e2b' | 'docker'
  sandboxTimeout: number

  // UI Settings
  theme: 'dark' | 'light' | 'system'
  defaultStyle: string

  // Projects
  projectsDirectory: string
  recentProjects: string[]
}

const defaults: AppConfig = {
  // AI defaults
  aiProvider: 'groq',
  defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  temperature: 0.7,
  maxTokens: 64000,
  customAIProviders: [],
  activeCustomAIProvider: '',

  // Scraping defaults
  scrapingProvider: 'jina',  // Jina is free, no API key needed
  customScrapingProviders: [],
  activeCustomScrapingProvider: '',

  // Sandbox defaults
  sandboxProvider: 'docker',
  sandboxTimeout: 300000,

  // UI defaults
  theme: 'dark',
  defaultStyle: 'modern',

  // Projects
  projectsDirectory: '',
  recentProjects: [],
}

export class ConfigStore {
  private store: Store<AppConfig>

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'open-lovable-config',
      defaults,
    })
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.store.get(key)
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value)
  }

  getAll(): AppConfig {
    return this.store.store
  }

  reset(): void {
    this.store.clear()
  }

  // Custom AI Provider management
  addCustomAIProvider(provider: CustomAIProvider): void {
    const providers = this.get('customAIProviders')
    const existing = providers.findIndex((p) => p.name === provider.name)
    if (existing >= 0) {
      providers[existing] = provider
    } else {
      providers.push(provider)
    }
    this.set('customAIProviders', providers)
  }

  removeCustomAIProvider(name: string): void {
    const providers = this.get('customAIProviders')
    this.set('customAIProviders', providers.filter((p) => p.name !== name))
  }

  getActiveAIProvider(): CustomAIProvider | null {
    const name = this.get('activeCustomAIProvider')
    const providers = this.get('customAIProviders')
    return providers.find((p) => p.name === name) || null
  }

  // Custom Scraping Provider management
  addCustomScrapingProvider(provider: CustomScrapingProvider): void {
    const providers = this.get('customScrapingProviders')
    const existing = providers.findIndex((p) => p.name === provider.name)
    if (existing >= 0) {
      providers[existing] = provider
    } else {
      providers.push(provider)
    }
    this.set('customScrapingProviders', providers)
  }

  removeCustomScrapingProvider(name: string): void {
    const providers = this.get('customScrapingProviders')
    this.set('customScrapingProviders', providers.filter((p) => p.name !== name))
  }

  getActiveScrapingProvider(): CustomScrapingProvider | null {
    const name = this.get('activeCustomScrapingProvider')
    const providers = this.get('customScrapingProviders')
    return providers.find((p) => p.name === name) || null
  }

  addRecentProject(projectPath: string): void {
    const recent = this.get('recentProjects')
    const updated = [projectPath, ...recent.filter((p) => p !== projectPath)].slice(0, 10)
    this.set('recentProjects', updated)
  }
}

export type { CustomAIProvider, CustomScrapingProvider, AppConfig }
