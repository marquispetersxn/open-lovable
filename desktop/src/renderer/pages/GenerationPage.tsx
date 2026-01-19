import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Send,
  Globe,
  Loader2,
  Code,
  Eye,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'

interface GenerationPageProps {
  backendPort: number
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  code?: string
}

export default function GenerationPage({ backendPort }: GenerationPageProps) {
  const [prompt, setPrompt] = useState('')
  const [urlToScrape, setUrlToScrape] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview')
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const baseUrl = `http://localhost:${backendPort}`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const scrapeUrl = async () => {
    if (!urlToScrape.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(`${baseUrl}/api/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Website scraped successfully')
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: `Scraped content from ${urlToScrape}`,
          },
        ])
        // Auto-fill prompt with suggestion
        setPrompt(`Clone this website: ${urlToScrape}`)
      } else {
        toast.error(data.error || 'Failed to scrape URL')
      }
    } catch (error) {
      toast.error('Failed to scrape URL')
    } finally {
      setIsLoading(false)
    }
  }

  const createSandbox = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/create-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'react-vite' }),
      })

      const data = await response.json()
      if (data.success) {
        setSandboxId(data.sandboxId)
        setPreviewUrl(data.previewUrl)
        return data.sandboxId
      }
      return null
    } catch (error) {
      console.error('Failed to create sandbox:', error)
      return null
    }
  }

  const generateCode = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
    }
    setMessages((prev) => [...prev, userMessage])
    setPrompt('')

    try {
      // Create sandbox if not exists
      let currentSandboxId = sandboxId
      if (!currentSandboxId) {
        currentSandboxId = await createSandbox()
      }

      const response = await fetch(`${baseUrl}/api/generate-ai-code-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          context: {
            sandboxId: currentSandboxId,
            scrapedUrl: urlToScrape || undefined,
          },
          isEdit: messages.length > 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate code')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let code = ''

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
      }
      setMessages((prev) => [...prev, assistantMessage])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'stream') {
                fullContent += data.content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                )
              } else if (data.type === 'complete') {
                code = data.code
                setGeneratedCode(code)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? { ...m, code } : m
                  )
                )

                // Write code to sandbox
                if (currentSandboxId && code) {
                  await fetch(`${baseUrl}/api/sandbox/write-file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sandboxId: currentSandboxId,
                      filePath: 'src/App.tsx',
                      content: code,
                    }),
                  })
                }
              } else if (data.type === 'status') {
                // Status updates
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      toast.success('Code generated successfully')
    } catch (error) {
      toast.error('Failed to generate code')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetConversation = async () => {
    try {
      await fetch(`${baseUrl}/api/reset-conversation`, { method: 'POST' })
      setMessages([])
      setGeneratedCode('')
      setSandboxId(null)
      setPreviewUrl(null)
      toast.success('Conversation reset')
    } catch {
      toast.error('Failed to reset conversation')
    }
  }

  return (
    <div className="h-full flex">
      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col border-r border-gray-800">
        {/* URL Scraper */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="url"
                value={urlToScrape}
                onChange={(e) => setUrlToScrape(e.target.value)}
                placeholder="Enter URL to clone..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={scrapeUrl}
              disabled={isLoading || !urlToScrape.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Scrape'}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Start by entering a prompt or scraping a URL</p>
              <p className="text-sm">Examples:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"Create a landing page for a SaaS product"</li>
                <li>"Build a todo app with dark theme"</li>
                <li>"Clone the hero section of stripe.com"</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-purple-600/20 ml-8'
                  : message.role === 'system'
                  ? 'bg-gray-800/50 text-gray-400 text-sm'
                  : 'bg-gray-800 mr-8'
              }`}
            >
              <div className="text-sm text-gray-400 mb-1">
                {message.role === 'user'
                  ? 'You'
                  : message.role === 'system'
                  ? 'System'
                  : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <button
              onClick={resetConversation}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              title="Reset conversation"
            >
              <RefreshCw size={20} />
            </button>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  generateCode()
                }
              }}
              placeholder="Describe what you want to build..."
              rows={2}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={generateCode}
              disabled={isLoading || !prompt.trim()}
              className="px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-1/2 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
              activeTab === 'preview'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye size={18} />
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
              activeTab === 'code'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Code size={18} />
            Code
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'preview' ? (
            previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0 bg-white"
                title="Preview"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Eye size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Generate code to see the preview</p>
                </div>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex justify-end p-2 border-b border-gray-800">
                <button
                  onClick={copyCode}
                  disabled={!generatedCode}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-sm font-mono bg-gray-900">
                <code className="text-gray-300">
                  {generatedCode || '// Generated code will appear here'}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
