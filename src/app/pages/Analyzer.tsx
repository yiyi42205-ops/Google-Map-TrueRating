import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Link as LinkIcon, X, Search, Info, Plus, Globe, Sliders, Database, ShieldCheck, Sparkles, Shield } from 'lucide-react';
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
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollama_model_tag') || 'gemma4:e4b');

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

      // 2. Keyword check
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
      const fallbackIds = filledUrls.map((_, i) => RESTAURANTS_DATA[i].id);
      setIsAnalyzing(true);
      setTimeout(() => {
        navigate('/results', { state: { storeIds: fallbackIds, auditModel, apiKey, aiAuditCount, ollamaModelTag: ollamaModel } });
      }, 1500);
      return;
    }

    setIsAnalyzing(true);

    setTimeout(() => {
      navigate('/results', { state: { storeIds: matchedStoreIds, auditModel, apiKey, aiAuditCount, ollamaModelTag: ollamaModel } });
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
      const response = await fetch('/api/scrape', {
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
        throw new Error('伺服器爬取失敗，請確認本地爬蟲伺服器已開啟，且網址正確。');
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
          ollamaModelTag: ollamaModel,
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
      alert(`爬取錯誤: ${e.message || '請確認本地後端服務已開啟'}`);
    } finally {
      setIsAnalyzing(false);
      setScrapeLoadingStep('');
    }
  };

  const filledCount = urls.filter(url => url.trim() !== '').length;

  const filteredSuggestions = searchQuery.trim() === ''
    ? []
    : RESTAURANTS_DATA.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.categoryLabel.includes(searchQuery)
      );

  const ramenPresets = RESTAURANTS_DATA.filter(r => r.category === 'ramen').slice(0, 4);
  const bentoPresets = RESTAURANTS_DATA.filter(r => r.category === 'bento').slice(0, 4);
  const drinkPresets = RESTAURANTS_DATA.filter(r => r.category === 'drinks').slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f5f1e8] font-sans selection:bg-[#6b8e7f]/20 pb-12">
      {/* Brand Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#f5f1e8]/80 border-b border-[#d4c5b0]/30 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-[#6b8e7f] text-white w-9 h-9 rounded-xl border-2 border-[#4a5d52] font-black text-base shadow-sm flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-black text-lg text-[#4a5d52] tracking-tight">
            疑騙真星 <span className="text-[#6b8e7f] font-sans font-bold text-sm bg-white border border-[#d4c5b0]/60 px-1.5 py-0.5 rounded-md ml-1">TrueRating</span>
          </span>
        </div>
        <motion.button
          onClick={() => navigate('/')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 rounded-full shadow-xs border border-[#d4c5b0] text-xs font-bold text-[#4a5d52] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#6b8e7f]" />
          返回首頁
        </motion.button>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-xs rounded-2xl p-4.5 mb-8 shadow-xs border border-[#e8c547]/40 flex items-start gap-3.5"
        >
          <Info className="w-5 h-5 text-[#e8c547] shrink-0 mt-0.5" />
          <div className="text-xs md:text-sm text-[#4a5d52] leading-relaxed">
            <span className="font-extrabold text-[#8b7534] bg-[#e8c547]/20 px-1.5 py-0.5 rounded mr-1">測試數據庫已加載</span>
            系統內建拉麵、手搖飲、健康餐等 18 間店家真實歷史評論。您可以直接在對比欄位搜尋，或從下方推薦庫快速加載店家進行多店「濾水」對照！
          </div>
        </motion.div>

        {/* Main Analysis Dashboard Box */}
        <div className="relative w-full max-w-3xl mx-auto mb-8">
          <div className="bg-white rounded-[32px] shadow-md p-6 md:p-8 border-2 border-[#d4c5b0]/60">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-8"
            >
              <div className="text-3xl mb-1 text-[#e8c547] select-none tracking-widest">★☆★☆★</div>
              <h1 className="text-xl md:text-2xl font-black text-[#4a5d52] font-display">
                真實口碑評價對比分析儀
              </h1>
              <p className="text-xs text-[#6b8e7f] mt-1 font-medium">
                選擇下方店家測試數據集，或透過即時爬蟲抓取 Google Map 上最新資料
              </p>
            </motion.div>

            {/* Segmented Tab Selectors */}
            <div className="flex gap-2 p-1.5 bg-[#f5f1e8] rounded-2xl mb-8 border-2 border-[#4a5d52] shadow-tactile-sm">
              <button
                onClick={() => setActiveTab('preset')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                  activeTab === 'preset'
                    ? 'bg-white text-[#4a5d52] shadow-[2px_2px_0px_0px_#4a5d52] border-2 border-[#4a5d52]'
                    : 'text-[#6b8e7f] hover:text-[#4a5d52] border-2 border-transparent hover:bg-white/50'
                }`}
              >
                <Database className="w-4 h-4" />
                內建測試數據庫
              </button>
              <button
                onClick={() => setActiveTab('scraper')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                  activeTab === 'scraper'
                    ? 'bg-white text-[#4a5d52] shadow-[2px_2px_0px_0px_#4a5d52] border-2 border-[#4a5d52]'
                    : 'text-[#6b8e7f] hover:text-[#4a5d52] border-2 border-transparent hover:bg-white/50'
                }`}
              >
                <Globe className="w-4 h-4 text-[#e8c547] animate-pulse" />
                Google Maps 即時爬取
              </button>
            </div>

            {activeTab === 'preset' ? (
              <>
                {/* Status Bar */}
                <div className="bg-[#f5f1e8]/70 rounded-2xl p-3.5 mb-6 border border-[#e8dcc8] flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-[#6b8e7f]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6b8e7f] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6b8e7f]"></span>
                    </span>
                    <span>就緒，請至少添加 1 間店家進行對照</span>
                  </div>
                  <span className="text-[#4a5d52] bg-white px-3 py-1 rounded-full border border-[#d4c5b0]/60">
                    已選 {filledCount} / 3 間
                  </span>
                </div>

                {/* URL Input Slots */}
                <div className="space-y-4 mb-8 relative" ref={dropdownRef}>
                  {urls.map((url, index) => {
                    const isMatched = RESTAURANTS_DATA.some(r => r.name === url);
                    const matchedStore = RESTAURANTS_DATA.find(r => r.name === url);
                    const isEmpty = !url.trim();
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08 }}
                        className={`rounded-2xl p-4 border-2 transition-all duration-200 ${
                          isMatched
                            ? 'bg-[#6b8e7f]/10 border-[#4a5d52] shadow-[2px_2px_0px_0px_#4a5d52]'
                            : isEmpty
                            ? 'bg-[#f5f1e8]/30 border-dashed border-[#d4c5b0] hover:bg-white hover:border-[#4a5d52] hover:shadow-[2px_2px_0px_0px_#4a5d52]'
                            : 'bg-white border-[#4a5d52] shadow-[2px_2px_0px_0px_#4a5d52]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`font-black px-2.5 py-0.5 rounded-md text-[10px] border ${
                            isMatched
                              ? 'bg-[#6b8e7f] text-white border-[#4a5d52]'
                              : isEmpty
                              ? 'bg-white text-[#6b8e7f] border-[#d4c5b0] border-dashed'
                              : 'bg-[#e8c547]/20 text-[#8b7534] border-[#e8c547]/40'
                          }`}>
                            對比店家 {index + 1}
                          </div>
                          {isMatched && matchedStore && (
                            <span className="text-[10px] font-bold text-[#4a5d52] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#e8c547] animate-pulse" />
                              已載入：<span className="text-[#6b8e7f]">【{matchedStore.categoryLabel}】</span>
                            </span>
                          )}
                          {isEmpty && (
                            <span className="text-[10px] text-[#6b8e7f] font-semibold flex items-center gap-1 select-none">
                              點擊下方推薦或輸入店名載入
                            </span>
                          )}
                          {url && (
                            <motion.button
                              onClick={() => handleClear(index)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="ml-auto bg-[#d4a5a5] text-white p-1 rounded-full border border-[#4a5d52] cursor-pointer shadow-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                            </motion.button>
                          )}
                        </div>
                        <div className="relative">
                          {isMatched ? (
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b8e7f]" />
                          ) : (
                            <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d4c5b0]" />
                          )}
                          
                          <input
                            type="text"
                            value={url}
                            onChange={(e) => handleUrlChange(index, e.target.value)}
                            onFocus={() => {
                              setActiveSlot(index);
                              setSearchQuery(url);
                            }}
                            placeholder="請在此輸入並搜尋店家名稱，或點擊下方推薦店卡片..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-[#d4c5b0] focus:border-[#6b8e7f] focus:ring-1 focus:ring-[#6b8e7f] outline-none text-xs md:text-sm text-[#4a5d52] font-semibold placeholder-[#a0b3a0] transition-shadow shadow-xs"
                          />

                          {/* Dropdown Suggestions */}
                          {activeSlot === index && filteredSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-[#d4c5b0] z-50 max-h-56 overflow-y-auto">
                              {filteredSuggestions.map((restaurant) => (
                                <button
                                  key={restaurant.id}
                                  onClick={() => handleSelectRestaurant(index, restaurant)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-[#6b8e7f]/10 flex items-center justify-between border-b border-[#f5f1e8] last:border-0 transition-colors text-xs"
                                >
                                  <div>
                                    <span className="font-extrabold text-[#4a5d52]">{restaurant.name}</span>
                                    <span className="ml-2 text-[10px] bg-[#e8dcc8] text-[#4a5d52] px-1.5 py-0.5 rounded">
                                      {restaurant.categoryLabel}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-[#6b8e7f] font-extrabold">
                                    {restaurant.isWashed ? '包含刷評' : '真實綠色'}
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
                  whileHover={{ y: filledCount > 0 && !isAnalyzing ? -4 : 0 }}
                  whileTap={{ y: filledCount > 0 && !isAnalyzing ? 0 : 0, boxShadow: '0px 0px 0px 0px var(--color-primary)' }}
                  className="w-full bg-[#6b8e7f] hover:bg-[#5b7d6e] text-white font-black text-sm md:text-base py-4 rounded-full shadow-[4px_4px_0px_0px_#4a5d52] hover:shadow-[6px_6px_0px_0px_#4a5d52] disabled:shadow-none disabled:bg-[#c9bfae] disabled:cursor-not-allowed border-3 border-[#4a5d52] disabled:border-[#a0b3a0] transition-all cursor-pointer font-display tracking-wider active:translate-y-1 active:shadow-none"
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
                        雙階段過濾引擎計算中（正則篩選 + AI 語意複核）...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="analyze"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 font-display text-base tracking-wide"
                      >
                        開始評價「濾水分析」（對比 {filledCount} 間）
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#f5f1e8]/70 rounded-2xl p-3.5 border border-[#e8dcc8] flex items-center gap-2 text-xs font-bold text-[#6b8e7f]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e8c547] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e8c547]"></span>
                  </span>
                  <span>即時爬蟲就緒，請提供 Google Maps 商家網址</span>
                </div>

                <div className="rounded-2xl p-5 bg-[#f5f1e8]/40 border border-[#e8dcc8] space-y-4">
                  <div>
                    <label className="block text-xs font-black text-[#4a5d52] mb-1.5 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Google Maps 商家評論網址 (URL)
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b8e7f]" />
                      <input
                        type="text"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        placeholder="https://www.google.com/maps/place/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-[#d4c5b0] focus:border-[#6b8e7f] focus:ring-1 focus:ring-[#6b8e7f] outline-none text-xs md:text-sm text-[#4a5d52] font-semibold placeholder-[#a0b3a0] transition-shadow shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-[#4a5d52] flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        限制抓取評論筆數
                      </label>
                      <span className="text-[10px] font-extrabold text-[#6b8e7f] bg-white px-2 py-0.5 rounded border border-[#d4c5b0]">
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
                      className="w-full accent-[#6b8e7f] h-1.5 bg-[#e8dcc8] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <motion.button
                  onClick={handleScrapeAndAnalyze}
                  disabled={isAnalyzing || !scrapeUrl.trim()}
                  whileHover={{ scale: scrapeUrl.trim() && !isAnalyzing ? 1.02 : 1 }}
                  whileTap={{ scale: scrapeUrl.trim() && !isAnalyzing ? 0.98 : 1 }}
                  className="w-full bg-gradient-to-r from-[#6b8e7f] to-[#4a5d52] hover:opacity-95 text-white font-extrabold text-sm md:text-base py-3.5 rounded-full shadow-md disabled:from-[#c9bfae] disabled:to-[#c9bfae] disabled:cursor-not-allowed border-2 border-[#4a5d52] disabled:border-[#a0b3a0] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {scrapeLoadingStep || '啟動自動爬蟲中...'}
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-[#e8c547] animate-pulse" />
                      一鍵抓取評論並開啟 AI 審計
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
          className="bg-white rounded-[28px] p-6 shadow-sm border border-[#e8dcc8] max-w-3xl mx-auto mb-8 relative overflow-hidden"
        >
          <h3 className="font-extrabold text-sm md:text-base text-[#4a5d52] mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#6b8e7f]" />
            設定 AI 深度審查引擎（二階段語意分析）
          </h3>

          {/* Model Toggle */}
          <div className="flex gap-1 mb-4 bg-[#f5f1e8] p-1 rounded-xl border border-[#d4c5b0] max-w-xs md:max-w-md">
            <button
              onClick={() => { setAuditModel('gemini'); localStorage.setItem('audit_model', 'gemini'); }}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-extrabold text-[10px] md:text-xs cursor-pointer transition-all ${auditModel === 'gemini' ? 'bg-[#6b8e7f] text-white shadow-xs' : 'text-[#4a5d52] hover:bg-[#6b8e7f]/10'}`}
            >
              Gemini 2.5 Flash (雲端)
            </button>
            <button
              onClick={() => { setAuditModel('gemma'); localStorage.setItem('audit_model', 'gemma'); }}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-extrabold text-[10px] md:text-xs cursor-pointer transition-all ${auditModel === 'gemma' ? 'bg-[#6b8e7f] text-white shadow-xs' : 'text-[#4a5d52] hover:bg-[#6b8e7f]/10'}`}
            >
              Gemma 4:e4b (本地 Ollama)
            </button>
          </div>

          <p className="text-[11px] text-[#6b8e7f] mb-4 leading-relaxed font-semibold">
            {auditModel === 'gemini' 
              ? '建議使用！本地啟發式規則過濾顯性好評後，調用 Gemini 2.5 Flash 進行精確的「語意一致性」比對。金鑰保存在您本機瀏覽器 localStorage 中。'
              : '本地運算！直接連線本機 Ollama 服務進行推理，保證 100% 資料安全隱私且免付 API 費用。'}
          </p>

          <div>
            {auditModel === 'gemini' ? (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }}
                placeholder="輸入您的 Gemini API 金鑰 (AIzaSy...)"
                className="w-full px-4 py-2 bg-[#f5f1e8] rounded-xl border border-[#d4c5b0] text-xs text-[#4a5d52] font-semibold focus:outline-none focus:border-[#6b8e7f] placeholder-[#a0b3a0] shadow-inner"
              />
            ) : (
              <div className="space-y-3.5">
                <div className="w-full px-4 py-2.5 bg-[#f5f1e8] rounded-xl border border-[#d4c5b0]/60 text-[#6b8e7f] text-[10px] flex items-center gap-2 font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#6b8e7f] animate-pulse"></span>
                  <span>系統將直接連線本機 Ollama 服務：<code className="bg-[#6b8e7f]/10 px-1 py-0.5 rounded font-mono text-[9px]">http://localhost:11434</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#4a5d52] whitespace-nowrap">Ollama 模型名稱:</span>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => { setOllamaModel(e.target.value); localStorage.setItem('ollama_model_tag', e.target.value); }}
                    placeholder="例如: gemma4:e4b, gemma:2b"
                    className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-[#d4c5b0] text-[10px] text-[#4a5d52] font-semibold focus:outline-none focus:border-[#6b8e7f] shadow-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* AI Audit Count Selector */}
          <div className="mt-4 pt-4 border-t border-[#d4c5b0]/60">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-black text-[#4a5d52] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#6b8e7f]" />
                AI 抽樣審查數量上限 (每間店)
              </label>
              <span className="text-[10px] font-extrabold text-[#6b8e7f] bg-[#f5f1e8] px-2 py-0.5 rounded border border-[#d4c5b0]">
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
              className="w-full accent-[#6b8e7f] h-1.5 bg-[#e8dcc8] rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[9px] text-[#6b8e7f] mt-1.5 leading-relaxed">
              * 系統會從疑似水軍好評中均勻抽取指定筆數交由大語言模型審核。抽查筆數愈多愈準確，但會花費較多 Token 或本機 CPU 運算資源。
            </p>
          </div>
        </motion.div>

        {/* Preset Store Recommendations Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 backdrop-blur-xs rounded-[32px] p-6 border border-[#d4c5b0] shadow-xs"
        >
          <h2 className="text-sm md:text-base font-extrabold text-[#4a5d52] mb-5 flex items-center gap-1.5 font-display">
            快速點選測試數據集（推薦對照體驗）
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ramen Panel */}
            <div className="space-y-3.5">
              <h3 className="font-extrabold text-xs md:text-sm text-[#4a5d52] flex items-center gap-1.5 border-b pb-1.5 border-[#d4c5b0]/40 font-display">
                日式拉麵對照
              </h3>
              <div className="space-y-2">
                {ramenPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] border font-semibold flex items-center justify-between transition-all hover:translate-x-1 cursor-pointer ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block text-xs">{r.name}</span>
                      <span className="text-[9px] opacity-75 font-medium">
                        {r.isWashed ? '包含促銷好評送禮' : '自然有機真實評論'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Bento Panel */}
            <div className="space-y-3.5">
              <h3 className="font-extrabold text-xs md:text-sm text-[#4a5d52] flex items-center gap-1.5 border-b pb-1.5 border-[#d4c5b0]/40 font-display">
                健康便當對照
              </h3>
              <div className="space-y-2">
                {bentoPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] border font-semibold flex items-center justify-between transition-all hover:translate-x-1 cursor-pointer ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block text-xs">{r.name}</span>
                      <span className="text-[9px] opacity-75 font-medium">
                        {r.isWashed ? '包含打卡送茶飲' : '綠色低卡便當口碑'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Drinks Panel */}
            <div className="space-y-3.5">
              <h3 className="font-extrabold text-xs md:text-sm text-[#4a5d52] flex items-center gap-1.5 border-b pb-1.5 border-[#d4c5b0]/40 font-display">
                手搖茶飲對照
              </h3>
              <div className="space-y-2">
                {drinkPresets.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAddPreset(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] border font-semibold flex items-center justify-between transition-all hover:translate-x-1 cursor-pointer ${
                      r.isWashed
                        ? 'bg-[#d4a5a5]/10 hover:bg-[#d4a5a5]/20 border-[#d4a5a5]/30 text-[#8c4848]'
                        : 'bg-[#6b8e7f]/10 hover:bg-[#6b8e7f]/20 border-[#6b8e7f]/30 text-[#304a3e]'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block text-xs">{r.name}</span>
                      <span className="text-[9px] opacity-75 font-medium">
                        {r.isWashed ? '網紅洗好評買一送一' : '巷弄古早手搖老店'}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
