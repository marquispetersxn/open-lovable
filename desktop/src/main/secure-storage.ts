import * as keytar from 'keytar'

const SERVICE_NAME = 'OpenLovableDesktop'

// Built-in provider keys
export type BuiltInKeyName =
  | 'FIRECRAWL_API_KEY'
  | 'GROQ_API_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'OPENAI_API_KEY'
  | 'GEMINI_API_KEY'
  | 'E2B_API_KEY'
  | 'VERCEL_TOKEN'
  | 'VERCEL_TEAM_ID'
  | 'VERCEL_PROJECT_ID'
  | 'MORPH_API_KEY'

const BUILT_IN_KEYS: BuiltInKeyName[] = [
  'FIRECRAWL_API_KEY',
  'GROQ_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'E2B_API_KEY',
  'VERCEL_TOKEN',
  'VERCEL_TEAM_ID',
  'VERCEL_PROJECT_ID',
  'MORPH_API_KEY',
]

export class SecureStorage {
  // Set any key (built-in or custom)
  async setKey(keyName: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, keyName, value)
  }

  // Get any key (built-in or custom)
  async getKey(keyName: string): Promise<string | null> {
    return await keytar.getPassword(SERVICE_NAME, keyName)
  }

  // Delete any key (built-in or custom)
  async deleteKey(keyName: string): Promise<boolean> {
    return await keytar.deletePassword(SERVICE_NAME, keyName)
  }

  // Get all built-in keys
  async getAllBuiltInKeys(): Promise<Record<BuiltInKeyName, string | null>> {
    const result: Partial<Record<BuiltInKeyName, string | null>> = {}
    for (const keyName of BUILT_IN_KEYS) {
      result[keyName] = await this.getKey(keyName)
    }
    return result as Record<BuiltInKeyName, string | null>
  }

  // Get all keys including custom provider keys
  async getAllKeys(customKeyNames: string[] = []): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {}

    // Get built-in keys
    for (const keyName of BUILT_IN_KEYS) {
      result[keyName] = await this.getKey(keyName)
    }

    // Get custom provider keys
    for (const keyName of customKeyNames) {
      result[keyName] = await this.getKey(keyName)
    }

    return result
  }

  // Helper to generate custom provider key name
  getCustomKeyName(providerName: string): string {
    return `CUSTOM_${providerName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
  }

  // Store a custom provider API key
  async setCustomProviderKey(providerName: string, value: string): Promise<void> {
    const keyName = this.getCustomKeyName(providerName)
    await this.setKey(keyName, value)
  }

  // Get a custom provider API key
  async getCustomProviderKey(providerName: string): Promise<string | null> {
    const keyName = this.getCustomKeyName(providerName)
    return await this.getKey(keyName)
  }

  // Delete a custom provider API key
  async deleteCustomProviderKey(providerName: string): Promise<boolean> {
    const keyName = this.getCustomKeyName(providerName)
    return await this.deleteKey(keyName)
  }

  // Validate required keys based on selected providers
  async hasRequiredKeys(
    aiProvider: string,
    scrapingProvider: string,
    customAIProviderName?: string,
    customScrapingProviderName?: string
  ): Promise<{ valid: boolean; missing: string[] }> {
    const missing: string[] = []

    // Check AI provider
    if (aiProvider === 'custom' && customAIProviderName) {
      const customKey = await this.getCustomProviderKey(customAIProviderName)
      if (!customKey) {
        missing.push(`Custom AI Provider (${customAIProviderName}) API Key`)
      }
    } else if (aiProvider !== 'custom') {
      const aiKeys: Record<string, BuiltInKeyName> = {
        groq: 'GROQ_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        google: 'GEMINI_API_KEY',
      }
      const keyName = aiKeys[aiProvider]
      if (keyName) {
        const key = await this.getKey(keyName)
        if (!key) {
          missing.push(`${aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} API Key`)
        }
      }
    }

    // Check scraping provider
    if (scrapingProvider === 'custom' && customScrapingProviderName) {
      const customKey = await this.getCustomProviderKey(customScrapingProviderName)
      if (!customKey) {
        missing.push(`Custom Scraping Provider (${customScrapingProviderName}) API Key`)
      }
    } else if (scrapingProvider === 'firecrawl') {
      const firecrawlKey = await this.getKey('FIRECRAWL_API_KEY')
      if (!firecrawlKey) {
        missing.push('Firecrawl API Key')
      }
    }
    // 'jina' and 'local' don't require API keys

    return {
      valid: missing.length === 0,
      missing,
    }
  }
}

export type { BuiltInKeyName }
