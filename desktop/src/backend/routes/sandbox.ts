import { Router, Request, Response } from 'express'
import { SecureStorage } from '../../main/secure-storage'
import { ConfigStore } from '../../main/config-store'
import Docker from 'dockerode'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

interface SandboxInstance {
  id: string
  provider: 'docker' | 'e2b' | 'vercel'
  containerId?: string
  process?: ChildProcess
  projectDir: string
  port: number
  createdAt: number
}

// Active sandboxes
const sandboxes = new Map<string, SandboxInstance>()

export function createSandboxRoutes(
  secureStorage: SecureStorage,
  configStore: ConfigStore
): Router {
  const router = Router()

  // Create a new sandbox
  router.post('/create-sandbox', async (req: Request, res: Response) => {
    try {
      const provider = configStore.get('sandboxProvider')
      const { template = 'react-vite' } = req.body

      console.log(`[sandbox] Creating sandbox with provider: ${provider}`)

      let sandbox: SandboxInstance

      switch (provider) {
        case 'docker':
          sandbox = await createDockerSandbox(template)
          break
        case 'e2b':
          sandbox = await createE2BSandbox(secureStorage, template)
          break
        case 'vercel':
          sandbox = await createVercelSandbox(secureStorage, template)
          break
        default:
          // Default to local Node.js process
          sandbox = await createLocalSandbox(template)
      }

      sandboxes.set(sandbox.id, sandbox)

      res.json({
        success: true,
        sandboxId: sandbox.id,
        provider: sandbox.provider,
        port: sandbox.port,
        previewUrl: `http://localhost:${sandbox.port}`,
      })
    } catch (error) {
      console.error('[sandbox] Create error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
      })
    }
  })

  // Write file to sandbox
  router.post('/sandbox/write-file', async (req: Request, res: Response) => {
    try {
      const { sandboxId, filePath, content } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      const fullPath = path.join(sandbox.projectDir, filePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content, 'utf-8')

      res.json({ success: true })
    } catch (error) {
      console.error('[sandbox] Write file error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
      })
    }
  })

  // Read file from sandbox
  router.post('/sandbox/read-file', async (req: Request, res: Response) => {
    try {
      const { sandboxId, filePath } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      const fullPath = path.join(sandbox.projectDir, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')

      res.json({ success: true, content })
    } catch (error) {
      console.error('[sandbox] Read file error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      })
    }
  })

  // List files in sandbox
  router.post('/sandbox/list-files', async (req: Request, res: Response) => {
    try {
      const { sandboxId, directory = '.' } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      const fullPath = path.join(sandbox.projectDir, directory)
      const files = await listFilesRecursive(fullPath, sandbox.projectDir)

      res.json({ success: true, files })
    } catch (error) {
      console.error('[sandbox] List files error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files',
      })
    }
  })

  // Run command in sandbox
  router.post('/sandbox/run-command', async (req: Request, res: Response) => {
    try {
      const { sandboxId, command } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      const result = await runCommandInSandbox(sandbox, command)
      res.json({ success: true, ...result })
    } catch (error) {
      console.error('[sandbox] Run command error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run command',
      })
    }
  })

  // Install packages
  router.post('/sandbox/install-packages', async (req: Request, res: Response) => {
    try {
      const { sandboxId, packages } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      const packagesStr = Array.isArray(packages) ? packages.join(' ') : packages
      const result = await runCommandInSandbox(sandbox, `npm install ${packagesStr}`)

      res.json({ success: true, ...result })
    } catch (error) {
      console.error('[sandbox] Install packages error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install packages',
      })
    }
  })

  // Destroy sandbox
  router.post('/sandbox/destroy', async (req: Request, res: Response) => {
    try {
      const { sandboxId } = req.body

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      await destroySandbox(sandbox)
      sandboxes.delete(sandboxId)

      res.json({ success: true })
    } catch (error) {
      console.error('[sandbox] Destroy error:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to destroy sandbox',
      })
    }
  })

  // Get sandbox status
  router.get('/sandbox/:sandboxId/status', async (req: Request, res: Response) => {
    try {
      const { sandboxId } = req.params

      const sandbox = sandboxes.get(sandboxId)
      if (!sandbox) {
        return res.status(404).json({ success: false, error: 'Sandbox not found' })
      }

      res.json({
        success: true,
        sandbox: {
          id: sandbox.id,
          provider: sandbox.provider,
          port: sandbox.port,
          previewUrl: `http://localhost:${sandbox.port}`,
          createdAt: sandbox.createdAt,
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  return router
}

// Helper functions

async function createDockerSandbox(template: string): Promise<SandboxInstance> {
  const docker = new Docker()
  const id = `sandbox-${Date.now()}`
  const port = await findAvailablePort(5173)
  const projectDir = path.join(os.tmpdir(), 'open-lovable', id)

  await fs.mkdir(projectDir, { recursive: true })

  // Create a basic Vite React project
  await createViteProject(projectDir)

  // Start Docker container
  const container = await docker.createContainer({
    Image: 'node:20-alpine',
    Cmd: ['sh', '-c', 'npm install && npm run dev -- --host 0.0.0.0'],
    WorkingDir: '/app',
    ExposedPorts: { '5173/tcp': {} },
    HostConfig: {
      Binds: [`${projectDir}:/app`],
      PortBindings: { '5173/tcp': [{ HostPort: port.toString() }] },
    },
  })

  await container.start()

  return {
    id,
    provider: 'docker',
    containerId: container.id,
    projectDir,
    port,
    createdAt: Date.now(),
  }
}

async function createLocalSandbox(template: string): Promise<SandboxInstance> {
  const id = `sandbox-${Date.now()}`
  const port = await findAvailablePort(5173)
  const projectDir = path.join(os.tmpdir(), 'open-lovable', id)

  await fs.mkdir(projectDir, { recursive: true })

  // Create a basic Vite React project
  await createViteProject(projectDir)

  // Install dependencies
  const installProcess = spawn('npm', ['install'], {
    cwd: projectDir,
    shell: true,
  })

  await new Promise<void>((resolve, reject) => {
    installProcess.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`npm install failed with code ${code}`))
    })
  })

  // Start dev server
  const devProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
    cwd: projectDir,
    shell: true,
    detached: true,
  })

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 3000))

  return {
    id,
    provider: 'docker', // Using 'docker' type for local too for simplicity
    process: devProcess,
    projectDir,
    port,
    createdAt: Date.now(),
  }
}

async function createE2BSandbox(
  secureStorage: SecureStorage,
  template: string
): Promise<SandboxInstance> {
  const apiKey = await secureStorage.getKey('E2B_API_KEY')
  if (!apiKey) {
    throw new Error('E2B API key not configured')
  }

  // E2B integration would go here
  // For now, fall back to local
  console.log('[sandbox] E2B not fully implemented, falling back to local')
  return createLocalSandbox(template)
}

async function createVercelSandbox(
  secureStorage: SecureStorage,
  template: string
): Promise<SandboxInstance> {
  const token = await secureStorage.getKey('VERCEL_TOKEN')
  if (!token) {
    throw new Error('Vercel token not configured')
  }

  // Vercel sandbox integration would go here
  // For now, fall back to local
  console.log('[sandbox] Vercel sandbox not fully implemented, falling back to local')
  return createLocalSandbox(template)
}

async function createViteProject(projectDir: string): Promise<void> {
  // Create package.json
  const packageJson = {
    name: 'sandbox-project',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      autoprefixer: '^10.4.16',
      postcss: '^8.4.32',
      tailwindcss: '^3.4.0',
      typescript: '^5.2.2',
      vite: '^5.0.0',
    },
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )

  // Create vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`
  await fs.writeFile(path.join(projectDir, 'vite.config.ts'), viteConfig)

  // Create tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
`
  await fs.writeFile(path.join(projectDir, 'tailwind.config.js'), tailwindConfig)

  // Create postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
  await fs.writeFile(path.join(projectDir, 'postcss.config.js'), postcssConfig)

  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Open Lovable Sandbox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  await fs.writeFile(path.join(projectDir, 'index.html'), indexHtml)

  // Create src directory and files
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })

  const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`
  await fs.writeFile(path.join(projectDir, 'src', 'main.tsx'), mainTsx)

  const appTsx = `export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Welcome to Open Lovable</h1>
    </div>
  )
}
`
  await fs.writeFile(path.join(projectDir, 'src', 'App.tsx'), appTsx)

  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`
  await fs.writeFile(path.join(projectDir, 'src', 'index.css'), indexCss)

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
    },
    include: ['src'],
  }
  await fs.writeFile(
    path.join(projectDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  )
}

async function listFilesRecursive(
  dir: string,
  baseDir: string
): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(baseDir, fullPath)

    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, baseDir)))
    } else {
      files.push(relativePath)
    }
  }

  return files
}

async function runCommandInSandbox(
  sandbox: SandboxInstance,
  command: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, {
      cwd: sandbox.projectDir,
      shell: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`))
      }
    })

    proc.on('error', reject)
  })
}

async function destroySandbox(sandbox: SandboxInstance): Promise<void> {
  if (sandbox.containerId) {
    const docker = new Docker()
    const container = docker.getContainer(sandbox.containerId)
    await container.stop()
    await container.remove()
  }

  if (sandbox.process) {
    sandbox.process.kill()
  }

  // Clean up project directory
  try {
    await fs.rm(sandbox.projectDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('net')

  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      const port = (server.address() as { port: number }).port
      server.close(() => resolve(port))
    })
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1))
    })
  })
}
