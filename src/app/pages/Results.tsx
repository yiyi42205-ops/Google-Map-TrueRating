import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { 
  ArrowLeft, Trophy, AlertTriangle, ExternalLink, Search, 
  Sparkles, Check, Loader2, ShieldCheck, HelpCircle, FileText, Key, Activity
} from 'lucide-react';
import { DispenseSlot } from '../components/DispenseSlot';
import { RESTAURANTS_DATA } from '../data/restaurantsData';
import { parseReviews, Review } from '../utils/csvParser';
import { computeShopStats, auditReview, ShopStats, AuditResult } from '../utils/auditEngine';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';

export function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safe fallback if accessed directly without selecting shops
  const storeIds = (location.state?.storeIds as string[]) || ['ramen_washed_3', 'ramen_clean_2'];

  // Base state computed from CSV data and local heuristic engine
  const [shopResults, setShopResults] = useState<ShopStats[]>([]);
  
  // Review Inspector Search & Filter states for each shop index
  const [inspectSearch, setInspectSearch] = useState<{ [key: number]: string }>({});
  const [inspectFilter, setInspectFilter] = useState<{ [key: number]: 'all' | 'washed' | 'clean' }>({});

  const [apiKey, setApiKey] = useState(() => {
    if (location.state?.apiKey !== undefined) return location.state.apiKey;
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [isAiAuditing, setIsAiAuditing] = useState(false);
  const [aiAuditResults, setAiAuditResults] = useState<{ [storeId: string]: { [username: string]: AuditResult } }>({});
  const [apiError, setApiError] = useState('');
  const [auditModel, setAuditModel] = useState<'gemini' | 'gemma'>(() => {
    if (location.state?.auditModel) return location.state.auditModel;
    const key = localStorage.getItem('gemini_api_key') || '';
    return key.trim() ? 'gemini' : 'gemma';
  });

  // Two-Stage Pipeline Logs State
  interface PipelineLog {
    storeId: string;
    storeName: string;
    totalReviews: number;
    stage1Count: number; // Regex flagged
    stage2Sent: number;   // Ambiguous sent to Gemini
    stage2Flagged: number; // Gemini flagged
    stage2Passed: number;  // Gemini passed
  }
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);

  // 1. Initial Parse and Compute local heuristics
  useEffect(() => {
    const customShops = (location.state?.customShops as Array<{ id: string; name: string; reviews: Review[] }>) || [];

    let computed: ShopStats[] = [];
    if (customShops.length > 0) {
      computed = customShops.map(shop => {
        return computeShopStats(shop.name, shop.reviews);
      });
    } else {
      const activeIds = storeIds.length > 0 ? storeIds : ['ramen_washed_3', 'ramen_clean_2'];
      computed = activeIds.map(id => {
        const store = RESTAURANTS_DATA.find(r => r.id === id);
        if (!store) return null;
        const reviews = parseReviews(store.csvContent);
        return computeShopStats(store.name, reviews);
      }).filter(Boolean) as ShopStats[];
    }
    
    setShopResults(computed);
    
    // Initialize search & filter states
    const initialSearch: { [key: number]: string } = {};
    const initialFilter: { [key: number]: 'all' | 'washed' | 'clean' } = {};
    computed.forEach((_, idx) => {
      initialSearch[idx] = '';
      initialFilter[idx] = 'all';
    });
    setInspectSearch(initialSearch);
    setInspectFilter(initialFilter);
  }, [location.state?.storeIds, location.state?.customShops]);

  // 1.5. Auto-trigger AI Audit on mount once shopResults are computed
  useEffect(() => {
    if (shopResults.length > 0 && !isAiAuditing && Object.keys(aiAuditResults).length === 0) {
      const key = location.state?.apiKey !== undefined ? location.state.apiKey : (localStorage.getItem('gemini_api_key') || '');
      const model = location.state?.auditModel || (key.trim() ? 'gemini' : 'gemma');
      handleGeminiAudit(model, key, shopResults);
    }
  }, [shopResults]);

  // 2. AI Live Audit execution (Two-Stage Hybrid Pipeline)
  const handleGeminiAudit = async (forcedModel?: 'gemini' | 'gemma', forcedKey?: string, forcedShopResults?: ShopStats[]) => {
    const activeModel = forcedModel || auditModel;
    const activeKey = forcedKey !== undefined ? forcedKey : apiKey;
    const activeShopResults = forcedShopResults || shopResults;

    if (activeModel === 'gemini' && !activeKey.trim()) {
      // Fallback to local Gemma if Gemini key is missing during auto-trigger
      if (forcedModel) {
        console.log('Gemini API key missing, falling back to local Gemma...');
        setAuditModel('gemma');
        handleGeminiAudit('gemma', '', activeShopResults);
        return;
      }
      setApiError('請輸入有效的 Gemini API 金鑰！');
      return;
    }
    
    setApiError('');
    setIsAiAuditing(true);
    if (activeModel === 'gemini') {
      localStorage.setItem('gemini_api_key', activeKey);
    }

    try {
      const newAiResults = { ...aiAuditResults };
      const logs: PipelineLog[] = [];

      // Analyze each selected store
      for (let idx = 0; idx < activeShopResults.length; idx++) {
        const result = activeShopResults[idx];
        const id = storeIds[idx] || `custom_${idx}`;
        const reviews = result.auditedReviews;

        // Precompute month-level density metrics for this restaurant
        const monthlyCounts: { [month: string]: number } = {};
        reviews.forEach(r => {
          if (r.time) {
            const month = r.time.substring(0, 7); // YYYY-MM
            if (/^\d{4}-\d{2}$/.test(month)) {
              monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
            }
          }
        });

        const monthKeys = Object.keys(monthlyCounts);
        const monthlyAverage = monthKeys.length > 0
          ? monthKeys.reduce((sum, k) => sum + monthlyCounts[k], 0) / monthKeys.length
          : 0;

        const getReviewTemporalData = (r: Review) => {
          const month = r.time ? r.time.substring(0, 7) : '';
          const reviewsInMonth = monthlyCounts[month] || 0;
          // Spike if month volume is > 2x average AND we have at least 10 reviews in that month
          const isSpikePeriod = reviewsInMonth > 2 * monthlyAverage && reviewsInMonth >= 10;
          
          let daysElapsed = 0;
          if (r.time) {
            const reviewDate = new Date(r.time);
            if (!isNaN(reviewDate.getTime())) {
              const currentDate = new Date('2026-05-19'); // Metadata local time base
              const diffTime = currentDate.getTime() - reviewDate.getTime();
              daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            }
          }
          return { isSpikePeriod, daysElapsed };
        };

        // STAGE 1: Regex screening (Local, instant)
        // Find reviews containing explicit incentive/bribe keywords
        const stage1WashedReviews = reviews.filter(r => {
          const audit = auditReview(r);
          return audit.isWashed && audit.issueType === 'incentive';
        });
        const stage1Count = stage1WashedReviews.length;

        // STAGE 2: Identify Ambiguous / High-Risk Reviews for Gemini AI
        // 5-star reviews that are NOT flagged by Stage 1, and contain some text
        const ambiguousReviews = reviews.filter(r => {
          const isStage1 = stage1WashedReviews.some(s1 => s1.username === r.username && s1.text === r.text);
          return r.stars === 5 && !isStage1 && r.text.trim().length > 0;
        });

        // Get configured AI audit limit (linked to settings/localStorage)
        const aiAuditLimit = (() => {
          if (location.state?.aiAuditCount !== undefined) return Number(location.state.aiAuditCount);
          const saved = localStorage.getItem('ai_audit_count');
          return saved ? Number(saved) : 15;
        })();

        // Using uniform stratified sampling across the review timeline
        let sampleReviews: typeof ambiguousReviews = [];
        const ambiguousCount = ambiguousReviews.length;
        if (ambiguousCount <= aiAuditLimit) {
          sampleReviews = [...ambiguousReviews];
        } else {
          for (let i = 0; i < aiAuditLimit; i++) {
            const index = Math.floor((i * (ambiguousCount - 1)) / (aiAuditLimit - 1));
            sampleReviews.push(ambiguousReviews[index]);
          }
        }
        const stage2Sent = sampleReviews.length;

        let stage2Flagged = 0;
        let stage2Passed = 0;
        const storeMap: { [username: string]: AuditResult } = {};

        if (stage2Sent > 0) {
          // Prepare prompt payload for Stage 2 with temporal signals
          const promptPayload = sampleReviews.map(r => {
            const { isSpikePeriod, daysElapsed } = getReviewTemporalData(r);
            return {
              username: r.username,
              stars: r.stars,
              text: r.text,
              daysElapsed,
              isSpikePeriod
            };
          });

          let aiParsed: { 
            username: string; 
            isWashed: boolean; 
            reason: string; 
            issueType: 'incentive' | 'template' | 'discrepancy' | 'none';
            reasoningPath: string;
            incentiveIntensity: number;
            sentimentAuthenticity: number;
            descriptionGranularity: number;
          }[] = [];

          if (activeModel === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `你是一個專門分析 Google Maps 虛假/灌水/刷好評評論的 AI 安全專家。
                      
                      我們正在運行一個【兩階段混合審計流水線】：
                      - 階段一：我們已經使用正則篩選過濾掉了所有顯性打卡交易評論（如包含 "打卡送"、"好評送"）。
                      - 階段二：請你幫我們審核以下「模糊/高風險」評論列表。請辨識出其中是否隱含「隱性打卡交易行為（如提及評論送單點/飲料，但寫得很隱晦）」、「無食物細節描述的敷衍模版（例如：好吃、環境好，但非常空洞）」或「語意割裂（五星評分但內文是抱怨/平淡詞語）」。
                      
                      為協助你判斷，我們在每則評論中額外提供了以下兩個時間特徵信號：
                      - "daysElapsed" (數字)：評論發布至今經過的天數。天數越小代表评论越新。
                      - "isSpikePeriod" (布林值)：該評論是否發布於「評論數量異常暴增的月份」（即該月评论數大於歷史月平均的 2 倍且大於等於 10 則）。若為 true，代表該評論極可能發布於商家的打卡促銷或洗評活動期間。
                      
                      請依照以下步驟進行分析判定（Chain-of-Thought 思維鏈）：
                      1. 分析此評論內文、情感、字數與發佈時間信號，在 \`reasoningPath\` 欄位中詳細寫下你的推理過程與任何疑點。
                      2. 針對以下三個維度進行 1 到 5 分的指標評分：
                      - \`incentiveIntensity\` (利益交換強度)：評論是否有為了獲得打卡小點心/折扣而撰寫的痕跡。1 分表示完全無痕跡，5 分表示利益交換特徵極強。
                      - \`sentimentAuthenticity\` (情感真實度)：評論者表達的喜愛或評價是否自然、真誠。1 分表示極度虛假誇張/空洞，5 分表示極其真誠有具體主觀感受。
                      - \`descriptionGranularity\` (描述細緻度)：評論中對餐點特色、環境細節、服務態度的具體描繪。1 分表示非常空洞通用，5 分表示細節極為詳盡獨特。
                      3. 給出最終判定 \`isWashed\` (布林值) 與簡短結論 \`reason\`。
                      
                      請精準判斷，並回傳一個嚴格的 JSON 陣列。
                      
                      請參考以下判定範例（Few-shot Examples）：
                      範例一（判定為真實）：
                      輸入：{"stars": 5, "text": "起司拉麵湯頭濃郁但偏鹹，麵條偏硬，炙燒叉燒很好吃，排隊排了半小時。", "daysElapsed": 60, "isSpikePeriod": false}
                      輸出：{
                        "username": "...", 
                        "reasoningPath": "評論詳細描述了湯頭偏鹹、麵條偏硬與叉燒好吃等細節，且提及排隊時間，情感真實自然。時間非暴增期。無任何利益交換跡象。",
                        "incentiveIntensity": 1,
                        "sentimentAuthenticity": 5,
                        "descriptionGranularity": 5,
                        "isWashed": false, 
                        "reason": "包含具體菜色細節、排隊時間與個人化主觀感受，且非暴增期發布，屬於真實評論", 
                        "issueType": "none"
                      }
  
                      範例二（判定為洗評 - 敷衍模板 + 處於暴增期）：
                      輸入：{"stars": 5, "text": "味道很棒，氣氛佳，下次還會再來，大力推薦！", "daysElapsed": 365, "isSpikePeriod": true}
                      輸出：{
                        "username": "...", 
                        "reasoningPath": "評論僅有空洞的通用稱讚詞（味道棒、氣氛佳、推薦），缺乏任何具體菜色或環境特徵。且發布於評論數暴增的月份，高度懷疑是為了打卡促銷贈品而撰寫的敷衍模板。",
                        "incentiveIntensity": 4,
                        "sentimentAuthenticity": 1,
                        "descriptionGranularity": 1,
                        "isWashed": true, 
                        "reason": "文字極度空洞模板化，且發布於評論數量異常暴增的月份，高機率為促銷洗評", 
                        "issueType": "template"
                      }
  
                      範例三（判定為洗評 - 隱性打卡 + 早期活動）：
                      輸入：{"stars": 5, "text": "服務很好，而且評論還有送小點心，推推。", "daysElapsed": 730, "isSpikePeriod": true}
                      輸出：{
                        "username": "...", 
                        "reasoningPath": "內文明確提及評論送東西，屬於直接的贈禮利益交換洗評。天數為兩年前，且發布於當時的評論暴增期。",
                        "incentiveIntensity": 5,
                        "sentimentAuthenticity": 2,
                        "descriptionGranularity": 1,
                        "isWashed": true, 
                        "reason": "提及評論送東西，且發布於歷史評論爆發期，屬於典型的贈禮利益交換洗評", 
                        "issueType": "incentive"
                      }
                      
                      待審計的階段二評論列表：
                      ${JSON.stringify(promptPayload)}`
                      }
                    ]
                  }
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        username: { type: "STRING" },
                        isWashed: { type: "BOOLEAN" },
                        reason: { type: "STRING" },
                        issueType: { 
                          type: "STRING", 
                          enum: ["incentive", "template", "discrepancy", "none"] 
                        },
                        reasoningPath: { type: "STRING" },
                        incentiveIntensity: { type: "INTEGER" },
                        sentimentAuthenticity: { type: "INTEGER" },
                        descriptionGranularity: { type: "INTEGER" }
                      },
                      required: [
                        "username", "isWashed", "reason", "issueType", 
                        "reasoningPath", "incentiveIntensity", "sentimentAuthenticity", "descriptionGranularity"
                      ]
                    }
                  }
                }
              })
            });

            if (!response.ok) {
              let errMsg = response.statusText || `${response.status}`;
              try {
                const errBody = await response.json();
                if (errBody.error && errBody.error.message) {
                  errMsg = errBody.error.message;
                }
              } catch (inner) {}
              throw new Error(`API 請求失敗: ${errMsg}`);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            aiParsed = JSON.parse(textResponse);
          } else {
            // Local Gemma Model via our Express Server proxy
            const response = await fetch('http://localhost:5001/api/audit-local', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reviews: promptPayload
              })
            });

            if (!response.ok) {
              let errMsg = response.statusText || `${response.status}`;
              try {
                const errBody = await response.json();
                if (errBody.error) {
                  errMsg = errBody.error;
                }
              } catch (inner) {}
              throw new Error(`本地 Gemma 審計失敗: ${errMsg}`);
            }

            const data = await response.json();
            aiParsed = data.results || [];
          }
          
          aiParsed.forEach(item => {
            if (item.isWashed) {
              stage2Flagged++;
            } else {
              stage2Passed++;
            }

            const inc = Number(item.incentiveIntensity) || 3;
            const aut = Number(item.sentimentAuthenticity) || 3;
            const gra = Number(item.descriptionGranularity) || 3;

            // Calculate dynamic confidence score based on indicators
            let confidence = 85;
            if (item.isWashed) {
              const fakeScore = (inc + (6 - aut) + (6 - gra)) / 3;
              confidence = Math.round(60 + (fakeScore - 1) * 9.75);
            } else {
              const cleanScore = ((6 - inc) + aut + gra) / 3;
              confidence = Math.round(60 + (cleanScore - 1) * 9.75);
            }
            confidence = Math.max(50, Math.min(99, confidence));

            storeMap[item.username] = {
              isWashed: item.isWashed,
              reason: item.reason,
              confidenceScore: confidence,
              issueType: item.issueType === 'none' ? null : (item.issueType as any),
              reasoningPath: item.reasoningPath,
              incentiveIntensity: inc,
              sentimentAuthenticity: aut,
              descriptionGranularity: gra
            };
          });
        }

        // Add to logs
        logs.push({
          storeId: id,
          storeName: result.storeName,
          totalReviews: reviews.length,
          stage1Count,
          stage2Sent,
          stage2Flagged,
          stage2Passed
        });

        newAiResults[id] = storeMap;
      }

      setPipelineLogs(logs);
      setAiAuditResults(newAiResults);

      // Recalculate shopResults incorporating Gemini API results
      const updatedResults = activeShopResults.map((shop, idx) => {
        const matchingId = storeIds[idx] || `custom_${idx}`;

        if (!newAiResults[matchingId]) return shop;

        const aiStoreMap = newAiResults[matchingId];
        const reviews = shop.auditedReviews;

        // STAGE 1: Regex filter matches
        const stage1WashedReviews = reviews.filter(r => {
          const audit = auditReview(r);
          return audit.isWashed && audit.issueType === 'incentive';
        });

        const updatedReviews = shop.auditedReviews.map(r => {
          // Check if flagged in Stage 1
          const isStage1 = stage1WashedReviews.some(s1 => s1.username === r.username && s1.text === r.text);
          if (isStage1) {
            return {
              ...r,
              audit: {
                isWashed: true,
                reason: '⚠️ 階段一正則篩選：直接匹配到顯性打卡贈禮交易關鍵字。',
                confidenceScore: 100,
                issueType: 'incentive' as const
              }
            };
          }

          // Otherwise, check if processed by Gemini in Stage 2
          if (aiStoreMap[r.username]) {
            return {
              ...r,
              audit: aiStoreMap[r.username]
            };
          }

          // Fallback to local heuristic engine
          return r;
        });

        // Recompute aggregates (with weighted score, no binary hard cut-off!)
        const total = updatedReviews.length;
        let suspicious = 0;
        let originalSum = 0;
        let weightedSum = 0;
        let weightTotal = 0;
        const filteredDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const issues = { timeAnomaly: 0, templateText: 0, vague: 0 };

        updatedReviews.forEach(r => {
          originalSum += r.stars;

          // Compute review weight based on confidence score (no binary hard cut-off!)
          const weight = r.audit.isWashed 
            ? 1 - (r.audit.confidenceScore / 100) 
            : (r.audit.confidenceScore / 100);

          weightedSum += r.stars * weight;
          weightTotal += weight;

          // Accumulate weighted star distribution (rounded to 1 decimal to avoid floating point precision leaks)
          filteredDist[r.stars as 1 | 2 | 3 | 4 | 5] = parseFloat(
            ((filteredDist[r.stars as 1 | 2 | 3 | 4 | 5] || 0) + weight).toFixed(1)
          );

          if (r.audit.isWashed) {
            suspicious++;
            if (r.audit.issueType === 'incentive') issues.timeAnomaly++;
            else if (r.audit.issueType === 'template') issues.templateText++;
            else if (r.audit.issueType === 'discrepancy') issues.vague++;
          }
        });

        const basicFilteredRating = weightTotal > 0 ? weightedSum / weightTotal : shop.originalRating;
        const trustScore = total > 0 ? Math.max(0, 100 - (suspicious / total) * 100 * 2.0) : 100;
        const trustPenalty = (100 - trustScore) * 0.02;
        const filteredRating = Math.max(1.0, basicFilteredRating - trustPenalty);

        return {
          ...shop,
          trustScore: parseFloat(trustScore.toFixed(0)),
          suspiciousReviews: suspicious,
          filteredRating: parseFloat(filteredRating.toFixed(2)),
          issues,
          ratingDistribution: {
            ...shop.ratingDistribution,
            filtered: filteredDist
          },
          auditedReviews: updatedReviews
        };
      });

      setShopResults(updatedResults);
    } catch (e: any) {
      console.error(e);
      setApiError(`二階段 AI 複審發生錯誤：${e.message || '請確認 API 金鑰是否正確、網路連線或是否開啟跨域訪問限制。'}`);
    } finally {
      setIsAiAuditing(false);
    }
  };

  // Find best store (highest trust score)
  const bestStoreIndex = shopResults.reduce((maxIdx, current, idx, arr) =>
    current.trustScore > arr[maxIdx].trustScore ? idx : maxIdx, 0
  );

  return (
    <div className="min-h-screen bg-[#f5f1e8] py-8 px-4 font-sans selection:bg-[#6b8e7f]/20">
      <div className="container mx-auto max-w-5xl">
        {/* Back Button & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <motion.button
            onClick={() => navigate('/analyzer')}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-[#d4c5b0] text-[#4a5d52] font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-[#6b8e7f]" />
            返回修改對比
          </motion.button>        </div>



        {/* Global Stats Summary Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 shadow-md mb-6 border-2 border-[#d4c5b0]/60 text-center relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-[#6b8e7f]/10 rounded-full blur-xl"></div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#4a5d52] mb-1">
            🔍 店家「濾水」對比報告
          </h1>
          <p className="text-sm text-[#6b8e7f] font-medium">
            已成功分析 {shopResults.length} 間店家真實 Google Maps 評論數據集
          </p>
        </motion.div>

        {isAiAuditing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 shadow-lg mb-6 border-2 border-[#6b8e7f] flex flex-col items-center justify-center text-center animate-pulse"
          >
            <Loader2 className="w-8 h-8 animate-spin text-[#6b8e7f] mb-3" />
            <h3 className="font-extrabold text-base text-[#4a5d52] mb-1">
              🔍 雙階段 AI 混合審計進行中...
            </h3>
            <p className="text-xs text-[#6b8e7f]">
              正在執行：階段一正則篩選 ➔ 階段二 AI 語意比對與思維鏈推理，請稍候。
            </p>
          </motion.div>
        )}

        {/* Winner Card */}
        {shopResults.length > 1 && shopResults[bestStoreIndex] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-[#e8c547] to-[#efd063] rounded-3xl p-6 shadow-md mb-8 border-3 border-[#4a5d52] relative overflow-hidden"
          >
            <div className="absolute -right-8 -bottom-8 text-9xl opacity-15 select-none pointer-events-none">🏆</div>
            <div className="flex items-center gap-4">
              <div className="text-4xl bg-white p-3 rounded-2xl border-2 border-[#4a5d52] shadow-sm">🏆</div>
              <div>
                <div className="text-[#4a5d52] font-black text-xs uppercase tracking-wider mb-1 bg-white/40 px-2 py-0.5 rounded-md inline-block">
                  經篩選後：最值得信賴的真實星級選擇
                </div>
                <div className="text-2xl md:text-3xl font-black text-[#4a5d52]">
                  {shopResults[bestStoreIndex].storeName}
                </div>
                <div className="text-[#4a5d52]/80 text-sm mt-1 font-bold">
                  真實信任度分數：
                  <span className="text-lg text-[#4a5d52] font-black">{shopResults[bestStoreIndex].trustScore}</span>
                  /100 (僅有 {shopResults[bestStoreIndex].suspiciousReviews} 則可疑灌水評論)
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dispense Slot with Results */}
        <DispenseSlot isOpen={true}>
          <div className="space-y-8">
            {shopResults.map((result, idx) => {
              const isBest = idx === bestStoreIndex && shopResults.length > 1;
              const hasMajorDrop = result.originalRating - result.filteredRating >= 0.3 || result.trustScore < 80;
              
              // Prepare chart data for Recharts
              const distData = [
                { star: '5★', '原始評價': result.ratingDistribution.original[5] || 0, '濾水真實': result.ratingDistribution.filtered[5] || 0 },
                { star: '4★', '原始評價': result.ratingDistribution.original[4] || 0, '濾水真實': result.ratingDistribution.filtered[4] || 0 },
                { star: '3★', '原始評價': result.ratingDistribution.original[3] || 0, '濾水真實': result.ratingDistribution.filtered[3] || 0 },
                { star: '2★', '原始評價': result.ratingDistribution.original[2] || 0, '濾水真實': result.ratingDistribution.filtered[2] || 0 },
                { star: '1★', '原始評價': result.ratingDistribution.original[1] || 0, '濾水真實': result.ratingDistribution.filtered[1] || 0 },
              ];

              // Filtering inspection reviews
              const query = inspectSearch[idx] || '';
              const filter = inspectFilter[idx] || 'all';
              const filteredReviews = result.auditedReviews.filter(rev => {
                const textMatch = rev.text.toLowerCase().includes(query.toLowerCase()) || rev.username.toLowerCase().includes(query.toLowerCase());
                if (!textMatch) return false;

                if (filter === 'washed') return rev.audit.isWashed;
                if (filter === 'clean') return !rev.audit.isWashed;
                return true;
              });

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className={`bg-white rounded-3xl shadow-lg overflow-hidden border-3 transition-all duration-300 ${
                    isBest ? 'border-[#e8c547] ring-4 ring-[#e8c547]/20' : 'border-[#d4c5b0]/70'
                  }`}
                >
                  {/* Store Header Banner */}
                  <div className={`px-6 py-5 ${
                    isBest ? 'bg-[#e8c547]' : 'bg-[#6b8e7f]'
                  } border-b-3 border-[#4a5d52] flex items-center justify-between`}>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black mb-0.5 flex items-center gap-2 text-[#4a5d52]">
                        {isBest && <span>🏆</span>}
                        {result.storeName}
                      </h2>
                      <p className="text-xs text-[#4a5d52]/80 font-bold uppercase tracking-wider">
                        共 {result.totalReviews} 則歷史評價載入分析
                      </p>
                    </div>
                    <div className="bg-white/40 border border-[#4a5d52]/60 px-3 py-1 rounded-full text-xs font-black text-[#4a5d52]">
                      {result.trustScore >= 70 ? '🟢 安全信譽' : result.trustScore >= 50 ? '🟡 警告標記' : '🔴 高危洗評'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 md:p-6 space-y-6">
                    {/* Stat boxes row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Trust score box */}
                      <div className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${
                        result.trustScore >= 70
                          ? 'bg-[#d4e8d4]/60 border-[#6b8e7f]'
                          : result.trustScore >= 50
                          ? 'bg-[#f5ead4]/60 border-[#e8c547]'
                          : 'bg-[#f5d4d4]/60 border-[#d4a5a5]'
                      }`}>
                        <span className="text-xs font-bold text-[#6b8e7f] flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          綜合真實信任度
                        </span>
                        <div className="mt-2">
                          <span className={`text-4xl font-black ${
                            result.trustScore >= 70
                              ? 'text-[#4a5d52]'
                              : result.trustScore >= 50
                              ? 'text-[#8b7534]'
                              : 'text-[#8b5a5a]'
                          }`}>{result.trustScore}%</span>
                          <span className="text-xs text-[#6b8e7f] block mt-1">越接近 100% 越乾淨真實</span>
                        </div>
                      </div>

                      {/* Suspicious count box */}
                      <div className="bg-[#f5d4d4]/40 border-2 border-[#d4a5a5] rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-xs font-bold text-[#8c4848] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          抓出灌水評價數
                        </span>
                        <div className="mt-2">
                          <span className="text-4xl font-black text-[#8b5a5a]">{result.suspiciousReviews} 則</span>
                          <span className="text-xs text-[#8c4848] block mt-1">
                            佔總評價的 {((result.suspiciousReviews / result.totalReviews) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Issues Box */}
                      <div className="bg-[#f5f1e8] border-2 border-[#e8dcc8] rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-xs font-bold text-[#4a5d52] flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          洗評異常特徵
                        </span>
                        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                          <div className="bg-white/60 rounded-lg p-1 border border-[#e8dcc8]">
                            <span className="block text-sm font-black text-[#8b5a5a]">{result.issues.timeAnomaly}</span>
                            <span className="text-[9px] text-[#6b8e7f] font-bold">打卡送禮</span>
                          </div>
                          <div className="bg-white/60 rounded-lg p-1 border border-[#e8dcc8]">
                            <span className="block text-sm font-black text-[#8b7534]">{result.issues.templateText}</span>
                            <span className="text-[9px] text-[#6b8e7f] font-bold">極短模板</span>
                          </div>
                          <div className="bg-white/60 rounded-lg p-1 border border-[#e8dcc8]">
                            <span className="block text-sm font-black text-[#6b8e7f]">{result.issues.vague}</span>
                            <span className="text-[9px] text-[#6b8e7f] font-bold">語意矛盾</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stars Comparison box */}
                    <div className="bg-[#f5f1e8]/60 border-2 border-[#e8dcc8] rounded-2xl p-4">
                      <h4 className="text-xs font-extrabold text-[#4a5d52] uppercase tracking-wider mb-3 border-b border-[#e8dcc8] pb-1.5 flex justify-between items-center">
                        <span>⭐ 星級評分脫水對比</span>
                        {hasMajorDrop && (
                          <span className="bg-[#d4a5a5] text-white px-2 py-0.5 rounded text-[10px] animate-pulse">
                            ⚠️ 評分水分極重
                          </span>
                        )}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Rating Numbers */}
                        <div className="flex items-center justify-around bg-white p-4 rounded-xl border border-[#e8dcc8]">
                          <div className="text-center">
                            <span className="text-xs font-bold text-[#6b8e7f] block mb-1">原始評分</span>
                            <span className="text-3xl font-black text-[#4a5d52]">{result.originalRating.toFixed(2)}</span>
                            <div className="flex justify-center text-xs mt-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={i < Math.round(result.originalRating) ? 'text-[#e8c547]' : 'text-[#d4c5b0]'}>★</span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-10 w-0.5 bg-[#e8dcc8]"></div>

                          <div className="text-center">
                            <span className="text-xs font-bold text-[#6b8e7f] block mb-1">真實有機評分</span>
                            <span className="text-3xl font-black text-[#6b8e7f]">{result.filteredRating.toFixed(2)}</span>
                            <div className="flex justify-center text-xs mt-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={i < Math.round(result.filteredRating) ? 'text-[#6b8e7f]' : 'text-[#d4c5b0]'}>★</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Text explanation */}
                        <div className="flex flex-col justify-center text-xs text-[#4a5d52]">
                          {result.trustScore < 80 ? (
                            <div className="bg-[#d4a5a5]/10 border border-[#d4a5a5]/30 rounded-xl p-3 text-[#8c4848] font-medium leading-relaxed">
                              ⚠️ <b>水軍灌水警報：</b>該店真實信任度僅有 <b>{result.trustScore}%</b>。系統已鎖定 <b>{result.suspiciousReviews}</b> 則疑似打卡贈送或極短模版之灌水五星評論，已對應扣減評分水分（脫水真實得分約為 <b>{result.filteredRating.toFixed(2)}★</b>）。
                            </div>
                          ) : (
                            <div className="bg-[#6b8e7f]/10 border border-[#6b8e7f]/30 rounded-xl p-3 text-[#304a3e] font-medium leading-relaxed">
                              ✅ <b>信譽優良：</b>該店真實信任度達 <b>{result.trustScore}%</b>，無明顯系統性灌水行徑，真實口碑約 <b>{result.filteredRating.toFixed(2)}★</b>，評價皆為自然就餐真實反饋。
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Star Distribution comparative chart (Recharts) */}
                    <div className="bg-white rounded-2xl p-4 border border-[#e8dcc8]">
                      <h4 className="text-xs font-extrabold text-[#4a5d52] uppercase tracking-wider mb-2">
                        📊 原始評價 vs 濾水真實評價：星級分佈對照圖
                      </h4>
                      <p className="text-[10px] text-[#6b8e7f] mb-3">
                        *過濾洗評後，虛假的 5 星將被剝除，還原店家真實的「沙丘曲線」（J-Curve / 鐘形真實分佈）。
                      </p>
                      
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8dcc8" />
                            <XAxis dataKey="star" tick={{ fontSize: 10, fill: '#4a5d52', fontWeight: 'bold' }} stroke="#d4c5b0" />
                            <YAxis tick={{ fontSize: 10, fill: '#4a5d52' }} stroke="#d4c5b0" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '2px border #d4c5b0', fontSize: '12px' }}
                            />
                            <Bar dataKey="原始評價" fill="#e8c547" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="濾水真實" fill="#6b8e7f" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 text-xs font-bold mt-2">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#e8c547] rounded-sm"></span>原始評分分佈</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#6b8e7f] rounded-sm"></span>真實有機評分分佈</span>
                      </div>
                    </div>

                    {/* Integrated Two-Stage Audit Pipeline Log */}
                    {(() => {
                      const storeLog = pipelineLogs.find(log => log.storeName === result.storeName);
                      if (!storeLog) return null;
                      return (
                        <div className="bg-[#f5f1e8] border-2 border-[#d4c5b0] rounded-2xl p-4 text-xs text-[#4a5d52] space-y-3">
                          <h4 className="text-xs font-extrabold text-[#4a5d52] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Activity className="w-4.5 h-4.5 text-[#6b8e7f]" />
                            🛡️ 雙階段混合審計流水線日誌 (Two-Stage Hybrid Audit Pipeline Log)
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Total Input */}
                            <div className="bg-white border border-[#d4c5b0] p-3 rounded-xl flex flex-col justify-between">
                              <span className="text-[#6b8e7f] font-bold block mb-1">1. 歷史資料載入</span>
                              <span className="text-base font-black text-[#4a5d52]">{storeLog.totalReviews} 則評論</span>
                            </div>

                            {/* Stage 1: Regex */}
                            <div className="bg-[#d4a5a5]/10 border border-[#d4a5a5]/30 p-3 rounded-xl flex flex-col justify-between text-[#8c4848]">
                              <span className="font-bold block mb-1 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#8c4848]"></span>
                                階段一：啟發式過濾
                              </span>
                              <span className="text-base font-black">已攔截 {storeLog.stage1Count} 則</span>
                            </div>

                            {/* Stage 2: Gemini */}
                            <div className="bg-white border border-[#d4c5b0] p-3 rounded-xl flex flex-col justify-between">
                              <span className="font-bold block mb-1 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#6b8e7f]"></span>
                                階段二：深度 AI 語意
                              </span>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-extrabold text-[#4a5d52]">送審 {storeLog.stage2Sent} 則</span>
                                {storeLog.stage2Sent > 0 && (
                                  <div className="flex gap-1.5 text-[10px]">
                                    <span className="bg-[#d4a5a5]/20 text-[#8c4848] px-1.5 py-0.5 rounded font-bold">
                                      洗評:{storeLog.stage2Flagged}
                                    </span>
                                    <span className="bg-[#6b8e7f]/20 text-[#304a3e] px-1.5 py-0.5 rounded font-bold">
                                      真實:{storeLog.stage2Passed}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="text-[10px] text-[#6b8e7f] italic leading-tight pt-1">
                            * 本系統採用兩階段流水線分工：階段一以本地正則和規則引擎快速攔截顯性打卡（0 Token 消耗，保護隱私）；階段二調用 {auditModel === 'gemini' ? 'Gemini 2.5 Flash 雲端 API' : '本地 Gemma 4:e4b 模型'} 對剩餘的模糊 5 星好評進行語意複審與思維鏈推理。
                          </p>
                        </div>
                      );
                    })()}

                    {/* Detailed Review Inspector */}
                    <div className="bg-white rounded-2xl border border-[#d4c5b0] overflow-hidden">
                      {/* Inspector Header */}
                      <div className="bg-[#f5f1e8] p-4 border-b border-[#d4c5b0] flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <span className="text-xs font-extrabold text-[#4a5d52] uppercase tracking-wider flex items-center gap-1.5">
                          <Search className="w-4 h-4 text-[#6b8e7f]" />
                          🔍 歷史評價內容透視與審計日誌
                        </span>

                        {/* Search input in inspector */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inspectSearch[idx] || ''}
                            onChange={(e) => {
                              const newSearch = { ...inspectSearch };
                              newSearch[idx] = e.target.value;
                              setInspectSearch(newSearch);
                            }}
                            placeholder="搜尋評價關鍵字或帳號..."
                            className="px-3 py-1 bg-white rounded-lg border border-[#d4c5b0] text-xs text-[#4a5d52] focus:outline-none focus:border-[#6b8e7f] placeholder-[#a0b3a0] w-44"
                          />

                          {/* Filter select */}
                          <select
                            value={inspectFilter[idx] || 'all'}
                            onChange={(e) => {
                              const newFilters = { ...inspectFilter };
                              newFilters[idx] = e.target.value as 'all' | 'washed' | 'clean';
                              setInspectFilter(newFilters);
                            }}
                            className="bg-white border border-[#d4c5b0] rounded-lg px-2 py-1 text-xs font-bold text-[#4a5d52]"
                          >
                            <option value="all">顯示全部 ({result.totalReviews})</option>
                            <option value="washed">⚠️ 僅看灌水 ({result.suspiciousReviews})</option>
                            <option value="clean">✅ 僅看真實 ({result.totalReviews - result.suspiciousReviews})</option>
                          </select>
                        </div>
                      </div>

                      {/* Scrollable list */}
                      <div className="divide-y divide-[#f5f1e8] max-h-72 overflow-y-auto bg-white p-2">
                        {filteredReviews.length === 0 ? (
                          <div className="text-center py-8 text-xs text-[#6b8e7f] font-bold">
                            無符合搜尋條件的評價內容。
                          </div>
                        ) : (
                          filteredReviews.map((review, rIdx) => (
                            <div key={rIdx} className="p-3 text-xs flex flex-col gap-2 hover:bg-[#f5f1e8]/30 rounded-xl transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#4a5d52]">{review.username}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#6b8e7f] text-[10px]">{review.time}</span>
                                  <span className="font-bold text-[#e8c547] bg-[#e8c547]/10 px-2 py-0.5 rounded-full border border-[#e8c547]/30">
                                    ★ {review.stars}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[#4a5d52] leading-relaxed whitespace-pre-wrap">{review.text}</p>
                              
                              {/* Audit Status Box */}
                              {review.audit.isWashed ? (
                                <div className="bg-[#d4a5a5]/10 border border-[#d4a5a5]/30 p-3 rounded-xl text-xs text-[#8c4848] space-y-2">
                                  <div className="flex items-start gap-1.5 font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8c4848]" />
                                    <span>判定：灌水洗評 ({review.audit.confidenceScore}% 信心度)</span>
                                  </div>
                                  <div className="text-[11px] font-medium opacity-90 pl-5 leading-relaxed">
                                    <b>原因：</b>{review.audit.reason}
                                  </div>
                                  {review.audit.reasoningPath && (
                                    <div className="mt-2 pt-2 border-t border-[#d4a5a5]/20 pl-5 text-[10px] space-y-2">
                                      <div className="text-[#8c4848]/90 leading-relaxed bg-[#f5f1e8]/60 p-2 rounded-lg italic border border-[#d4c5b0]/30">
                                        <b>💡 AI 思考鏈 (CoT)：</b>{review.audit.reasoningPath}
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-[9px] text-center pt-1 font-bold">
                                        <div className="bg-[#d4a5a5]/20 py-1 px-1.5 rounded">
                                          利益誘因: <span className="text-[#8c4848] font-black">{review.audit.incentiveIntensity}/5</span>
                                        </div>
                                        <div className="bg-[#d4a5a5]/20 py-1 px-1.5 rounded">
                                          情感真實: <span className="text-[#8c4848] font-black">{review.audit.sentimentAuthenticity}/5</span>
                                        </div>
                                        <div className="bg-[#d4a5a5]/20 py-1 px-1.5 rounded">
                                          描述細緻: <span className="text-[#8c4848] font-black">{review.audit.descriptionGranularity}/5</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-[#6b8e7f]/10 border border-[#6b8e7f]/30 p-3 rounded-xl text-xs text-[#304a3e] space-y-2">
                                  <div className="flex items-start gap-1.5 font-bold">
                                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#6b8e7f]" />
                                    <span>判定：真實評論 ({review.audit.confidenceScore}% 信心度)</span>
                                  </div>
                                  <div className="text-[11px] font-medium opacity-90 pl-5 leading-relaxed">
                                    <b>原因：</b>{review.audit.reason}
                                  </div>
                                  {review.audit.reasoningPath && (
                                    <div className="mt-2 pt-2 border-t border-[#6b8e7f]/20 pl-5 text-[10px] space-y-2">
                                      <div className="text-[#304a3e]/90 leading-relaxed bg-[#f5f1e8]/60 p-2 rounded-lg italic border border-[#d4c5b0]/30">
                                        <b>💡 AI 思考鏈 (CoT)：</b>{review.audit.reasoningPath}
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-[9px] text-center pt-1 font-bold">
                                        <div className="bg-[#6b8e7f]/20 py-1 px-1.5 rounded">
                                          利益誘因: <span className="text-[#304a3e] font-black">{review.audit.incentiveIntensity}/5</span>
                                        </div>
                                        <div className="bg-[#6b8e7f]/20 py-1 px-1.5 rounded">
                                          情感真實: <span className="text-[#304a3e] font-black">{review.audit.sentimentAuthenticity}/5</span>
                                        </div>
                                        <div className="bg-[#6b8e7f]/20 py-1 px-1.5 rounded">
                                          描述細緻: <span className="text-[#304a3e] font-black">{review.audit.descriptionGranularity}/5</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </DispenseSlot>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex gap-4 justify-center flex-wrap"
        >
          <motion.button
            onClick={() => navigate('/analyzer')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#6b8e7f] hover:bg-[#5b7d6e] text-white px-7 py-3 rounded-full font-extrabold shadow-md border-2 border-[#4a5d52] transition-all cursor-pointer text-sm md:text-base"
          >
            重新對比分析店家
          </motion.button>
          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white hover:bg-[#f5f1e8] text-[#4a5d52] px-7 py-3 rounded-full font-extrabold shadow-md border-2 border-[#d4c5b0] transition-all cursor-pointer text-sm md:text-base"
          >
            返回首頁
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
