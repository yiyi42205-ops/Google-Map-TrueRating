import time
import re
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import pandas as pd
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup

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
    # Ensure reviews are loaded by waiting or scrolling a bit
    try:
        page.wait_for_selector('.jftiEf', timeout=50000)
    except Exception:
        # If not found, try to scroll the main scrollable area a few times to trigger lazy loading
        print("Initial wait for reviews timeout, attempting to scroll main pane...")
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
            page.wait_for_selector('.jftiEf', timeout=50000)
        except Exception as e:
            print("Could not find any review elements (.jftiEf) even after scrolling.")
            return reviews_data
    
    last_review_count = 0
    consecutive_same_count = 0
    
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
        
        # If no new reviews are loading, we might have hit the end
        if len(review_elements) == last_review_count:
            consecutive_same_count += 1
            if consecutive_same_count >= 3:
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

def scrape_google_maps_reviews(url: str, max_reviews: int = 50) -> pd.DataFrame:
    with sync_playwright() as p:
        # 使用儲存設定的目錄 (Persistent Context)，讓登入狀態可以保留
        user_data_dir = "chrome_auth_data"
        try:
            # 優先嘗試啟動本機的 Chrome 瀏覽器
            context = p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=False, 
                channel="chrome", 
                ignore_default_args=["--enable-automation"],
                args=['--disable-blink-features=AutomationControlled'],
                locale="zh-TW",
                viewport={"width": 1280, "height": 720}
            )
        except Exception:
            # Fallback to default chromium
            context = p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=False, 
                ignore_default_args=["--enable-automation"],
                args=['--disable-blink-features=AutomationControlled'],
                locale="zh-TW",
                viewport={"width": 1280, "height": 720}
            )
            
        page = context.pages[0] if context.pages else context.new_page()
        Stealth().apply_stealth_sync(page)
        
        # Navigate to the Maps URI
        page.goto(url, wait_until="load")
        
        # We need to ensure we are on the "Reviews" tab if it's a general place URL
        # We can look for the button containing text "Reviews" or "評論" 
        try:
            # Look for the Reviews tab, or a generic "More reviews" / "Reviews" button
            # This handles Google Maps A/B testing layouts where Reviews is a button instead of a tab
            tab_locator = page.locator("button[role='tab']:has-text('Reviews'), button[role='tab']:has-text('評論'), button:has-text('更多評論'), button:has-text('More reviews')")
            if tab_locator.count() > 0:
                tab_locator.first.click(timeout=50000)
            time.sleep(3)
        except Exception:
            pass
        
        data = scroll_and_extract_reviews(page, max_reviews)
        context.close()
        
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
                print(json.dumps([]))
            else:
                # Convert DataFrame to a list of dicts and print as JSON
                records = df.to_dict(orient="records")
                print(json.dumps(records, ensure_ascii=False))
        except Exception as e:
            # Output error inside JSON to let caller handle
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
    else:
        # Default test block
        test_url = "https://www.google.com/maps/place/Googleplex/@37.4220656,-122.0840897,17z/data=!3m1!4b1!4m6!3m5!1s0x808fba02425dad8f:0x6c296c66619367e0!8m2!3d37.4220656!4d-122.0840897!16zL20vMDMweXNi?entry=ttu"
        df = scrape_google_maps_reviews(test_url, max_reviews=10)
        print(df.head())