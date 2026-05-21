import time
import re
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import pandas as pd
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup
import sys
import builtins

# Override print to write to stderr by default so that stdout contains only the final JSON data.
# This prevents log messages from interfering with JSON parsing in the middleware.
_print = builtins.print
def print(*args, **kwargs):
    if 'file' not in kwargs:
        kwargs['file'] = sys.stderr
        if 'flush' not in kwargs:
            kwargs['flush'] = True
    _print(*args, **kwargs)

def parse_relative_time(relative_str: str) -> str:
    """
    Parses a Google Maps relative review date (e.g. "3 年前", "2 months ago")
    and returns the absolute date in YYYY-MM-DD format.
    """
    if not relative_str or relative_str == "N/A":
        return "N/A"
    
    # Strip common prefixes and suffixes
    clean_str = (relative_str
                 .replace("上次編輯：", "")
                 .replace("編輯於", "")
                 .replace("(已編輯)", "")
                 .replace("(Edited)", "")
                 .strip())
    
    now = datetime.now()
    
    try:
        # Years (e.g., "3 年前", "3 years ago")
        if re.search(r'(\d+)\s*(?:年|year)', clean_str):
            years = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - relativedelta(years=years)
            return date_val.strftime("%Y-%m-%d")
        elif "a year" in clean_str or "an year" in clean_str or clean_str == "1年前":
            date_val = now - relativedelta(years=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Months (e.g., "2 個月前", "2 months ago")
        elif re.search(r'(\d+)\s*(?:個月|month)', clean_str):
            months = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - relativedelta(months=months)
            return date_val.strftime("%Y-%m-%d")
        elif "a month" in clean_str or clean_str == "1個月前":
            date_val = now - relativedelta(months=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Weeks (e.g., "3 週前", "3 weeks ago", "a week ago")
        elif re.search(r'(\d+)\s*(?:週|星期|week)', clean_str):
            weeks = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - timedelta(weeks=weeks)
            return date_val.strftime("%Y-%m-%d")
        elif "a week" in clean_str or clean_str == "1週前" or clean_str == "1星期前":
            date_val = now - timedelta(weeks=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Days (e.g., "5 天前", "5 days ago", "yesterday")
        elif re.search(r'(\d+)\s*(?:天|day)', clean_str):
            days = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - timedelta(days=days)
            return date_val.strftime("%Y-%m-%d")
        elif "a day" in clean_str or "yesterday" in clean_str or "昨天" in clean_str or clean_str == "1天前":
            date_val = now - timedelta(days=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Hours (e.g., "18 小時前", "18 hours ago")
        elif re.search(r'(\d+)\s*(?:小時|hour)', clean_str):
            hours = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - timedelta(hours=hours)
            return date_val.strftime("%Y-%m-%d")
        elif "an hour" in clean_str or clean_str == "1小時前":
            date_val = now - timedelta(hours=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Minutes (e.g., "30 分鐘前", "30 minutes ago")
        elif re.search(r'(\d+)\s*(?:分鐘|minute)', clean_str):
            minutes = int(re.search(r'(\d+)', clean_str).group(1))
            date_val = now - timedelta(minutes=minutes)
            return date_val.strftime("%Y-%m-%d")
        elif "a minute" in clean_str or clean_str == "1分鐘前":
            date_val = now - timedelta(minutes=1)
            return date_val.strftime("%Y-%m-%d")
            
        # Just now / Today (e.g., "剛剛", "just now", "today")
        elif "剛剛" in clean_str or "just now" in clean_str or "today" in clean_str or "今天" in clean_str:
            return now.strftime("%Y-%m-%d")
            
    except Exception as e:
        print(f"Error parsing relative date '{relative_str}': {e}")
        
    return relative_str

def scroll_and_extract_reviews(page, max_reviews: int = 50):
    """
    Scrolls the Google Maps review pane down to sequentially load lazy-loaded elements.
    """
    reviews_data = []
    print("[Python Scraper] Waiting for review elements (.jftiEf) to appear...")
    # Ensure reviews are loaded by waiting or scrolling a bit
    try:
        page.wait_for_selector('.jftiEf', timeout=15000)
        print("[Python Scraper] Found initial review elements.")
    except Exception as e:
        # If not found, try to scroll the main scrollable area a few times to trigger lazy loading
        print(f"[Python Scraper] Initial wait for reviews timeout/error: {e}. Attempting to scroll main pane...")
        page.evaluate('''
            var main_pane = document.querySelector('.kA9KIf.dS8AEf, div[role="main"] .kA9KIf, .m6QErb.DxyBCb');
            if (main_pane) {
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => { main_pane.scrollTop += 3000; }, i * 1000);
                }
            }
        ''')
        time.sleep(6) # wait for the scrolling to finish
        try:
            page.wait_for_selector('.jftiEf', timeout=15000)
            print("[Python Scraper] Found review elements after scrolling main pane.")
        except Exception as e_fallback:
            print(f"[Python Scraper] Could not find any review elements (.jftiEf) even after scrolling: {e_fallback}")
            return reviews_data
    
    last_review_count = 0
    consecutive_same_count = 0
    print("[Python Scraper] Starting review scroll loop...")
    
    while len(reviews_data) < max_reviews:
        # Scroll down by finding the closest scrollable container to the reviews
        page.evaluate('''
            var reviews = document.querySelectorAll('.jftiEf');
            if (reviews.length > 0) {
                var target = reviews[0].parentElement;
                // Go up the tree to find the nearest scrollable container
                while (target && target.tagName !== 'BODY') {
                    if (target.scrollHeight > target.clientHeight) {
                        target.scrollTop = target.scrollHeight;
                        break;
                    }
                    target = target.parentElement;
                }
            }
        ''')
        
        # Wait a bit for the new elements to load
        time.sleep(1.5)
        
        # Click "More" buttons to expand long texts
        try:
            page.evaluate('''
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const btn of buttons) {
                    if (btn.classList.contains('w8nwRe') || 
                        btn.classList.contains('kyuIte') || 
                        btn.textContent.trim() === '全文' || 
                        btn.textContent.trim() === 'More' || 
                        btn.textContent.includes('顯示更多') ||
                        (btn.getAttribute('aria-label') && (
                            btn.getAttribute('aria-label').includes('See more') || 
                            btn.getAttribute('aria-label').includes('全文') ||
                            btn.getAttribute('aria-label').includes('顯示更多')
                        ))
                    ) {
                        btn.click();
                    }
                }
            ''')
            time.sleep(0.5) # Wait a short moment for the content to expand and render
        except Exception as e:
            print(f"Error expanding reviews: {e}")
        html = page.content()
        soup = BeautifulSoup(html, "html.parser")
        
        # The main wrapper for a single review
        review_elements = soup.find_all("div", class_="jftiEf")
        print(f"[Python Scraper] Currently found {len(review_elements)} review elements on page (Target: {max_reviews}).")
        
        # If no new reviews are loading, we might have hit the end
        if len(review_elements) == last_review_count:
            consecutive_same_count += 1
            print(f"[Python Scraper] Review count didn't increase ({len(review_elements)}). Consecutive attempts: {consecutive_same_count}/3")
            if consecutive_same_count >= 3:
                print("[Python Scraper] Hit the end of reviews or page stopped loading new ones.")
                break
        else:
            consecutive_same_count = 0
            
        last_review_count = len(review_elements)
    
        # Re-parse to avoid duplicates and get structured data
        reviews_data = []
        for el in review_elements[:max_reviews]:
            try:
                # Username
                user_name_el = el.find("div", class_="d4r55")
                user_name = user_name_el.text.strip() if user_name_el else "Unknown User"
                
                # Rating Stars (Based on aria-label "5 stars")
                rating_el = el.find("span", class_="kvMYJc")
                rating = rating_el["aria-label"] if rating_el and "aria-label" in rating_el.attrs else "N/A"
                if rating != "N/A":
                    # Extract just the number
                    rating = rating.split(" ")[0]
                
                # Relative Time
                time_el = el.find("span", class_="rsqaWe")
                review_time = time_el.text.strip() if time_el else "N/A"
                
                # Review Text
                text_el = el.find("span", class_="wiI7pd")
                review_text = text_el.text.strip() if text_el else ""
                
                # Pictures (Background URLs from button elements inside the review)
                images = []
                img_buttons = el.find_all("button", class_="Tya61d")
                for img_btn in img_buttons:
                    style = img_btn.get("style", "")
                    if "background-image" in style:
                        # Extract URL from background-image: url("...")
                        url_part = style.split('url("')[-1].split('")')[0]
                        images.append(url_part)
                
                reviews_data.append({
                    "Username": user_name,
                    "Stars": rating,
                    "Time": parse_relative_time(review_time),
                    "RawTime": review_time,
                    "Text": review_text,
                    "Images": ", ".join(images)
                })
            except Exception as e:
                print(f"Error parsing a review element: {e}")
                continue

    return reviews_data

def safe_rmtree(path: str, max_retries: int = 10, delay: float = 0.5):
    """
    Attempts to delete a directory, retrying if files are locked.
    """
    import shutil
    import time
    import os
    if not os.path.exists(path):
        return
    for i in range(max_retries):
        try:
            shutil.rmtree(path)
            print(f"[Python Scraper] Successfully removed directory: {path}")
            return
        except Exception as e:
            if i == max_retries - 1:
                print(f"[Python Scraper] Warning: Final attempt to delete {path} failed: {e}")
                shutil.rmtree(path, ignore_errors=True)
            else:
                print(f"[Python Scraper] Directory {path} locked or busy, retrying in {delay}s... (Attempt {i+1}/{max_retries})")
                time.sleep(delay)

def cleanup_old_sessions(parent_dir: str, max_age_seconds: int = 300):
    """
    Cleans up any subdirectories in parent_dir that are older than max_age_seconds.
    Also cleans up legacy chrome_auth_data_* directories in the current working directory.
    """
    import os
    import time
    
    # 1. Clean up legacy directories in current working directory
    now = time.time()
    for item in os.listdir("."):
        if os.path.isdir(item) and item.startswith("chrome_auth_data_") and item != "chrome_auth_data":
            try:
                mtime = os.path.getmtime(item)
                if now - mtime > max_age_seconds:
                    print(f"[Python Scraper] Cleaning up legacy auth directory in cwd: {item}")
                    safe_rmtree(item)
            except Exception as e:
                print(f"[Python Scraper] Warning: failed to clean up legacy directory {item}: {e}")
                
    # 2. Clean up session directories in the parent_dir
    if not os.path.exists(parent_dir):
        return
    for item in os.listdir(parent_dir):
        item_path = os.path.join(parent_dir, item)
        if os.path.isdir(item_path) and item.startswith("session_"):
            try:
                mtime = os.path.getmtime(item_path)
                if now - mtime > max_age_seconds:
                    print(f"[Python Scraper] Cleaning up expired session directory: {item_path}")
                    safe_rmtree(item_path)
            except Exception as e:
                print(f"[Python Scraper] Warning: failed to clean up old session {item_path}: {e}")

def scrape_google_maps_reviews(url: str, max_reviews: int = 50) -> pd.DataFrame:
    print(f"[Python Scraper] Starting scraper for URL: {url} (max_reviews={max_reviews})")
    import hashlib
    import os
    
    parent_dir = "chrome_auth_data"
    cleanup_old_sessions(parent_dir)
    
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
    os.makedirs(parent_dir, exist_ok=True)
    user_data_dir = os.path.join(parent_dir, f"session_{url_hash}")
    print(f"[Python Scraper] User data directory set to: {user_data_dir}")
    
    data = []
    max_attempts = 3
    
    for attempt in range(1, max_attempts + 1):
        print(f"[Python Scraper] Scrape attempt {attempt} of {max_attempts}...")
        try:
            with sync_playwright() as p:
                try:
                    print("[Python Scraper] Attempting to launch system Google Chrome (channel='chrome')...")
                    # 優先嘗試啟動本機的 Chrome 瀏覽器
                    context = p.chromium.launch_persistent_context(
                        user_data_dir=user_data_dir,
                        headless=False, 
                        channel="chrome", 
                        ignore_default_args=["--enable-automation"],
                        args=['--disable-blink-features=AutomationControlled', '--new-window'],
                        locale="zh-TW",
                        viewport={"width": 1280, "height": 720}
                    )
                    print("[Python Scraper] System Google Chrome launched successfully.")
                except Exception as e:
                    print(f"[Python Scraper] Failed to launch system Google Chrome: {e}")
                    print("[Python Scraper] Falling back to default Playwright Chromium browser...")
                    try:
                        # Fallback to default chromium
                        context = p.chromium.launch_persistent_context(
                            user_data_dir=user_data_dir,
                            headless=False, 
                            ignore_default_args=["--enable-automation"],
                            args=['--disable-blink-features=AutomationControlled', '--new-window'],
                            locale="zh-TW",
                            viewport={"width": 1280, "height": 720}
                        )
                        print("[Python Scraper] Playwright Chromium browser launched successfully.")
                    except Exception as fallback_e:
                        print(f"[Python Scraper] Fallback launch failed: {fallback_e}")
                        print("[Python Scraper] Critical Hint: Make sure you ran 'playwright install' or no other chrome process is locking the user data directory.")
                        raise fallback_e
                    
                page = context.pages[0] if context.pages else context.new_page()
                Stealth().apply_stealth_sync(page)
                
                # Navigate to the Maps URI
                print(f"[Python Scraper] Navigating to URL: {url}")
                page.goto(url, wait_until="load")
                print("[Python Scraper] Navigation complete. Loading page elements...")
                
                # We need to ensure we are on the "Reviews" tab if it's a general place URL
                print("[Python Scraper] Locating Reviews tab/button...")
                tab_found = False
                try:
                    # Wait for either tabs or review elements to be present in the DOM
                    try:
                        page.wait_for_selector('[role="tab"], .jftiEf, button:has-text("更多評論"), button:has-text("More reviews")', timeout=10000)
                    except Exception as wait_e:
                        print(f"[Python Scraper] Warning: timeout waiting for tab/review indicators: {wait_e}")
        
                    # Run JS evaluation to locate and click the correct Reviews tab or button
                    click_result = page.evaluate('''() => {
                        const keywords = ['評論', '评论', 'review', 'クチコミ', '리뷰', 'reseña', 'avis', 'rezension', 'recensioni', 'comentários', 'отзывы'];
                        const excludeKeywords = ['撰寫', 'write', 'post', 'add', 'create', '編輯', 'edit'];
                        
                        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
                        
                        // 1. Try to find the Reviews tab
                        let reviewsTab = tabs.find(tab => {
                            const text = tab.textContent.trim().toLowerCase();
                            const label = (tab.getAttribute('aria-label') || '').toLowerCase();
                            const matchesKw = keywords.some(kw => text.includes(kw) || label.includes(kw));
                            const matchesExclude = excludeKeywords.some(ex => text.includes(ex) || label.includes(ex));
                            return matchesKw && !matchesExclude;
                        });
                        
                        // Fallback tab matching with jslog (145620 is Google Maps' compiled ID for the Reviews tab)
                        if (!reviewsTab) {
                            reviewsTab = tabs.find(tab => {
                                const jslog = tab.getAttribute('jslog') || '';
                                return jslog.includes('145620');
                            });
                        }
                        
                        if (reviewsTab) {
                            const isSelected = reviewsTab.getAttribute('aria-selected') === 'true' || 
                                              (reviewsTab.className && reviewsTab.className.includes('selected'));
                            if (isSelected) {
                                return { success: true, action: "none", message: "Reviews tab is already selected", name: reviewsTab.textContent.trim() };
                            } else {
                                reviewsTab.click();
                                return { success: true, action: "click_tab", message: "Clicked reviews tab", name: reviewsTab.textContent.trim() };
                            }
                        }
                        
                        // 2. Fallback to buttons/links
                        const interactives = Array.from(document.querySelectorAll('button, [role="button"], a'));
                        let reviewsBtn = interactives.find(btn => {
                            const text = btn.textContent.trim().toLowerCase();
                            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                            
                            const matchesKw = keywords.some(kw => text.includes(kw) || label.includes(kw));
                            const matchesExclude = excludeKeywords.some(ex => text.includes(ex) || label.includes(ex));
                            const isReviewTrigger = text.includes('更多') || text.includes('more') || /\\d+/.test(text) || text === '評論' || text === 'reviews';
                            
                            return matchesKw && !matchesExclude && isReviewTrigger;
                        });
                        
                        if (reviewsBtn) {
                            reviewsBtn.click();
                            return { success: true, action: "click_button", message: "Clicked reviews button/link", name: reviewsBtn.textContent.trim() };
                        }
                        
                        return { success: false, message: "Could not find any Reviews tab or button" };
                    }''')
                    
                    print(f"[Python Scraper] Navigation result: {click_result}")
                    tab_found = click_result.get("success", False)
                    
                    if tab_found:
                        if click_result.get("action") != "none":
                            time.sleep(4)
                        
                except Exception as tab_e:
                    print(f"[Python Scraper] Warning/Exception locating reviews tab: {tab_e}")
                    tab_found = False
                
                if not tab_found:
                    raise RuntimeError("Reviews tab/button not found")
                
                data = scroll_and_extract_reviews(page, max_reviews)
                context.close()
                print(f"[Python Scraper] Scrape process finished on attempt {attempt}. Extracted {len(data)} review records.")
                break  # Success, exit retry loop
        except Exception as run_e:
            print(f"[Python Scraper] Error during attempt {attempt}: {run_e}")
            if attempt < max_attempts:
                print(f"[Python Scraper] Retrying in 2 seconds...")
                time.sleep(2)
                continue
            else:
                if "Reviews tab/button not found" in str(run_e):
                    print(f"[Python Scraper] Failed to find reviews tab after {max_attempts} attempts.")
                    break
                raise run_e
        finally:
            if os.path.exists(user_data_dir):
                print(f"[Python Scraper] Cleaning up user data directory: {user_data_dir}")
                safe_rmtree(user_data_dir)

    return pd.DataFrame(data)

if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) > 1:
        # CLI execution mode
        url = sys.argv[1]
        max_reviews = 50
        if len(sys.argv) > 2:
            try:
                max_reviews = int(sys.argv[2])
            except ValueError:
                pass
        try:
            df = scrape_google_maps_reviews(url, max_reviews=max_reviews)
            if df.empty:
                print(json.dumps([]), file=sys.stdout)
            else:
                # Convert DataFrame to a list of dicts and print as JSON
                records = df.to_dict(orient="records")
                print(json.dumps(records, ensure_ascii=False), file=sys.stdout)
        except Exception as e:
            # Output error inside JSON to let caller handle
            print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stdout)
    else:
        # Default test block
        test_url = "https://www.google.com/maps/place/Googleplex/@37.4220656,-122.0840897,17z/data=!3m1!4b1!4m6!3m5!1s0x808fba02425dad8f:0x6c296c66619367e0!8m2!3d37.4220656!4d-122.0840897!16zL20vMDMweXNi?entry=ttu"
        df = scrape_google_maps_reviews(test_url, max_reviews=10)
        print(df.head(), file=sys.stdout)