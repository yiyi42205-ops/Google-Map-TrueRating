#!/bin/bash

# --- Color Definitions & TTY Detection ---
if [ -t 1 ] && [ ! -z "$TERM" ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    YELLOW='\033[1;33m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
    clear
else
    RED=''
    GREEN=''
    BLUE=''
    CYAN=''
    YELLOW=''
    BOLD=''
    NC=''
fi

echo -e "${BLUE}${BOLD}=================================================="
echo -e "      Google Maps TrueRating Setup & Runner"
echo -e "==================================================${NC}"
echo -e "This script will help you configure and run the project."
echo

# Helper function to print status
status_info() {
    echo -e "${CYAN}[info]${NC} $1"
}
status_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}
status_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}
status_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# --- 1. Check Core System Requirements ---
status_info "Checking system requirements..."

# Check Node.js
if ! command -v node &> /dev/null; then
    status_error "Node.js is not installed. Please install Node.js (v18+) and try again."
    exit 1
else
    NODE_VER=$(node -v)
    status_success "Node.js is installed ($NODE_VER)"
fi

# Check Python3
if ! command -v python3 &> /dev/null; then
    status_error "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
else
    PYTHON_VER=$(python3 --version)
    status_success "Python 3 is installed ($PYTHON_VER)"
fi

echo

# --- 2. Interactive Parameters & Configuration ---
echo -e "${BOLD}--- Interactive Configuration ---${NC}"

# Ask for Node dependency installation
read -p "$(echo -e "${YELLOW}Install Node.js dependencies? (Recommended for first run) [Y/n]: ${NC}")" INSTALL_NODE
INSTALL_NODE=${INSTALL_NODE:-Y}

# Ask for Python dependency installation
read -p "$(echo -e "${YELLOW}Install Python scraper dependencies & setup venv? (Required for scraping reviews) [Y/n]: ${NC}")" INSTALL_PYTHON
INSTALL_PYTHON=${INSTALL_PYTHON:-Y}

# Ask about Ollama (local LLM)
read -p "$(echo -e "${YELLOW}Do you plan to use local Ollama LLM for advanced auditing? [y/N]: ${NC}")" USE_OLLAMA
USE_OLLAMA=${USE_OLLAMA:-N}

OLLAMA_MODEL="gemma4:e4b"
if [[ "$USE_OLLAMA" =~ ^[yY]$ ]]; then
    read -p "$(echo -e "${YELLOW}Enter Ollama Model to use [default: gemma4:e4b]: ${NC}")" CUSTOM_MODEL
    if [ ! -z "$CUSTOM_MODEL" ]; then
        OLLAMA_MODEL=$CUSTOM_MODEL
    fi
fi

echo

# --- 3. Execution of Setup ---

# Install Node modules if requested
if [[ "$INSTALL_NODE" =~ ^[yY]$ ]]; then
    status_info "Installing Node.js packages..."
    npm install
    if [ $? -eq 0 ]; then
        status_success "Node.js packages installed successfully."
    else
        status_error "Failed to install Node.js packages."
        exit 1
    fi
else
    status_info "Skipping Node.js packages installation."
fi

# Setup Python Virtual Environment and Install Dependencies
if [[ "$INSTALL_PYTHON" =~ ^[yY]$ ]]; then
    status_info "Setting up Python virtual environment..."
    if [ ! -d "review_scraper/venv" ]; then
        python3 -m venv review_scraper/venv
    fi
    
    status_info "Installing Python dependencies (requirements.txt)..."
    review_scraper/venv/bin/pip install -r review_scraper/requirements.txt
    
    if [ $? -eq 0 ]; then
        status_success "Python dependencies installed successfully."
    else
        status_error "Failed to install Python dependencies."
        exit 1
    fi
    
    status_info "Installing Playwright chromium browser..."
    review_scraper/venv/bin/playwright install chromium
    if [ $? -eq 0 ]; then
        status_success "Playwright browser installed."
    else
        status_error "Failed to install Playwright browser."
        exit 1
    fi
else
    status_info "Skipping Python venv setup."
fi

# Check and pull Ollama model if requested
if [[ "$USE_OLLAMA" =~ ^[yY]$ ]]; then
    if ! command -v ollama &> /dev/null; then
        status_warning "Ollama is not installed on your system."
        read -p "$(echo -e "${YELLOW}Would you like to install Ollama now? [Y/n]: ${NC}")" INSTALL_OLLAMA_CONFIRM
        INSTALL_OLLAMA_CONFIRM=${INSTALL_OLLAMA_CONFIRM:-Y}
        
        if [[ "$INSTALL_OLLAMA_CONFIRM" =~ ^[yY]$ ]]; then
            if [[ "$(uname)" == "Darwin" ]]; then
                if command -v brew &> /dev/null; then
                    status_info "Installing Ollama via Homebrew..."
                    brew install --cask ollama
                    if [ $? -eq 0 ]; then
                        status_success "Ollama installed successfully!"
                    else
                        status_error "Failed to install Ollama via Homebrew."
                    fi
                else
                    status_error "Homebrew is not installed. Please install Ollama manually from: https://ollama.com"
                fi
            elif [[ "$(uname)" == "Linux" ]]; then
                status_info "Installing Ollama via official install script..."
                curl -fsSL https://ollama.com/install.sh | sh
                if [ $? -eq 0 ]; then
                    status_success "Ollama installed successfully!"
                else
                    status_error "Failed to install Ollama via script."
                fi
            else
                status_error "Unsupported OS for auto-installation. Please install Ollama manually from: https://ollama.com"
            fi
        fi
    fi

    # Check again if it is installed now
    if command -v ollama &> /dev/null; then
        status_info "Checking if Ollama service is running..."
        # Wait a bit if we just installed it, but usually the user needs to start the app on macOS
        if [[ "$(uname)" == "Darwin" ]] && ! pgrep -x "Ollama" &> /dev/null; then
            status_warning "Ollama app is installed but might not be running."
            read -p "$(echo -e "${YELLOW}Would you like to launch the Ollama app now? [Y/n]: ${NC}")" LAUNCH_OLLAMA
            LAUNCH_OLLAMA=${LAUNCH_OLLAMA:-Y}
            if [[ "$LAUNCH_OLLAMA" =~ ^[yY]$ ]]; then
                open -a Ollama
                status_info "Waiting for Ollama service to start..."
                sleep 5
            fi
        fi

        if curl -s http://127.0.0.1:11434/api/tags &> /dev/null; then
            status_success "Ollama service is active!"
            status_info "Pulling/verifying model '$OLLAMA_MODEL'..."
            ollama pull "$OLLAMA_MODEL"
            if [ $? -eq 0 ]; then
                status_success "Model '$OLLAMA_MODEL' is ready."
            else
                status_warning "Failed to pull model '$OLLAMA_MODEL'. Make sure Ollama is running and model name is correct."
            fi
        else
            status_warning "Ollama service is not running. Please start the Ollama application first."
        fi
    else
        status_warning "Ollama is required to pull the model. Please ensure it is running: https://ollama.com"
    fi
fi

echo
echo -e "${GREEN}${BOLD}=================================================="
echo -e "              Setup Completed!"
echo -e "==================================================${NC}"
echo

read -p "$(echo -e "${YELLOW}Would you like to start the application now? [Y/n]: ${NC}")" START_APP
START_APP=${START_APP:-Y}

if [[ "$START_APP" =~ ^[yY]$ ]]; then
    status_info "Starting Vite developer server..."
    echo -e "${BLUE}Press Ctrl+C to stop the application.${NC}"
    echo
    npm run dev
else
    status_info "Setup completed. You can start the app later by running: ${BOLD}npm run dev${NC}"
fi
