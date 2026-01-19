import * as keytar from 'keytar'

const SERVICE_NAME = 'OpenLovableDesktop'

export type ApiKeyName =
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

const ALL_KEYS: ApiKeyName[] = [
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
  async setKey(keyName: ApiKeyName, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, keyName, value)
  }

  async getKey(keyName: ApiKeyName): Promise<string | null> {
    return await keytar.getPassword(SERVICE_NAME, keyName)
  }

  async deleteKey(keyName: ApiKeyName): Promise<boolean> {
    return await keytar.deletePassword(SERVICE_NAME, keyName)
  }

  async getAllKeys(): Promise<Record<ApiKeyName, string | null>> {
    const result: Partial<Record<ApiKeyName, string | null>> = {}
    for (const keyName of ALL_KEYS) {
      result[keyName] = await this.getKey(keyName)
    }
    return result as Record<ApiKeyName, string | null>
  }

  async hasRequiredKeys(): Promise<{ valid: boolean; missing: string[] }> {
    const firecrawl = await this.getKey('FIRECRAWL_API_KEY')
    const groq = await this.getKey('GROQ_API_KEY')
    const anthropic = await this.getKey('ANTHROPIC_API_KEY')
    const openai = await this.getKey('OPENAI_API_KEY')
    const gemini = await this.getKey('GEMINI_API_KEY')

    const missing: string[] = []

    if (!firecrawl) {
      missing.push('FIRECRAWL_API_KEY')
    }

    // At least one AI provider is required
    const hasAiProvider = groq || anthropic || openai || gemini
    if (!hasAiProvider) {
      missing.push('At least one AI provider (GROQ, ANTHROPIC, OPENAI, or GEMINI)')
    }

    return {
      valid: missing.length === 0,
      missing,
    }
  }
}
