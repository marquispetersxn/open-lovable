import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { SecureStorage } from './secure-storage'
import { ConfigStore } from './config-store'

// Route handlers
import { createGenerateCodeRoute } from '../backend/routes/generate-code'
import { createScrapeUrlRoute } from '../backend/routes/scrape-url'
import { createSandboxRoutes } from '../backend/routes/sandbox'
import { createAnalyzeEditRoute } from '../backend/routes/analyze-edit'

const secureStorage = new SecureStorage()
const configStore = new ConfigStore()

export async function startBackendServer(): Promise<number> {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '50mb' }))

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok' })
  })

  // Get configuration
  app.get('/api/config', async (_, res) => {
    const config = configStore.getAll()
    res.json(config)
  })

  // Update configuration
  app.post('/api/config', async (req, res) => {
    const { key, value } = req.body
    configStore.set(key, value)
    res.json({ success: true })
  })

  // API key validation endpoint
  app.get('/api/validate-keys', async (_, res) => {
    const aiProvider = configStore.get('aiProvider') || 'groq'
    const scrapingProvider = configStore.get('scrapingProvider') || 'jina'
    const customAIProvider = aiProvider.startsWith('custom:') ? aiProvider.replace('custom:', '') : undefined
    const customScrapingProvider = scrapingProvider.startsWith('custom:') ? scrapingProvider.replace('custom:', '') : undefined

    const validation = await secureStorage.hasRequiredKeys(
      aiProvider.startsWith('custom:') ? 'custom' : aiProvider,
      scrapingProvider.startsWith('custom:') ? 'custom' : scrapingProvider,
      customAIProvider,
      customScrapingProvider
    )
    res.json(validation)
  })

  // Mount route handlers
  app.use('/api', createGenerateCodeRoute(secureStorage, configStore))
  app.use('/api', createScrapeUrlRoute(secureStorage, configStore))
  app.use('/api', createSandboxRoutes(secureStorage, configStore))
  app.use('/api', createAnalyzeEditRoute(secureStorage, configStore))

  // Find available port
  const server = createServer(app)

  return new Promise((resolve, reject) => {
    // Try ports starting from 3001
    const tryPort = (port: number) => {
      server.listen(port, '127.0.0.1')
        .once('listening', () => {
          console.log(`Backend server listening on port ${port}`)
          resolve(port)
        })
        .once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            server.close()
            tryPort(port + 1)
          } else {
            reject(err)
          }
        })
    }
    tryPort(3001)
  })
}
