import streamlit as st
import pandas as pd
from scraper import scrape_google_maps_reviews

st.set_page_config(page_title="Google Maps Review Scraper", page_icon="🗺️", layout="wide")

st.title("🗺️ Google Maps Review Scraper")
st.markdown("快速爬取 Google Maps 商家的評論資料。請注意 Google 具有反爬蟲機制，若爬取過快或過多可能會被暫時阻擋 IP。")

st.sidebar.header("設定 (Settings)")
url_input = st.text_input("輸入商家評論網址 (Google Maps URL):", 
                          value="",
                          placeholder="https://www.google.com/maps/place/.../data=...")

max_reviews = st.sidebar.number_input("最多抓取評論數 (Max Reviews):", min_value=1, max_value=500, value=200, step=10)

if st.button("🚀 開始抓取 (Start Auto-Scraping)", type="primary"):
    if not url_input.strip():
        st.error("請提供有效的 Google Maps 商家網址！")
    else:
        with st.spinner(f"正在啓動隱身模組爬取前 {max_reviews} 筆評論資料... 這可能需要幾分鐘的時間。"):
            try:
                # 呼叫爬蟲程式
                df = scrape_google_maps_reviews(url_input, max_reviews=max_reviews)
                
                if df.empty:
                    st.warning("無法抓取到資料，請確認網址是否正確且直接指向商家的評論頁面，或 Google 正在阻擋爬蟲請求。")
                else:
                    st.success(f"✅ 成功抓取 {len(df)} 筆評論！")
                    
                    # 顯示資料表格
                    st.dataframe(df, use_container_width=True)
                    
                    # 提供 CSV 下載
                    csv = df.to_csv(index=False).encode('utf-8-sig') # utf-8-sig 讓 Excel 正確讀取中文
                    st.download_button(
                        label="📥 下載評論結果為 CSV",
                        data=csv,
                        file_name='google_maps_reviews.csv',
                        mime='text/csv',
                    )
            except Exception as e:
                st.error(f"❌ 爬取過程中發生錯誤：{str(e)}")

st.markdown("---")
st.caption("Developed with Python & Playwright. For educational purposes only.")