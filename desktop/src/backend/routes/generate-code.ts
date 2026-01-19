import { Router, Request, Response } from 'express'
import { createGroq } from '@ai-sdk/groq'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'
import { SecureStorage } from '../../main/secure-storage'
import { ConfigStore } from '../../main/config-store'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ConversationState {
  conversationId: string
  messages: ConversationMessage[]
  currentFiles: Record<string, string>
}

// In-memory conversation state (will be persisted later)
let conversationState: ConversationState | null = null

export function createGenerateCodeRoute(
  secureStorage: SecureStorage,
  configStore: ConfigStore
): Router {
  const router = Router()

  router.post('/generate-ai-code-stream', async (req: Request, res: Response) => {
    try {
      const { prompt, model, context, isEdit = false } = req.body

      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' })
      }

      // Get API keys from secure storage
      const groqKey = await secureStorage.getKey('GROQ_API_KEY')
      const anthropicKey = await secureStorage.getKey('ANTHROPIC_API_KEY')
      const openaiKey = await secureStorage.getKey('OPENAI_API_KEY')
      const geminiKey = await secureStorage.getKey('GEMINI_API_KEY')

      // Determine which provider to use based on model
      let provider: ReturnType<typeof createGroq | typeof createAnthropic | typeof createOpenAI | typeof createGoogleGenerativeAI>
      let actualModel = model || configStore.get('defaultModel')

      if (actualModel.startsWith('anthropic/') && anthropicKey) {
        provider = createAnthropic({ apiKey: anthropicKey })
        actualModel = actualModel.replace('anthropic/', '')
      } else if (actualModel.startsWith('openai/') && openaiKey) {
        provider = createOpenAI({ apiKey: openaiKey })
        actualModel = actualModel.replace('openai/', '')
      } else if (actualModel.startsWith('google/') && geminiKey) {
        provider = createGoogleGenerativeAI({ apiKey: geminiKey })
        actualModel = actualModel.replace('google/', '')
      } else if (groqKey) {
        provider = createGroq({ apiKey: groqKey })
        // Default to Groq with Kimi model
        if (actualModel.includes('kimi') || !actualModel.includes('/')) {
          actualModel = 'moonshotai/kimi-k2-instruct-0905'
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'No AI provider configured. Please add at least one API key in Settings.',
        })
      }

      // Initialize conversation state
      if (!conversationState) {
        conversationState = {
          conversationId: `conv-${Date.now()}`,
          messages: [],
          currentFiles: {},
        }
      }

      // Add user message
      conversationState.messages.push({
        id: `msg-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      })

      // Keep conversation manageable
      if (conversationState.messages.length > 20) {
        conversationState.messages = conversationState.messages.slice(-15)
      }

      // Update current files from context
      if (context?.currentFiles) {
        conversationState.currentFiles = context.currentFiles
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const sendEvent = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      sendEvent({ type: 'status', message: 'Initializing AI...' })

      // Build system prompt
      const systemPrompt = buildSystemPrompt(isEdit, context, conversationState)

      // Build messages for AI
      const aiMessages = buildAIMessages(prompt, conversationState, context)

      sendEvent({ type: 'status', message: 'Generating code...' })

      // Stream the response
      const result = await streamText({
        model: provider(actualModel),
        system: systemPrompt,
        messages: aiMessages,
        temperature: configStore.get('temperature'),
        maxTokens: configStore.get('maxTokens'),
      })

      let fullResponse = ''

      for await (const chunk of result.textStream) {
        fullResponse += chunk
        sendEvent({ type: 'stream', content: chunk })
      }

      // Extract code from response
      const codeMatch = fullResponse.match(/```(?:tsx?|jsx?|html)?\n([\s\S]*?)```/)
      const generatedCode = codeMatch ? codeMatch[1].trim() : fullResponse

      // Add assistant message to conversation
      conversationState.messages.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      })

      sendEvent({
        type: 'complete',
        code: generatedCode,
        fullResponse,
      })

      res.end()
    } catch (error) {
      console.error('[generate-code] Error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Reset conversation
  router.post('/reset-conversation', (_, res) => {
    conversationState = null
    res.json({ success: true })
  })

  return router
}

function buildSystemPrompt(
  isEdit: boolean,
  context: { scrapedContent?: string; style?: string },
  conversation: ConversationState
): string {
  let prompt = `You are an expert React developer. Generate clean, modern React components using TypeScript and Tailwind CSS.

IMPORTANT RULES:
1. Always use functional components with hooks
2. Use Tailwind CSS for all styling - no inline styles or CSS files
3. Make components responsive and accessible
4. Include proper TypeScript types
5. Use semantic HTML elements
6. Add hover states and transitions for interactive elements
7. Export components as default exports

OUTPUT FORMAT:
- Wrap your code in \`\`\`tsx code blocks
- Include all necessary imports
- Make the component self-contained and ready to use
`

  if (isEdit && Object.keys(conversation.currentFiles).length > 0) {
    prompt += `\n\nYou are editing an existing project. Here are the current files:\n`
    for (const [filename, content] of Object.entries(conversation.currentFiles)) {
      if (filename.endsWith('.tsx') || filename.endsWith('.ts')) {
        prompt += `\n--- ${filename} ---\n${content}\n`
      }
    }
    prompt += `\nMake targeted edits to the relevant files based on the user's request.`
  }

  if (context?.scrapedContent) {
    prompt += `\n\nReference content from scraped website:\n${context.scrapedContent}`
  }

  if (context?.style) {
    prompt += `\n\nApply this design style: ${context.style}`
  }

  return prompt
}

function buildAIMessages(
  prompt: string,
  conversation: ConversationState,
  context: { scrapedContent?: string }
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // Include recent conversation history
  const recentMessages = conversation.messages.slice(-6)
  for (const msg of recentMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    }
  }

  // If the last message isn't the current prompt, add it
  if (messages.length === 0 || messages[messages.length - 1].content !== prompt) {
    messages.push({ role: 'user', content: prompt })
  }

  return messages
}
