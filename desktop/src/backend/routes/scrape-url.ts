import { Router, Request, Response } from 'express'
import FirecrawlApp from '@mendable/firecrawl-js'
import { SecureStorage } from '../../main/secure-storage'
import { ConfigStore, CustomScrapingProvider } from '../../main/config-store'

export function createScrapeUrlRoute(
  secureStorage: SecureStorage,
  configStore?: ConfigStore
): Router {
  const router = Router()

  // Helper to get nested value from object using path like "data.content"
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  // Scrape using Jina AI Reader (free, no API key needed)
  async function scrapeWithJina(url: string): Promise<{ content: string; success: boolean }> {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`
      const response = await fetch(jinaUrl, {
        headers: {
          Accept: 'text/plain',
        },
      })

      if (!response.ok) {
        throw new Error(`Jina returned ${response.status}`)
      }

      const content = await response.text()
      return { content, success: true }
    } catch (error) {
      console.error('[scrape-jina] Error:', error)
      throw error
    }
  }

  // Scrape using Firecrawl
  async function scrapeWithFirecrawl(
    url: string,
    apiKey: string,
    options: Record<string, unknown> = {}
  ): Promise<{ content: string; html?: string; screenshot?: string; metadata?: unknown; success: boolean }> {
    const firecrawl = new FirecrawlApp({ apiKey })
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      ...options,
    })

    if (!result.success) {
      throw new Error('Firecrawl failed to scrape URL')
    }

    return {
      content: result.markdown || result.html || '',
      html: result.html,
      screenshot: result.screenshot,
      metadata: result.metadata,
      success: true,
    }
  }

  // Scrape using custom provider
  async function scrapeWithCustomProvider(
    url: string,
    provider: CustomScrapingProvider,
    apiKey: string | null
  ): Promise<{ content: string; success: boolean }> {
    const fullUrl = `${provider.baseUrl}${provider.scrapeEndpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey && provider.apiKeyHeader) {
      headers[provider.apiKeyHeader] = `${provider.apiKeyPrefix}${apiKey}`
    }

    let response: Response

    if (provider.requestMethod === 'POST') {
      response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ [provider.urlParamName]: url }),
      })
    } else {
      const params = new URLSearchParams({ [provider.urlParamName]: url })
      response = await fetch(`${fullUrl}?${params}`, {
        method: 'GET',
        headers,
      })
    }

    if (!response.ok) {
      throw new Error(`Custom provider returned ${response.status}`)
    }

    const data = await response.json()
    const content = getNestedValue(data, provider.responseContentPath)

    if (typeof content !== 'string') {
      throw new Error(`Could not extract content from response using path: ${provider.responseContentPath}`)
    }

    return { content, success: true }
  }

  // Main scrape endpoint
  router.post('/scrape-url', async (req: Request, res: Response) => {
    try {
      const { url, provider: requestedProvider } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      // Get active provider from config or use requested one
      const activeProvider = requestedProvider || configStore?.get('scrapingProvider') || 'jina'

      console.log(`[scrape-url] Scraping ${url} with provider: ${activeProvider}`)

      let result: { content: string; success: boolean; html?: string; metadata?: unknown }

      if (activeProvider === 'jina') {
        // Use Jina AI Reader (free)
        result = await scrapeWithJina(url)
      } else if (activeProvider === 'firecrawl') {
        // Use Firecrawl
        const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
        if (!firecrawlKey) {
          return res.status(400).json({
            success: false,
            error: 'Firecrawl API key not configured. Please add it in Settings.',
          })
        }
        result = await scrapeWithFirecrawl(url, firecrawlKey)
      } else if (activeProvider === 'local') {
        // Local scraping - for now fallback to Jina
        // TODO: Implement Puppeteer-based local scraping
        result = await scrapeWithJina(url)
      } else if (activeProvider.startsWith('custom:')) {
        // Custom provider
        const providerName = activeProvider.replace('custom:', '')
        const customProviders = configStore?.get('customScrapingProviders') || []
        const customProvider = customProviders.find((p: CustomScrapingProvider) => p.name === providerName)

        if (!customProvider) {
          return res.status(400).json({
            success: false,
            error: `Custom provider "${providerName}" not found`,
          })
        }

        const apiKey = await secureStorage.getCustomProviderKey(providerName)
        result = await scrapeWithCustomProvider(url, customProvider, apiKey)
      } else {
        return res.status(400).json({
          success: false,
          error: `Unknown scraping provider: ${activeProvider}`,
        })
      }

      res.json({
        success: true,
        content: result.content,
        html: result.html,
        metadata: result.metadata,
        provider: activeProvider,
      })
    } catch (error) {
      console.error('[scrape-url] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Enhanced scrape with more options
  router.post('/scrape-url-enhanced', async (req: Request, res: Response) => {
    try {
      const { url, options = {}, provider: requestedProvider } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      const activeProvider = requestedProvider || configStore?.get('scrapingProvider') || 'jina'

      console.log(`[scrape-url-enhanced] Scraping ${url} with provider: ${activeProvider}`)

      // For enhanced scraping, prefer Firecrawl if available as it supports screenshots
      if (activeProvider === 'firecrawl') {
        const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
        if (firecrawlKey) {
          const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })
          const result = await firecrawl.scrapeUrl(url, {
            formats: ['markdown', 'html', 'screenshot'],
            ...options,
          })

          if (result.success) {
            return res.json({
              success: true,
              content: result.markdown || result.html,
              html: result.html,
              screenshot: result.screenshot,
              metadata: result.metadata,
            })
          }
        }
      }

      // Fallback to regular scraping
      const result = await scrapeWithJina(url)
      res.json({
        success: true,
        content: result.content,
      })
    } catch (error) {
      console.error('[scrape-url-enhanced] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Extract brand styles
  router.post('/extract-brand-styles', async (req: Request, res: Response) => {
    try {
      const { url } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      // Try to get HTML content
      let html: string | undefined

      const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
      if (firecrawlKey) {
        try {
          const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })
          const result = await firecrawl.scrapeUrl(url, { formats: ['html'] })
          if (result.success) {
            html = result.html
          }
        } catch {
          // Fallback
        }
      }

      if (!html) {
        // Try fetching directly
        const response = await fetch(url)
        html = await response.text()
      }

      const styles = extractStylesFromHTML(html)

      res.json({
        success: true,
        styles,
      })
    } catch (error) {
      console.error('[extract-brand-styles] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  return router
}

function extractStylesFromHTML(html: string): {
  colors: string[]
  fonts: string[]
  spacing: string[]
} {
  const colors: Set<string> = new Set()
  const fonts: Set<string> = new Set()

  // Extract hex colors
  const hexColors = html.match(/#[0-9A-Fa-f]{3,8}/g) || []
  hexColors.forEach((c) => colors.add(c.toLowerCase()))

  // Extract rgb/rgba colors
  const rgbColors = html.match(/rgba?\([^)]+\)/g) || []
  rgbColors.forEach((c) => colors.add(c))

  // Extract font families
  const fontFamilies = html.match(/font-family:\s*([^;}"']+)/gi) || []
  fontFamilies.forEach((f) => {
    const family = f.replace(/font-family:\s*/i, '').trim()
    fonts.add(family)
  })

  return {
    colors: Array.from(colors).slice(0, 20),
    fonts: Array.from(fonts).slice(0, 10),
    spacing: ['4px', '8px', '16px', '24px', '32px', '48px', '64px'],
  }
}
