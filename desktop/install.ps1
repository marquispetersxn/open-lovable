# Open Lovable Desktop - Windows Install & Build Script
# Run: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [switch]$SkipBuild,
    [switch]$DevMode,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$AppName = "Open Lovable Desktop"
$RepoUrl = "https://github.com/marquispetersxn/open-lovable.git"
$DesktopDir = "desktop"

function Write-Step { param($msg) Write-Host "`n[$AppName] $msg" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# ─── Banner ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║     Open Lovable Desktop Installer   ║" -ForegroundColor Magenta
Write-Host "  ║     AI-Powered Code Generation       ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ─── 1. Check Prerequisites ─────────────────────────────────────────
Write-Step "Checking prerequisites..."

# Node.js
$nodeVersion = $null
try {
    $nodeVersion = (node --version 2>$null)
} catch {}

if (-not $nodeVersion) {
    Write-Fail "Node.js is not installed."
    Write-Host "  Download from: https://nodejs.org (v18+ required)" -ForegroundColor Yellow
    Write-Host ""
    $install = Read-Host "  Would you like to install Node.js automatically? (y/n)"
    if ($install -eq 'y') {
        Write-Step "Installing Node.js via winget..."
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $nodeVersion = (node --version 2>$null)
        if (-not $nodeVersion) {
            Write-Fail "Node.js installation failed. Please install manually and restart your terminal."
            exit 1
        }
    } else {
        exit 1
    }
}

$nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 18) {
    Write-Fail "Node.js $nodeVersion is too old. Version 18+ is required."
    exit 1
}
Write-Ok "Node.js $nodeVersion"

# npm
$npmVersion = (npm --version 2>$null)
Write-Ok "npm v$npmVersion"

# Git
$gitVersion = $null
try {
    $gitVersion = (git --version 2>$null)
} catch {}

if (-not $gitVersion) {
    Write-Fail "Git is not installed."
    Write-Host "  Download from: https://git-scm.com" -ForegroundColor Yellow
    exit 1
}
Write-Ok $gitVersion

# Docker (optional)
$dockerAvailable = $false
try {
    $dockerVersion = (docker --version 2>$null)
    if ($dockerVersion) {
        Write-Ok "Docker: $dockerVersion"
        $dockerAvailable = $true
    }
} catch {
    Write-Warn "Docker not found (optional - needed for local code sandbox)"
}

# ─── 2. Clone or Update Repository ──────────────────────────────────
Write-Step "Setting up repository..."

$installDir = Join-Path $env:USERPROFILE "open-lovable"

if (Test-Path (Join-Path $installDir ".git")) {
    Write-Ok "Repository already exists at $installDir"
    if ($Clean) {
        Write-Step "Cleaning existing installation..."
        Push-Location $installDir
        git checkout main 2>$null
        git pull origin main 2>$null
        Pop-Location
    }
} else {
    Write-Step "Cloning repository..."
    git clone $RepoUrl $installDir
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to clone repository"
        exit 1
    }
    Write-Ok "Repository cloned to $installDir"
}

$desktopPath = Join-Path $installDir $DesktopDir

if (-not (Test-Path $desktopPath)) {
    Write-Fail "Desktop app not found at $desktopPath"
    Write-Host "  The desktop directory may not be on the default branch yet." -ForegroundColor Yellow
    exit 1
}

# ─── 3. Install Dependencies ────────────────────────────────────────
Write-Step "Installing dependencies..."
Push-Location $desktopPath

if ($Clean -and (Test-Path "node_modules")) {
    Write-Step "Removing existing node_modules..."
    Remove-Item -Recurse -Force "node_modules"
}

npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm install failed. Retrying with verbose output..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        exit 1
    }
}
Write-Ok "Dependencies installed"

# ─── 4. Build or Run ────────────────────────────────────────────────
if ($DevMode) {
    Write-Step "Starting in development mode..."
    Write-Host ""
    Write-Host "  The app will open shortly. Press Ctrl+C to stop." -ForegroundColor Yellow
    Write-Host ""
    npm run dev
} elseif (-not $SkipBuild) {
    Write-Step "Building application..."

    npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Build failed"
        Pop-Location
        exit 1
    }
    Write-Ok "Build complete"

    Write-Step "Packaging for Windows..."
    npm run package:win 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Packaging failed"
        Pop-Location
        exit 1
    }
    Write-Ok "Packaging complete"

    # Find the installer
    $releaseDir = Join-Path $desktopPath "release"
    $installer = Get-ChildItem -Path $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($installer) {
        Write-Host ""
        Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "  ║        Build Successful!             ║" -ForegroundColor Green
        Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Installer: $($installer.FullName)" -ForegroundColor White
        Write-Host ""

        $run = Read-Host "  Would you like to run the installer now? (y/n)"
        if ($run -eq 'y') {
            Start-Process $installer.FullName
        }
    } else {
        Write-Ok "Build output is in: $releaseDir"
    }
} else {
    Write-Ok "Dependencies installed. Skipping build (--SkipBuild flag)."
}

Pop-Location

# ─── 5. Summary ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Location:  $desktopPath" -ForegroundColor White
Write-Host "  Docker:    $(if ($dockerAvailable) { 'Available' } else { 'Not installed (optional)' })" -ForegroundColor White
Write-Host ""
Write-Host "  Commands:" -ForegroundColor Yellow
Write-Host "    cd $desktopPath"
Write-Host "    npm run dev          # Development mode"
Write-Host "    npm run package:win  # Build Windows installer"
Write-Host ""
Write-Host "  First launch: Go to Settings to configure your API keys" -ForegroundColor Yellow
Write-Host "  ════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
