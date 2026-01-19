import { Router, Request, Response } from 'express'
import FirecrawlApp from '@mendable/firecrawl-js'
import { SecureStorage } from '../../main/secure-storage'

export function createScrapeUrlRoute(secureStorage: SecureStorage): Router {
  const router = Router()

  router.post('/scrape-url', async (req: Request, res: Response) => {
    try {
      const { url } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
      if (!firecrawlKey) {
        return res.status(400).json({
          success: false,
          error: 'Firecrawl API key not configured. Please add it in Settings.',
        })
      }

      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })

      console.log(`[scrape-url] Scraping: ${url}`)

      const result = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html'],
      })

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to scrape URL',
        })
      }

      res.json({
        success: true,
        content: result.markdown || result.html,
        metadata: result.metadata,
      })
    } catch (error) {
      console.error('[scrape-url] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/scrape-url-enhanced', async (req: Request, res: Response) => {
    try {
      const { url, options = {} } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
      if (!firecrawlKey) {
        return res.status(400).json({
          success: false,
          error: 'Firecrawl API key not configured. Please add it in Settings.',
        })
      }

      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })

      console.log(`[scrape-url-enhanced] Scraping: ${url}`)

      const result = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html', 'screenshot'],
        ...options,
      })

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to scrape URL',
        })
      }

      res.json({
        success: true,
        content: result.markdown || result.html,
        html: result.html,
        screenshot: result.screenshot,
        metadata: result.metadata,
      })
    } catch (error) {
      console.error('[scrape-url-enhanced] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/extract-brand-styles', async (req: Request, res: Response) => {
    try {
      const { url } = req.body

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' })
      }

      const firecrawlKey = await secureStorage.getKey('FIRECRAWL_API_KEY')
      if (!firecrawlKey) {
        return res.status(400).json({
          success: false,
          error: 'Firecrawl API key not configured.',
        })
      }

      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey })

      const result = await firecrawl.scrapeUrl(url, {
        formats: ['html'],
      })

      if (!result.success || !result.html) {
        return res.status(500).json({
          success: false,
          error: 'Failed to extract brand styles',
        })
      }

      // Extract colors, fonts, and other styles from HTML
      const styles = extractStylesFromHTML(result.html)

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
