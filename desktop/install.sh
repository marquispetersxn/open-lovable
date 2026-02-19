#!/usr/bin/env bash
# Open Lovable Desktop - Cross-Platform Install & Build Script
# Usage: bash install.sh [--dev] [--skip-build] [--clean]

set -e

APP_NAME="Open Lovable Desktop"
REPO_URL="https://github.com/marquispetersxn/open-lovable.git"
DESKTOP_DIR="desktop"
DEV_MODE=false
SKIP_BUILD=false
CLEAN=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dev) DEV_MODE=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --clean) CLEAN=true ;;
        --help)
            echo "Usage: bash install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev          Start in development mode after install"
            echo "  --skip-build   Only install dependencies, don't build"
            echo "  --clean        Clean install (remove node_modules first)"
            echo "  --help         Show this help"
            exit 0
            ;;
    esac
done

# Colors
cyan='\033[0;36m'
green='\033[0;32m'
yellow='\033[0;33m'
red='\033[0;31m'
magenta='\033[0;35m'
nc='\033[0m'

step()  { echo -e "\n${cyan}[$APP_NAME] $1${nc}"; }
ok()    { echo -e "  ${green}[OK]${nc} $1"; }
warn()  { echo -e "  ${yellow}[WARN]${nc} $1"; }
fail()  { echo -e "  ${red}[FAIL]${nc} $1"; }

# ─── Banner ──────────────────────────────────────────────────────────
echo ""
echo -e "${magenta}  ╔══════════════════════════════════════╗${nc}"
echo -e "${magenta}  ║     Open Lovable Desktop Installer   ║${nc}"
echo -e "${magenta}  ║     AI-Powered Code Generation       ║${nc}"
echo -e "${magenta}  ╚══════════════════════════════════════╝${nc}"
echo ""

# ─── 1. Check Prerequisites ─────────────────────────────────────────
step "Checking prerequisites..."

# Node.js
if ! command -v node &> /dev/null; then
    fail "Node.js is not installed."
    echo "  Install from: https://nodejs.org (v18+ required)"
    echo ""

    # Try auto-install
    if command -v brew &> /dev/null; then
        read -p "  Install via Homebrew? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            brew install node
        else
            exit 1
        fi
    elif command -v apt-get &> /dev/null; then
        read -p "  Install via apt? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            exit 1
        fi
    else
        exit 1
    fi
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')

if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js $NODE_VERSION is too old. Version 18+ required."
    exit 1
fi
ok "Node.js $NODE_VERSION"

# npm
NPM_VERSION=$(npm --version)
ok "npm v$NPM_VERSION"

# Git
if ! command -v git &> /dev/null; then
    fail "Git is not installed."
    exit 1
fi
ok "$(git --version)"

# Docker (optional)
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null; then
    ok "Docker: $(docker --version)"
    DOCKER_AVAILABLE=true
else
    warn "Docker not found (optional - needed for local code sandbox)"
fi

# ─── 2. Clone or Update Repository ──────────────────────────────────
step "Setting up repository..."

INSTALL_DIR="$HOME/open-lovable"

if [ -d "$INSTALL_DIR/.git" ]; then
    ok "Repository already exists at $INSTALL_DIR"
    if [ "$CLEAN" = true ]; then
        step "Updating repository..."
        cd "$INSTALL_DIR"
        git checkout main 2>/dev/null || true
        git pull origin main 2>/dev/null || true
        cd -
    fi
else
    step "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repository cloned to $INSTALL_DIR"
fi

DESKTOP_PATH="$INSTALL_DIR/$DESKTOP_DIR"

if [ ! -d "$DESKTOP_PATH" ]; then
    fail "Desktop app not found at $DESKTOP_PATH"
    echo "  The desktop directory may not be on the default branch yet."
    exit 1
fi

# ─── 3. Install Dependencies ────────────────────────────────────────
step "Installing dependencies..."
cd "$DESKTOP_PATH"

if [ "$CLEAN" = true ] && [ -d "node_modules" ]; then
    step "Removing existing node_modules..."
    rm -rf node_modules
fi

npm install
ok "Dependencies installed"

# ─── 4. Build or Run ────────────────────────────────────────────────
if [ "$DEV_MODE" = true ]; then
    step "Starting in development mode..."
    echo ""
    echo -e "  ${yellow}The app will open shortly. Press Ctrl+C to stop.${nc}"
    echo ""
    npm run dev
elif [ "$SKIP_BUILD" = false ]; then
    step "Building application..."
    npm run build
    ok "Build complete"

    # Detect platform for packaging
    PLATFORM=$(uname -s)
    case "$PLATFORM" in
        MINGW*|MSYS*|CYGWIN*)
            step "Packaging for Windows..."
            npm run package:win
            ;;
        Darwin)
            step "Packaging for macOS..."
            npx electron-builder --mac
            ;;
        Linux)
            step "Packaging for Linux..."
            npx electron-builder --linux
            ;;
    esac
    ok "Packaging complete"
else
    ok "Dependencies installed. Skipping build (--skip-build flag)."
fi

# ─── 5. Summary ─────────────────────────────────────────────────────
echo ""
echo -e "  ${cyan}════════════════════════════════════════${nc}"
echo -e "  ${cyan}Setup complete!${nc}"
echo ""
echo -e "  Location:  $DESKTOP_PATH"
echo -e "  Docker:    $([ "$DOCKER_AVAILABLE" = true ] && echo 'Available' || echo 'Not installed (optional)')"
echo ""
echo -e "  ${yellow}Commands:${nc}"
echo "    cd $DESKTOP_PATH"
echo "    npm run dev          # Development mode"
echo "    npm run package:win  # Build Windows installer"
echo ""
echo -e "  ${yellow}First launch: Go to Settings to configure your API keys${nc}"
echo -e "  ${cyan}════════════════════════════════════════${nc}"
echo ""
