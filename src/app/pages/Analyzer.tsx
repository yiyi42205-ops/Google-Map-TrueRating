import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Link as LinkIcon, X, Search, Info, Plus, Globe, Sliders, Database, ShieldCheck } from 'lucide-react';
import { RESTAURANTS_DATA, Restaurant } from '../data/restaurantsData';

export function Analyzer() {
  const navigate = useNavigate();
  const [urls, setUrls] = useState<string[]>(['', '', '']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // AI Depth Review Config States
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [auditModel, setAuditModel] = useState<'gemini' | 'gemma'>(() => {
    const saved = localStorage.getItem('audit_model') as 'gemini' | 'gemma';
    if (saved === 'gemini' || saved === 'gemma') return saved;
    const key = localStorage.getItem('gemini_api_key') || '';
    return key.trim() ? 'gemini' : 'gemma';
  });
  const [aiAuditCount, setAiAuditCount] = useState<number>(() => {
    const saved = localStorage.getItem('ai_audit_count');
    return saved ? parseInt(saved, 10) : 15;
  });

  // Suggestion Dropdown states for each slot
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom Scraper states
  const [activeTab, setActiveTab] = useState<'preset' | 'scraper'>('preset');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [maxReviews, setMaxReviews] = useState(50);
  const [scrapeLoadingStep, setScrapeLoadingStep] = useState('');

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveSlot(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
    
    // Open suggestions for this slot and set query
    setActiveSlot(index);
    setSearchQuery(value);
  };

  const handleSelectRestaurant = (slotIndex: number, restaurant: Restaurant) => {
    const newUrls = [...urls];
    newUrls[slotIndex] = restaurant.name;
    setUrls(newUrls);
    setActiveSlot(null);
    setSearchQuery('');
  };

  const handleClear = (index: number) => {
    const newUrls = [...urls];
    newUrls[index] = '';
    setUrls(newUrls);
  };

  const handleAddPreset = (restaurant: Restaurant) => {
    // Find the first empty slot
    const emptyIndex = urls.findIndex(url => url.trim() === '');
    if (emptyIndex !== -1) {
      const newUrls = [...urls];
      newUrls[emptyIndex] = restaurant.name;
      setUrls(newUrls);
    } else {
      // If all full, replace the first one
      const newUrls = [...urls];
      newUrls[0] = restaurant.name;
      setUrls(newUrls);
    }
  };

  const handleAnalyze = () => {
    const filledUrls = urls.filter(url => url.trim() !== '');
    if (filledUrls.length === 0) return;

    // Smart Match logic from inputs to local DB IDs
    const matchedStoreIds = urls.map(input => {
      const trimmed = input.trim().toLowerCase();
      if (!trimmed) return null;

      // 1. Direct Name Match
      let matched = RESTAURANTS_DATA.find(r => r.name.toLowerCase() === trimmed);
      if (matched) return matched.id;

      // 2. Keyword check (e.g. url contains name)
      matched = RESTAURANTS_DATA.find(r => trimmed.includes(r.name.toLowerCase()));
      if (matched) return matched.id;

      // 3. Substring match
      matched = RESTAURANTS_DATA.find(r => r.name.toLowerCase().includes(trimmed) || trimmed.includes(r.name.toLowerCase()));
      if (matched) return matched.id;

      // 4. Specific keyword mappings for raw Google Map URLs
      const keywordMappings: { [key: string]: string } = {
        '長樂': 'ramen_washed_3',
        '好假': 'ramen_washed_1',
        '好呷': 'ramen_washed_2',
        '十二巷': 'ramen_clean_1',
        '小高': 'ramen_clean_2',
        '隱家': 'ramen_clean_3',
        '城市盒子': 'bento_washed_1',
        '村民': 'bento_washed_2',
        '米泰豐': 'bento_washed_3',
        'lulu': 'bento_clean_1',
        '餵': 'bento_clean_2',
        '龍城': 'bento_clean_3',
        '深夜': 'drink_washed_1',
        '發發': 'drink_washed_2',
        '茶沐': 'drink_washed_3',
        '可不可': 'drink_clean_1',
        '清心': 'drink_clean_2',
        '迷客夏': 'drink_clean_3'
      };

      for (const key in keywordMappings) {
        if (trimmed.includes(key)) {
          return keywordMappings[key];
        }
      }

      // Default fallback
      return null;
    }).filter(Boolean) as string[];

    if (matchedStoreIds.length === 0) {
      // If absolutely no match, grab the first 1 or 2 filled items mapped to a default
      // This ensures results page doesn't crash on custom typed text
      const fallbackIds = filledUrls.map((_, i) => RESTAURANTS_DATA[i].id);
      setIsAnalyzing(true);
      setTimeout(() => {
        navigate('/results', { state: { storeIds: fallbackIds, auditModel, apiKey, aiAuditCount } });
      }, 1500);
      return;
    }

    setIsAnalyzing(true);

    // Simulate analysis delay
    setTimeout(() => {
      navigate('/results', { state: { storeIds: matchedStoreIds, auditModel, apiKey, aiAuditCount } });
    }, 1800);
  };
  
  const handleScrapeAndAnalyze = async () => {
    if (!scrapeUrl.trim()) return;
    
    setIsAnalyzing(true);
    setScrapeLoadingStep('正在啟動 Playwright 瀏覽器並開啟隱形模式...');
    
    const steps = [
      '正在定位商家評論分頁並繞過驗證碼...',
      '正在滾動頁面懶加載更多歷史評價...',
      '正在解析評論文字、發布時間與打卡照片...',
      '正在整理資料格式並導回前端...'
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setScrapeLoadingStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 5000);

    try {
      const response = await fetch('http://localhost:5001/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: scrapeUrl,
          maxReviews: maxReviews
        })
      });

      clearInterval(interval);

      if (!response.ok) {
        throw new Error('伺服器爬取失敗，請確認本地爬蟲後端 (PORT 5001) 已開啟，且網址正確。');
      }

      const data = await response.json();
      if (!data.reviews || data.reviews.length === 0) {
        throw new Error('無法抓取到任何評論，可能是網址無效或 Google 正在阻擋爬蟲請求。');
      }

      const mappedReviews = data.reviews.map((item: any) => ({
        username: item.Username || '未知用戶',
        stars: parseInt(item.Stars, 10) || 5,
        time: item.Time || '',
        text: item.Text || '',
        images: item.Images ? item.Images.split(',').map((img: string) => img.trim()).filter(Boolean) : []
      }));

      let storeName = '自定義商家';
      try {
        const match = scrapeUrl.match(/\/place\/([^\/]+)/);
        if (match && match[1]) {
          storeName = decodeURIComponent(match[1].replace(/\+/g, ' '));
        }
      } catch (e) {}

      navigate('/results', {
        state: {
          storeIds: [],
          auditModel,
          apiKey,
          aiAuditCount,
          customShops: [
            {
              id: 'custom_scraped_shop',
              name: storeName,
              reviews: mappedReviews
            }
          ]
        }
      });
    } catch (e: any) {
      clearInterval(interval);
      console.error(e);
      alert(`爬取錯誤: ${e.message || '請確認本地後端伺服器已開啟 (npm run start)'}`);
    } finally {
      setIsAnalyzing(false);
      setScrapeLoadingStep('');
    }
  };

  const filledCount = urls.filter(url => url.trim() !== '').length;

  // Filter recommendations based on search queries
  const filteredSuggestions = searchQuery.trim() === ''
    ? []
    : RESTAURANTS_DATA.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.categoryLabel.includes(searchQuery)
      );

  // Grouped presets for recommendation panel
  const ramenPresets = RESTAURANTS_DATA.filter(r => r.category === 'ramen').slice(0, 4);
  const bentoPresets = RESTAURANTS_DATA.filter(r => r.category === 'bento').slice(0, 4);
  const drinkPresets = RESTAURANTS_DATA.filter(r => r.category === 'drinks').slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f5f1e8] py-8 px-4 font-sans selection:bg-[#6b8e7f]/20">
      <div className="container mx-auto max-w-4xl">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate('/')}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mb-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all border border-[#d4c5b0] text-[#4a5d52] font-medium cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#6b8e7f]" />
          返回首頁
        </motion.button>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 shadow-sm border border-[#e8c547]/40 flex items-start gap-3"
        >
          <Info className="w-5 h-5 text-[#e8c547] shrink-0 mt-0.5" />
          <div className="text-sm text-[#4a5d52]">
            <span className="font-bold text-[#e8c547]">【金標評價測試數據集】</span>
            本系統內建拉麵、手搖飲、健康便當等 18 間店家真實 Google Map 歷史評價數據。你可以直接在下方欄位搜尋輸入，或使用下方推薦區快速選取進行<b>多店「濾水」對比分析</b>！
          </div>
        </motion.div>

        {/* Analysis Box */}
        <div className="relative w-full max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border-2 border-[#d4c5b0]/60">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="text-4xl mb-2 tracking-widest">★☆★☆★</div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#4a5d52] mb-1">
                真星評價篩選器（疑騙真星）
              </h1>
              <p className="text-sm text-[#6b8e7f]">
                輸入店家名稱、貼上 Google Maps 連結，或點擊下方推薦卡片
              </p>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-[#f5f1e8] rounded-2xl mb-6 border border-[#e8dcc8]">
              <button
                onClick={() => setActiveTab('preset')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                  activeTab === 'preset'
                    ? 'bg-white text-[#4a5d52] shadow-sm border border-[#d4c5b0]'
                    : 'text-[#6b8e7f] hover:text-[#4a5d52]'
                }`}
              >
                <Database className="w-4 h-4" />
                內建數據集對比
              </button>
              <button
                onClick={() => setActiveTab('scraper')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                  activeTab === 'scraper'
                    ? 'bg-white text-[#4a5d52] shadow-sm border border-[#d4c5b0]'
                    : 'text-[#6b8e7f] hover:text-[#4a5d52]'
                }`}
              >
                <Globe className="w-4 h-4 animate-pulse text-[#e8c547]" />
                Google Maps 即時爬取
              </button>
            </div>

            {activeTab === 'preset' ? (
              <>
                {/* Status Bar */}
                <div className="bg-[#f5f1e8]/70 rounded-2xl p-3.5 mb-6 border border-[#e8dcc8]">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-[#6b8e7f]">
                      <div className="w-2.5 h-2.5 bg-[#e8c547] rounded-full animate-ping"></div>
                      <span className="font-medium">分析就緒，請添加店家</span>
                    </div>
                    <span className="text-[#4a5d52] font-extrabold bg-white px-2.5 py-0.5 rounded-full border border-[#d4c5b0]">
                      已選 {filledCount} / 3 間
                    </span>
                  </div>
                </div>

                {/* URL Input Slots */}
                <div className="space-y-4 mb-6 relative" ref={dropdownRef}>
                  {urls.map((url, index) => {
                    const isMatched = RESTAURANTS_DATA.some(r => r.name === url);
                    const matchedStore = RESTAURANTS_DATA.find(r => r.name === url);
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.08 }}
                        className={`rounded-2xl p-4 border transition-all duration-200 ${
                          isMatched
                            ? 'bg-[#6b8e7f]/10 border-[#6b8e7f]/40 shadow-sm'
                            : 'bg-[#f5f1e8]/40 border-[#e8dcc8] hover:border-[#d4c5b0]'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`font-bold px-3 py-0.5 rounded-full text-xs border ${
                            isMatched
                              ? 'bg-[#6b8e7f] text-white border-[#4a5d52]'
                              : 'bg-[#e8c547] text-[#4a5d52] border-[#4a5d52]'
                          }`}>
                            對比店家 {index + 1}
                          </div>
                          {isMatched && matchedStore && (
                            <span className="text-xs font-semibold text-[#4a5d52] flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6b8e7f]"></span>
                              已成功載入資料集庫：
                              <span className="text-[#6b8e7f]">【{matchedStore.categoryLabel}】</span>
                            </span>
                          )}
                          {url && (
                            <motion.button
                              onClick={() => handleClear(index)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="ml-auto bg-[#d4a5a5] text-white p-1 rounded-full border border-[#4a5d52] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </motion.button>
                          )}
                        </div>
                        <div className="relative">
                          {isMatched ? (
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b8e7f]" />
                          ) : (
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b8e7f]" />
                          )}
                          
                          <input
                            type="text"
                            value={url}
                            onChange={(e) => handleUrlChange(index, e.target.value)}
                            onFocus={() => {
                              setActiveSlot(index);
                              setSearchQuery(url);
                            }}
                            placeholder="點擊下方快速選取，或直接在此搜尋店家名稱..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-[#d4c5b0] focus:border-[#6b8e7f] focus:ring-1 focus:ring-[#6b8e7f] outline-none text-[#4a5d52] font-medium placeholder-[#a0b3a0] transition-shadow text-sm"
                          />

                          {/* Dropdown Suggestions */}
                          {activeSlot === index && filteredSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#d4c5b0] z-50 max-h-56 overflow-y-auto">
                              {filteredSuggestions.map((restaurant) => (
                                <button
                                  key={restaurant.id}
                                  onClick={() => handleSelectRestaurant(index, restaurant)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-[#6b8e7f]/10 flex items-center justify-between border-b border-[#f5f1e8] last:border-0 transition-colors text-sm"
                                >
                                  <div>
                                    <span className="font-bold text-[#4a5d52]">{restaurant.name}</span>
                                    <span className="ml-2 text-xs bg-[#e8dcc8] text-[#4a5d52] px-2 py-0.5 rounded-md">
                                      {restaurant.categoryLabel}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#6b8e7f] font-semibold">
                                    {restaurant.isWashed ? '⚠️ 包含贈禮刷評行為' : '✅ 綠色有機真實評論'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Main Action Button */}
                <motion.button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || filledCount === 0}
                  whileHover={{ scale: filledCount > 0 && !isAnalyzing ? 1.02 : 1 }}
                  whileTap={{ scale: filledCount > 0 && !isAnalyzing ? 0.98 : 1 }}
                  className="w-full bg-[#6b8e7f] hover:bg-[#5b7d6e] text-white font-extrabold text-base py-3.5 rounded-full shadow-md disabled:bg-[#c9bfae] disabled:cursor-not-allowed border-2 border-[#4a5d52] disabled:border-[#a0b3a0] transition-all cursor-pointer"
                >
                  <AnimatePresence mode="wait">
                    {isAnalyzing ? (
                      <motion.div
                        key="analyzing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        混合式過濾引擎啟動中（正則篩選 + 語意審計）...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="analyze"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 text-lg"
                      >
                        開始評價「濾水分析」（對比 {filledCount} 間）
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#f5f1e8]/70 rounded-2xl p-3.5 border border-[#e8dcc8]">
                  <div className="flex items-center gap-2 text-sm text-[#6b8e7f]">
                    <div className="w-2.5 h-2.5 bg-[#e8c547] rounded-full animate-ping"></div>
                    <span className="font-medium">即時爬蟲就緒，請提供 Google Maps 商家網址</span>
                  </div>
                </div>

                <div className="rounded-2xl p-4 bg-[#f5f1e8]/40 border border-[#e8dcc8] space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4a5d52] mb-1.5 flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Google Maps 商家評論網址 (URL)
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b8e7f]" />
                      <input
                        type="text"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        placeholder="https://www.google.com/maps/place/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-[#d4c5b0] focus:border-[#6b8e7f] focus:ring-1 focus:ring-[#6b8e7f] outline-none text-[#4a5d52] font-medium placeholder-[#a0b3a0] transition-shadow text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-[#4a5d52] flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5" />
                        最多抓取評論筆數
                      </label>
                      <span className="text-xs font-extrabold text-[#6b8e7f] bg-white px-2 py-0.5 rounded border border-[#d4c5b0]">
                        {maxReviews} 筆
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={maxReviews}
                      onChange={(e) => setMaxReviews(parseInt(e.target.value))}
                      className="w-full accent-[#6b8e7f] h-2 bg-[#e8dcc8] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <motion.button
                  onClick={handleScrapeAndAnalyze}
                  disabled={isAnalyzing || !scrapeUrl.trim()}
                  whileHover={{ scale: scrapeUrl.trim() && !isAnalyzing ? 1.02 : 1 }}
                  whileTap={{ scale: scrapeUrl.trim() && !isAnalyzing ? 0.98 : 1 }}
                  className="w-full bg-gradient-to-r from-[#6b8e7f] to-[#4a5d52] hover:opacity-95 text-white font-extrabold text-base py-3.5 rounded-full shadow-md disabled:from-[#c9bfae] disabled:to-[#c9bfae] disabled:cursor-not-allowed border-2 border-[#4a5d52] disabled:border-[#a0b3a0] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {scrapeLoadingStep || '啟動自動爬蟲中...'}
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5 animate-pulse text-[#e8c547]" />
                      一鍵抓取並進行安全審核
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* AI Configuration Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 bg-white rounded-3xl p-6 shadow-lg border-2 border-[#6b8e7f] max-w-3xl mx-auto"
        >
          <h3 className="font-extrabold text-base text-[#4a5d52] mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#6b8e7f]" />
            設定 AI 深度審查引擎以啟用二階段審計
          </h3>

          {/* Segmented Model Selector */}
          <div className="flex gap-2 mb-4 bg-[#f5f1e8] p-1 rounded-2xl border border-[#d4c5b0] max-w-md">
            <button
              onClick={() => { setAuditModel('gemini'); localStorage.setItem('audit_model', 'gemini'); }}
              className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs cursor-pointer transition-all ${auditModel === 'gemini' ? 'bg-[#6b8e7f] text-white shadow-sm' : 'text-[#4a5d52] hover:bg-[#6b8e7f]/10'}`}
            >
              Gemini 2.5 Flash (雲端 API)
            </button>
            <button
              onClick={() => { setAuditModel('gemma'); localStorage.setItem('audit_model', 'gemma'); }}
              className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs cursor-pointer transition-all ${auditModel === 'gemma' ? 'bg-[#6b8e7f] text-white shadow-sm' : 'text-[#4a5d52] hover:bg-[#6b8e7f]/10'}`}
            >
              Gemma 4:e4b (本地 Ollama)
            </button>
          </div>

          {/* Dynamic Description */}
          <p className="text-xs text-[#6b8e7f] mb-4">
            {auditModel === 'gemini' 
              ? '本地正則 + Heuristic 規則已能抓出大部分顯性洗評；若您想調用雲端大語言模型 (Gemini 2.5 Flash) 進行更敏銳的「語意比對」，請輸入您的 API 金鑰（金鑰僅保存在本機 localStorage 中）。'
              : '🚀 本地極速模式！使用您本機 Ollama 運行的 gemma4:e4b 模型進行語意分析與思維鏈推理。無須提供 API 金鑰，且保證 100% 資料隱私與流暢速度。'}
          </p>

          <div>
            {auditModel === 'gemini' ? (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }}
                placeholder="輸入您的 Gemini API 金鑰 (AIzaSy...)"
                className="w-full px-4 py-2.5 bg-[#f5f1e8] rounded-xl border border-[#d4c5b0] text-[#4a5d52] text-sm focus:outline-none focus:border-[#6b8e7f] placeholder-[#a0b3a0]"
              />
            ) : (
              <div className="w-full px-4 py-2.5 bg-[#f5f1e8] rounded-xl border border-[#d4c5b0]/60 text-[#6b8e7f] text-xs flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e8c547] animate-pulse"></span>
                <span>系統將透過代理呼叫本地後端：<code className="bg-[#6b8e7f]/10 px-1.5 py-0.5 rounded font-mono">http://localhost:5001/api/audit-local</code> 驅動 Ollama</span>
              </div>
            )}
          </div>

          {/* AI Audit Count Selector */}
          <div className="mt-4 pt-4 border-t border-[#d4c5b0]/60">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-[#4a5d52] flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-[#6b8e7f]" />
                AI 深度審查筆數上限 (每間店)
              </label>
              <span className="text-xs font-extrabold text-[#6b8e7f] bg-[#f5f1e8] px-2 py-0.5 rounded border border-[#d4c5b0]">
                {aiAuditCount} 筆
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={aiAuditCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setAiAuditCount(val);
                localStorage.setItem('ai_audit_count', String(val));
              }}
              className="w-full accent-[#6b8e7f] h-2 bg-[#e8dcc8] rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[10px] text-[#6b8e7f] mt-1">
              * 系統將從高風險五星好評中均勻抽取指定筆數送交 AI 進行複審。筆數越多分析越精準，但會消耗更多 Token 或本地 CPU 算力。
            </p>
          </div>
        </motion.div>

        {/* Preset Store Recommendations Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 bg-white/70 backdrop-blur-sm rounded-3xl p-6 border-2 border-[#d4c5b0]/60 shadow-lg"
        >
          <h2 className="text-lg font-extrabold text-[#4a5d52] mb-4 flex items-center gap-2">
            <span>✨</span> 快速點選測試數據集（推薦對比體驗）
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ramen Panel */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-[#4a5d52] flex items-center gap-1 border-b pb-1 border-[#d4c5b0]/40">
                <span>🍜</span> 拉麵推薦對比
              </h3>
              <div className="space-y-2">
                {ramenPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border font-medium flex items-center justify-between transition-all hover:translate-x-1 ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{r.name}</span>
                      <span className="block text-[10px] opacity-75">
                        {r.isWashed ? '灌水大店 (含贈送促銷)' : '有機小店 (真實口碑)'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Bento Panel */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-[#4a5d52] flex items-center gap-1 border-b pb-1 border-[#d4c5b0]/40">
                <span>🍱</span> 健康便當對比
              </h3>
              <div className="space-y-2">
                {bentoPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border font-medium flex items-center justify-between transition-all hover:translate-x-1 ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{r.name}</span>
                      <span className="block text-[10px] opacity-75">
                        {r.isWashed ? '五星好評送小菜' : '真實低卡健康便當'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Drinks Panel */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-[#4a5d52] flex items-center gap-1 border-b pb-1 border-[#d4c5b0]/40">
                <span>🧋</span> 熱門手搖茶飲
              </h3>
              <div className="space-y-2">
                {drinkPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border font-medium flex items-center justify-between transition-all hover:translate-x-1 ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{r.name}</span>
                      <span className="block text-[10px] opacity-75">
                        {r.isWashed ? '網紅打卡爆款 (洗評)' : '街角口碑老店'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Processing Animation */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 text-center"
          >
            <div className="inline-block bg-white rounded-3xl p-8 shadow-lg border-3 border-[#6b8e7f]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 mx-auto mb-4 border-4 border-[#6b8e7f] border-t-transparent rounded-full"
              ></motion.div>
              <div className="text-lg font-bold text-[#4a5d52] mb-2">🔍 正在進行語意審計...</div>
              <div className="text-sm text-[#6b8e7f]">正則過濾 ➔ 語意一致性比對 ➔ 計算真實評分</div>
              <div className="mt-4 flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    className="w-2.5 h-2.5 bg-[#6b8e7f] rounded-full"
                  ></motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
