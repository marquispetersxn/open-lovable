import { Router, Request, Response } from 'express'
import { createGroq } from '@ai-sdk/groq'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'
import { SecureStorage } from '../../main/secure-storage'
import { ConfigStore, CustomAIProvider } from '../../main/config-store'

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

  // Helper to call custom AI provider
  async function callCustomProvider(
    provider: CustomAIProvider,
    apiKey: string,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const url = `${provider.baseUrl}${provider.modelEndpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey && provider.apiKeyHeader) {
      headers[provider.apiKeyHeader] = `${provider.apiKeyPrefix}${apiKey}`
    }

    let requestBody: Record<string, unknown>

    if (provider.requestFormat === 'openai') {
      requestBody = {
        model: provider.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: provider.supportsStreaming,
        temperature: configStore.get('temperature'),
        max_tokens: configStore.get('maxTokens'),
      }
    } else if (provider.requestFormat === 'anthropic') {
      requestBody = {
        model: provider.defaultModel,
        system: systemPrompt,
        messages,
        stream: provider.supportsStreaming,
        temperature: configStore.get('temperature'),
        max_tokens: configStore.get('maxTokens'),
      }
    } else {
      // Custom format - use OpenAI-style as default
      requestBody = {
        model: provider.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: provider.supportsStreaming,
        temperature: configStore.get('temperature'),
        max_tokens: configStore.get('maxTokens'),
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Custom provider error: ${response.status} - ${errorText}`)
    }

    let fullResponse = ''

    if (provider.supportsStreaming && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              // Handle OpenAI-style streaming
              const content = data.choices?.[0]?.delta?.content ||
                data.delta?.text ||
                data.content ||
                ''
              if (content) {
                fullResponse += content
                onChunk(content)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } else {
      const data = await response.json()
      // Extract content based on format
      fullResponse = data.choices?.[0]?.message?.content ||
        data.content?.[0]?.text ||
        data.response ||
        JSON.stringify(data)
      onChunk(fullResponse)
    }

    return fullResponse
  }

  router.post('/generate-ai-code-stream', async (req: Request, res: Response) => {
    try {
      const { prompt, model, context, isEdit = false } = req.body

      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' })
      }

      // Get the active AI provider from config
      const aiProvider = configStore.get('aiProvider') || 'groq'

      // Get API keys from secure storage
      const groqKey = await secureStorage.getKey('GROQ_API_KEY')
      const anthropicKey = await secureStorage.getKey('ANTHROPIC_API_KEY')
      const openaiKey = await secureStorage.getKey('OPENAI_API_KEY')
      const geminiKey = await secureStorage.getKey('GEMINI_API_KEY')

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

      let fullResponse = ''

      // Check if using custom provider
      if (aiProvider.startsWith('custom:')) {
        const providerName = aiProvider.replace('custom:', '')
        const customProviders = configStore.get('customAIProviders') || []
        const customProvider = customProviders.find((p: CustomAIProvider) => p.name === providerName)

        if (!customProvider) {
          return res.status(400).json({
            success: false,
            error: `Custom AI provider "${providerName}" not found`,
          })
        }

        const apiKey = await secureStorage.getCustomProviderKey(providerName)
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            error: `API key not configured for custom provider "${providerName}"`,
          })
        }

        fullResponse = await callCustomProvider(
          customProvider,
          apiKey,
          systemPrompt,
          aiMessages,
          (chunk) => sendEvent({ type: 'stream', content: chunk })
        )
      } else {
        // Use built-in providers
        let provider: ReturnType<typeof createGroq | typeof createAnthropic | typeof createOpenAI | typeof createGoogleGenerativeAI>
        let actualModel = model || configStore.get('defaultModel')

        if (aiProvider === 'anthropic' && anthropicKey) {
          provider = createAnthropic({ apiKey: anthropicKey })
          actualModel = actualModel.startsWith('anthropic/') ? actualModel.replace('anthropic/', '') : 'claude-3-5-sonnet-20241022'
        } else if (aiProvider === 'openai' && openaiKey) {
          provider = createOpenAI({ apiKey: openaiKey })
          actualModel = actualModel.startsWith('openai/') ? actualModel.replace('openai/', '') : 'gpt-4o'
        } else if (aiProvider === 'google' && geminiKey) {
          provider = createGoogleGenerativeAI({ apiKey: geminiKey })
          actualModel = actualModel.startsWith('google/') ? actualModel.replace('google/', '') : 'gemini-1.5-pro'
        } else if (groqKey) {
          provider = createGroq({ apiKey: groqKey })
          actualModel = 'moonshotai/kimi-k2-instruct-0905'
        } else {
          return res.status(400).json({
            success: false,
            error: 'No AI provider configured. Please add at least one API key in Settings.',
          })
        }

        // Stream the response
        const result = await streamText({
          model: provider(actualModel),
          system: systemPrompt,
          messages: aiMessages,
          temperature: configStore.get('temperature'),
          maxTokens: configStore.get('maxTokens'),
        })

        for await (const chunk of result.textStream) {
          fullResponse += chunk
          sendEvent({ type: 'stream', content: chunk })
        }
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
