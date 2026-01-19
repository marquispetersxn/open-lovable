import { Router, Request, Response } from 'express'
import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import { SecureStorage } from '../../main/secure-storage'
import { ConfigStore } from '../../main/config-store'

export function createAnalyzeEditRoute(
  secureStorage: SecureStorage,
  configStore: ConfigStore
): Router {
  const router = Router()

  router.post('/analyze-edit-intent', async (req: Request, res: Response) => {
    try {
      const { prompt, currentFiles, fileManifest } = req.body

      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' })
      }

      const groqKey = await secureStorage.getKey('GROQ_API_KEY')
      if (!groqKey) {
        return res.status(400).json({
          success: false,
          error: 'No AI provider configured for edit analysis.',
        })
      }

      const groq = createGroq({ apiKey: groqKey })

      // Build file list for context
      const fileList = Object.keys(currentFiles || {}).join('\n')

      const analysisPrompt = `Analyze this edit request and determine which files need to be modified.

User request: "${prompt}"

Available files:
${fileList}

Respond with a JSON object containing:
{
  "intent": "brief description of what the user wants",
  "targetFiles": ["list of files to modify"],
  "editType": "add" | "modify" | "delete" | "refactor",
  "confidence": 0.0-1.0
}

Only respond with the JSON object, no other text.`

      const result = await generateText({
        model: groq('llama-3.1-70b-versatile'),
        prompt: analysisPrompt,
        temperature: 0.3,
        maxTokens: 1000,
      })

      // Parse the response
      let analysis
      try {
        analysis = JSON.parse(result.text)
      } catch {
        // If parsing fails, provide a default response
        analysis = {
          intent: prompt,
          targetFiles: Object.keys(currentFiles || {}).filter(
            (f) => f.endsWith('.tsx') || f.endsWith('.ts')
          ),
          editType: 'modify',
          confidence: 0.5,
        }
      }

      res.json({
        success: true,
        analysis,
      })
    } catch (error) {
      console.error('[analyze-edit] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  return router
}
