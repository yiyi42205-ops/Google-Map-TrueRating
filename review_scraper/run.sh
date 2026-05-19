#!/bin/bash
# Move to the script's directory
cd "$(dirname "$0")"

# Ensure dependencies are installed in case the previous pip install failed or was interrupted
echo "Checking dependencies..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q streamlit playwright pandas beautifulsoup4 playwright-stealth
playwright install chromium

echo "Starting Google Maps Review Scraper (Streamlit UI)..."
python -m streamlit run app.py
