from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re
from scraper import scrape_google_maps_reviews

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "ok",
        "message": "Google Maps Scraper and Ollama Proxy Service is running"
    })

@app.route("/api/scrape", methods=["POST"])
def scrape():
    data = request.get_json() or {}
    url = data.get("url")
    if not url:
        return jsonify({"error": "Missing required field: url"}), 400
    
    max_reviews = data.get("maxReviews") or 50
    try:
        max_reviews = int(max_reviews)
    except ValueError:
        max_reviews = 50

    try:
        print(f"[Python Scraper Server] Scraping reviews for URL: {url} (limit: {max_reviews})")
        df = scrape_google_maps_reviews(url, max_reviews=max_reviews)
        
        if df.empty:
            records = []
        else:
            records = df.to_dict(orient="records")
            
        return jsonify({"reviews": records})
    except Exception as e:
        print(f"[Python Scraper Server] Scraping error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/audit-local", methods=["POST"])
def audit_local():
    # NOTE: This endpoint is preserved for test scripts like test_two_stages.cjs.
    # The main frontend web application now calls Ollama directly via Vite proxy.
    data = request.get_json() or {}
    reviews = data.get("reviews")
    if not reviews or not isinstance(reviews, list):
        return jsonify({"error": "Missing or invalid required field: reviews"}), 400

    import os
    prompt_path = os.path.join(os.path.dirname(__file__), 'audit_prompt.txt')
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except Exception as e:
        return jsonify({"error": f"Failed to read prompt template: {str(e)}"}), 500

    prompt = (
        prompt_template
        .replace('{store_name}', '待審查店家')
        .replace('{review_count}', str(len(reviews)))
        .replace('{reviews_json}', json.dumps(reviews, ensure_ascii=False, indent=2))
    )

    ollama_payload = {
        "model": "gemma4:e4b",
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
        print(f"[Python Scraper Server] Forwarding {len(reviews)} reviews to local Ollama...")
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json=ollama_payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
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

        return jsonify({"result": parsed_content})
    except Exception as e:
        print(f"[Python Scraper Server] Local audit proxy error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("[Python Scraper Server] Starting Flask server on port 5001...")
    app.run(host="0.0.0.0", port=5001)
