# Open Lovable Desktop

A Windows desktop application for AI-powered website cloning and code generation. Built with Electron, React, and TypeScript.

## Features

- **Clone Any Website**: Scrape and recreate any website with AI-powered code generation
- **Multiple AI Providers**: Support for Groq, Anthropic (Claude), OpenAI, and Google (Gemini)
- **Secure API Key Storage**: Your API keys are stored securely using the system keychain
- **Local & Cloud Sandboxes**: Run code locally with Docker or use cloud providers (E2B, Vercel)
- **Real-time Preview**: See your generated code running instantly with hot reload
- **Modern React Output**: Generates clean TypeScript React components with Tailwind CSS

## Requirements

- Node.js 18+ (Node.js 20+ recommended)
- npm or pnpm
- Docker Desktop (optional, for local sandbox)
- API Keys:
  - **Required**: Firecrawl API key (for web scraping)
  - **At least one AI provider**: Groq, Anthropic, OpenAI, or Google

## Getting API Keys

| Service | URL | Notes |
|---------|-----|-------|
| Firecrawl | https://firecrawl.dev | Required for web scraping |
| Groq | https://console.groq.com | Fast inference, free tier |
| Anthropic | https://console.anthropic.com | Claude models |
| OpenAI | https://platform.openai.com | GPT models |
| Google | https://aistudio.google.com | Gemini models |
| E2B | https://e2b.dev | Cloud sandbox (optional) |
| Vercel | https://vercel.com/account/tokens | Cloud sandbox (optional) |

## Installation

```bash
# Clone the repository
git clone https://github.com/marquispetersxn/open-lovable.git
cd open-lovable-desktop

# Install dependencies
npm install
# or
pnpm install

# Start in development mode
npm run dev
```

## Building for Windows

```bash
# Build the application
npm run build

# Package for Windows
npm run package:win
```

The packaged application will be in the `release` folder.

## Project Structure

```
open-lovable-desktop/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main entry point
│   │   ├── server.ts   # Express backend server
│   │   ├── preload.ts  # Preload script for IPC
│   │   ├── secure-storage.ts  # API key storage
│   │   └── config-store.ts    # App configuration
│   ├── backend/        # Express API routes
│   │   └── routes/
│   │       ├── generate-code.ts
│   │       ├── scrape-url.ts
│   │       ├── sandbox.ts
│   │       └── analyze-edit.ts
│   ├── renderer/       # React frontend
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── GenerationPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── components/
│   └── shared/         # Shared types and utilities
├── package.json
├── vite.config.ts      # Vite config for renderer
├── tsconfig.json       # TypeScript config for renderer
└── tsconfig.main.json  # TypeScript config for main process
```

## Usage

1. **Launch the app** and go to Settings
2. **Add your API keys**:
   - Firecrawl (required)
   - At least one AI provider (Groq recommended for speed)
3. **Go to Generate** page
4. **Enter a URL** to clone or type a prompt describing what you want to build
5. **Watch the AI** generate your React code in real-time
6. **Preview** your creation and iterate with follow-up prompts

## Sandbox Options

### Local Docker (Recommended)
- Install Docker Desktop
- No additional API keys needed
- Code runs locally on your machine

### E2B Cloud
- Add your E2B API key in Settings
- Code runs in cloud sandbox
- No Docker required

### Vercel Sandbox
- Add your Vercel token in Settings
- Code runs in Vercel's infrastructure

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build main process only
npm run build:main

# Build renderer only
npm run build:renderer

# Run linting
npm run lint
```

## Security

- API keys are stored in the system keychain (Windows Credential Manager)
- Keys are never exposed in the UI (only masked versions shown)
- All backend operations run locally on your machine

## License

MIT License - see LICENSE file for details.

## Credits

Based on [Open Lovable](https://github.com/marquispetersxn/open-lovable) web application.
