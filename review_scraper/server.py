from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re
import logging
import time
import traceback
from scraper import scrape_google_maps_reviews

# Configure logging format and level
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger("ScraperServer")

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def index():
    logger.info(f"Root path '/' accessed by IP: {request.remote_addr}")
    return jsonify({
        "status": "ok",
        "message": "Google Maps Scraper and Ollama Proxy Service is running"
    })

@app.route("/api/scrape", methods=["POST"])
def scrape():
    start_time = time.time()
    ip = request.remote_addr
    logger.info(f"POST /api/scrape request from IP: {ip}")
    
    data = request.get_json() or {}
    url = data.get("url")
    if not url:
        logger.error(f"Scrape request from {ip} failed validation: Missing required field 'url'")
        return jsonify({"error": "Missing required field: url"}), 400
    
    max_reviews = data.get("maxReviews") or 50
    try:
        max_reviews = int(max_reviews)
    except ValueError:
        logger.warning(f"Invalid maxReviews value received: {data.get('maxReviews')}. Defaulting to 50.")
        max_reviews = 50

    try:
        logger.info(f"Starting review scraping for URL: {url} (limit: {max_reviews})")
        df = scrape_google_maps_reviews(url, max_reviews=max_reviews)
        
        if df.empty:
            logger.info("Scraping completed. No reviews retrieved.")
            records = []
        else:
            records = df.to_dict(orient="records")
            logger.info(f"Scraping completed successfully. Retrieved {len(records)} reviews in {time.time() - start_time:.2f} seconds.")
            
        return jsonify({"reviews": records})
    except Exception as e:
        logger.error(f"Scraping error occurred: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/api/audit-local", methods=["POST"])
def audit_local():
    start_time = time.time()
    ip = request.remote_addr
    logger.info(f"POST /api/audit-local request from IP: {ip}")
    
    data = request.get_json() or {}
    reviews = data.get("reviews")
    model = data.get("model") or "gemma4:e4b"
    if not reviews or not isinstance(reviews, list):
        logger.error(f"Audit request from {ip} failed validation: Missing or invalid required field 'reviews'")
        return jsonify({"error": "Missing or invalid required field: reviews"}), 400

    logger.info(f"Loading audit prompt template for {len(reviews)} reviews...")
    import os
    prompt_path = os.path.join(os.path.dirname(__file__), 'audit_prompt.txt')
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
        logger.info("Successfully read prompt template.")
    except Exception as e:
        logger.error(f"Failed to read prompt template file: {e}")
        return jsonify({"error": f"Failed to read prompt template: {str(e)}"}), 500

    prompt = (
        prompt_template
        .replace('{store_name}', '待審查店家')
        .replace('{review_count}', str(len(reviews)))
        .replace('{reviews_json}', json.dumps(reviews, ensure_ascii=False, indent=2))
    )

    ollama_payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "options": {
            "temperature": 0.1
        },
        "format": "json",
        "stream": False
    }

    try:
        logger.info(f"Forwarding audit request of {len(reviews)} reviews to local Ollama ({model})...")
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json=ollama_payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        logger.info("Ollama request returned success. Parsing response content...")
        
        response_json = response.json()
        content_str = response_json.get("message", {}).get("content", "").strip()
        
        # Strip markdown fences if present
        if content_str.startswith("```"):
            content_str = re.sub(r"^```(?:json)?\n?", "", content_str, flags=re.IGNORECASE)
            content_str = re.sub(r"\n?```$", "", content_str, flags=re.IGNORECASE).strip()

        # Extract JSON array or object using regex
        array_match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", content_str)
        if array_match:
            content_str = array_match.group(0)
        else:
            obj_match = re.search(r"\{\s*[\s\S]*\}", content_str)
            if obj_match:
                content_str = obj_match.group(0)

        parsed_content = json.loads(content_str)
        
        # Normalize to list of reviews
        if not isinstance(parsed_content, list):
            if isinstance(parsed_content, dict):
                if "reviews" in parsed_content and isinstance(parsed_content["reviews"], list):
                    parsed_content = parsed_content["reviews"]
                elif "results" in parsed_content and isinstance(parsed_content["results"], list):
                    parsed_content = parsed_content["results"]
                else:
                    # Find any list in the keys
                    found_list = False
                    for key, val in parsed_content.items():
                        if isinstance(val, list):
                            parsed_content = val
                            found_list = True
                            break
                    if not found_list:
                        raise ValueError("Model response does not contain a JSON list of reviews")
            else:
                raise ValueError("Model response is not a valid JSON structure")

        logger.info(f"Successfully processed audit results of {len(parsed_content)} items in {time.time() - start_time:.2f} seconds.")
        return jsonify({"result": parsed_content})
    except Exception as e:
        logger.error(f"Local audit proxy error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Initializing Flask server configurations...")
    logger.info("Starting Flask server on host 0.0.0.0, port 5001...")
    app.run(host="0.0.0.0", port=5001)
