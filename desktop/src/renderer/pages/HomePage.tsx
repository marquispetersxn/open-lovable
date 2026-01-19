import { useNavigate } from 'react-router-dom'
import { Sparkles, Globe, Code, Zap } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: Globe,
      title: 'Clone Any Website',
      description: 'Scrape and recreate any website with AI-powered code generation',
    },
    {
      icon: Code,
      title: 'Modern React Code',
      description: 'Generate clean TypeScript React components with Tailwind CSS',
    },
    {
      icon: Zap,
      title: 'Instant Preview',
      description: 'See your generated code running in real-time with hot reload',
    },
  ]

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 rounded-full text-purple-400 text-sm mb-6">
            <Sparkles size={16} />
            <span>AI-Powered Code Generation</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
            Open Lovable Desktop
          </h1>
          <p className="text-xl text-gray-400">
            Clone websites, generate React components, and build applications
            with the power of AI - all running locally on your machine.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/generate')}
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-purple-500/25"
        >
          Start Generating
        </button>

        {/* Features */}
        <div className="mt-16 grid grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-left hover:border-purple-500/50 transition-colors"
            >
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <Icon className="text-purple-400" size={24} />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-gray-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
