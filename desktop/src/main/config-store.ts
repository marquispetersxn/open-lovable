import Store from 'electron-store'

interface AppConfig {
  // AI Settings
  defaultModel: string
  temperature: number
  maxTokens: number

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
  defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  temperature: 0.7,
  maxTokens: 64000,
  sandboxProvider: 'docker',
  sandboxTimeout: 300000,
  theme: 'dark',
  defaultStyle: 'modern',
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

  addRecentProject(projectPath: string): void {
    const recent = this.get('recentProjects')
    const updated = [projectPath, ...recent.filter((p) => p !== projectPath)].slice(0, 10)
    this.set('recentProjects', updated)
  }
}
