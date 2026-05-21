const fs = require('fs');
const path = require('path');
const http = require('https');
const readline = require('readline');
const statsMonitor = require('./stats_monitor.cjs');


const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log('\x1b[31m[提示] 請提供 GEMINI_API_KEY 環境變數以啟用第二階段真實 AI 測試。\x1b[0m');
  console.log('使用範例：');
  console.log('  GEMINI_API_KEY=AIzaSy... node test_two_stages.cjs\n');
}

// 1. CSV Parser
function parseCSV(csvText) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n' || char === '\r') {
        row.push(cell);
        cell = '';
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    result.push(row);
  }

  return result;
}

function parseReviews(csvText) {
  if (!csvText || csvText.trim() === '') return [];
  const rawRows = parseCSV(csvText);
  if (rawRows.length <= 1) return [];

  const header = rawRows[0].map(h => h.trim().toLowerCase());
  const usernameIdx = header.indexOf('username');
  const starsIdx = header.indexOf('stars');
  const timeIdx = header.indexOf('time');
  const textIdx = header.indexOf('text');

  const reviews = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const username = row[usernameIdx] || 'Anonymous';
    const stars = parseInt(row[starsIdx] || '5', 10) || 5;
    const time = row[timeIdx] || '';
    const text = row[textIdx] || '';
    
    reviews.push({
      username,
      stars,
      time,
      text,
    });
  }

  return reviews;
}

// 2. Stage 1 Heuristics
const EXPLICIT_INCENTIVE_KEYWORDS = [
  '打卡', '活動', '評論送', '打卡送', '好評送', '免費送', 
  '送小菜', '送起司球', '送飲料', '送肉', '送單點', '送麻糬', '送奶酪'
];

const EMPTY_WORDS = new Set([
  '讚', '超讚', '好吃', '推', '棒', '美味', '讚的', '讚啦', '很讚', '推推', 
  '讚喔', '好喝', '讚讚', '不錯', '好讚', '好店', '優', '優質', '讚哩',
  '讚啊', '極推', '大推', '好食', '真讚', '好美味'
]);

function auditReviewStage1(review) {
  const text = review.text || '';

  // Explicit keyword check
  for (const keyword of EXPLICIT_INCENTIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        isWashed: true,
        reason: `直接提及打卡/活動關鍵字：『${keyword}』`,
        confidenceScore: 100,
        issueType: 'incentive',
      };
    }
  }

  // Generic "送" check
  const excludes = ['外送', '配送', '送禮', '送給', '送餐', '送上', '送來', '送錯', '送客', '送走', '送出', '推送', '面送', '送速度', '送口', '送入'];
  if (text.includes('送') && !excludes.some(ex => text.includes(ex))) {
    return {
      isWashed: true,
      reason: '匹配到打卡/活動/贈送交易關鍵字：『送』',
      confidenceScore: 100,
      issueType: 'incentive',
    };
  }

  // Catch extremely short generic empty/template reviews (e.g. "讚", "推", "好吃")
  const cleanText = text.replace(/[\s!！~～.。?？,，、]/g, '');
  const isRepeatingPraise = /^讚+$/.test(cleanText) || /^推+$/.test(cleanText) || /^棒+$/.test(cleanText) || /^好+$/.test(cleanText) || /^讚+推+$/.test(cleanText);
  if (review.stars >= 4 && (EMPTY_WORDS.has(cleanText) || isRepeatingPraise)) {
    return {
      isWashed: true,
      reason: `⚠️ 評論為極短空洞模板（『${text}』），無實質參考價值。`,
      confidenceScore: 85,
      issueType: 'template',
    };
  }

  return null; // Passes to Stage 2
}

function getNGrams(str, n = 2) {
  const ngrams = new Set();
  const cleaned = str.replace(/\s+/g, '');
  if (cleaned.length < n) {
    if (cleaned.length > 0) ngrams.add(cleaned);
    return ngrams;
  }
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.substring(i, i + n));
  }
  return ngrams;
}

function calculateJaccardSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const set1 = getNGrams(s1);
  const set2 = getNGrams(s2);
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  set1.forEach(val => {
    if (set2.has(val)) {
      intersection++;
    }
  });
  
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

// 3. Post to Gemini API
function callGemini(payloadReviews) {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      // Mock mode if no API key is provided
      const mockResult = payloadReviews.map(r => ({
        username: r.username,
        isWashed: false,
        reasoningPath: '沒有提供 API 金鑰，使用本地預設真實判定',
        reason: '無顯著特徵',
        incentiveIntensity: 1,
        sentimentAuthenticity: 5,
        descriptionGranularity: 3,
        issueType: 'none'
      }));
      return resolve(mockResult);
    }

    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `你是一個專門分析 Google Maps 虛假/灌水/刷好評評論的 AI 安全專家。\n請審查以下給定的評論列表（為 JSON 陣列，每筆包含星等 stars、評論 text、發表時間距今 daysElapsed、是否屬於密集發表期 isSpikePeriod 等特徵資訊）。\n\n【審查指引與洗評判定標準】：\n1. 【利益促銷】：觀察評論是否提及「打卡、評論、五星、好評、免費送、招待、活動」等利益交換詞，且文風有敷衍或流水線寫作痕跡。\n2. 【情感真實度】：極度誇張的讚美（如：全台最好吃、一生推、無懈可擊）但沒有任何具體說明，通常是買評工作室的灌水套話。\n3. 【描述具體度】：真實評論通常會提及具體餐點（如：雞白湯拉麵、起司球）、環境特色（如：好停車、店貓可愛）或排隊等待時間。空洞的好評（如：美味、便宜、讚、推薦）很可疑。\n4. 【時序脈絡】：如果評論在評論密度暴增期（isSpikePeriod為true）發出，且 daysElapsed 天數很接近，表示有極高機率是集中宣傳期的打卡或刷評活動。\n\n請務必強制輸出 JSON 陣列，每一筆對應輸入的評論，欄位包含：\n- username: 評論者名稱\n- isWashed: 是否為洗評或利益交換評論 (true/false)\n- reasoningPath: 強制先寫出你的分析思路與推理過程 (CoT 思維鏈)\n- reason: 最終判定洗評或乾淨口碑的簡短說明字串\n- incentiveIntensity: 利益交換強度 (1-5 分，5為最強烈有打卡送小菜等痕跡)\n- sentimentAuthenticity: 情感表達真實度 (1-5 分，5為最真誠，1為最空洞虛假)\n- descriptionGranularity: 描述具體細緻度 (1-5 分，5為極具體描繪餐點細節，1為極敷衍無細節)\n- issueType: 洗評類型分類 ("incentive" 利益誘因 / "template" 空洞模板 / "discrepancy" 語意割裂 / "none" 乾淨評論)\n\n待審查評論數據：\n${JSON.stringify(payloadReviews, null, 2)}`
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
              reasoningPath: { type: "STRING" },
              reason: { type: "STRING" },
              incentiveIntensity: { type: "INTEGER" },
              sentimentAuthenticity: { type: "INTEGER" },
              descriptionGranularity: { type: "INTEGER" },
              issueType: { type: "STRING", enum: ["incentive", "template", "discrepancy", "none"] }
            },
            required: ["username", "isWashed", "reasoningPath", "reason", "incentiveIntensity", "sentimentAuthenticity", "descriptionGranularity", "issueType"]
          }
        }
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const startTime = Date.now();
    statsMonitor.setLLMMetrics('gemini-2.5-flash', 'Cloud (Gemini API)', 0);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message));
          }
          const textResponse = parsed.candidates[0].content.parts[0].text;
          const jsonResponse = JSON.parse(textResponse);
          
          const endTime = Date.now();
          const estimatedTokens = textResponse.length / 4;
          const durationSec = Math.max(0.1, (endTime - startTime) / 1000);
          statsMonitor.setLLMMetrics('gemini-2.5-flash', 'Cloud (Gemini API)', estimatedTokens / durationSec);
          
          resolve(jsonResponse);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function callLocalGemma(payloadReviews) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ reviews: payloadReviews });
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/api/audit-local',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const startTime = Date.now();
    statsMonitor.setLLMMetrics('gemma4:e4b', 'Local (Ollama)', 0);

    const req = require('http').request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`Local proxy responded with status ${res.statusCode}: ${data}`));
          }
          const parsed = JSON.parse(data);
          
          const endTime = Date.now();
          const resultStr = JSON.stringify(parsed);
          const estimatedTokens = resultStr.length / 4;
          const durationSec = Math.max(0.1, (endTime - startTime) / 1000);
          statsMonitor.setLLMMetrics('gemma4:e4b', 'Local (Ollama)', estimatedTokens / durationSec);
          
          resolve(parsed.results || []);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

// 4. Combined Hybrid Engine
async function analyzeStore(storeName, reviews) {
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    console.log(`[兩階段審計] 商家: ${storeName} | 無評論可分析`);
    return { trustScore: 100, suspiciousReviews: 0 };
  }

  // Pre-calculate temporal metrics
  const monthlyCounts = {};
  reviews.forEach(r => {
    if (r.time) {
      const month = r.time.substring(0, 7); // YYYY-MM
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    }
  });

  const months = Object.keys(monthlyCounts);
  const monthlyAverage = months.length > 0 
    ? months.reduce((sum, m) => sum + monthlyCounts[m], 0) / months.length 
    : 0;

  console.log(`[兩階段審計] 商家: ${storeName} | 共載入 ${totalReviews} 則評論，平均每月發表 ${monthlyAverage.toFixed(1)} 則。`);

  const reviewsWithMetadata = reviews.map(r => {
    let isSpikePeriod = false;
    let daysElapsed = 0;

    if (r.time) {
      const month = r.time.substring(0, 7);
      isSpikePeriod = (monthlyCounts[month] || 0) > 2 * monthlyAverage && (monthlyCounts[month] || 0) >= 10;

      const reviewDate = new Date(r.time);
      if (!isNaN(reviewDate.getTime())) {
        const currentDate = new Date('2026-05-19');
        const diffTime = currentDate.getTime() - reviewDate.getTime();
        daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }
    }

    return { ...r, isSpikePeriod, daysElapsed };
  });

  // Jaccard similarity template flags
  const duplicateFlags = new Set();
  for (let i = 0; i < reviews.length; i++) {
    for (let j = i + 1; j < reviews.length; j++) {
      const r1 = reviews[i];
      const r2 = reviews[j];
      if (r1.text.trim().length > 6 && r2.text.trim().length > 6) {
        const similarity = calculateJaccardSimilarity(r1.text, r2.text);
        if (similarity > 0.75) {
          duplicateFlags.add(i);
          duplicateFlags.add(j);
        }
      }
    }
  }

  // Local audits (Stage 1)
  const auditedMap = {};
  const stage1WashedSet = new Set();
  
  reviewsWithMetadata.forEach((r, idx) => {
    const stage1 = auditReviewStage1(r);
    if (stage1) {
      auditedMap[r.username] = stage1;
      stage1WashedSet.add(idx);
    } else if (duplicateFlags.has(idx)) {
      auditedMap[r.username] = {
        isWashed: true,
        reason: '檢測到內文高度重複模板。',
        confidenceScore: 90,
        issueType: 'template'
      };
      stage1WashedSet.add(idx);
    }
  });

  console.log(`[第一階段結果] 已排除/過濾出 ${stage1WashedSet.size} 則疑似洗評（內含 ${duplicateFlags.size} 則內文高度重複模板）。`);

  // Ambiguous Reviews for Gemini sampling (Stage 2)
  const ambiguousReviews = reviewsWithMetadata.filter((r, idx) => {
    return r.stars === 5 && !stage1WashedSet.has(idx) && r.text.trim().length > 0;
  });

  let sampleReviews = [];
  const ambiguousCount = ambiguousReviews.length;
  if (ambiguousCount <= 15) {
    sampleReviews = [...ambiguousReviews];
  } else {
    for (let i = 0; i < 15; i++) {
      const index = Math.floor((i * (ambiguousCount - 1)) / 14);
      sampleReviews.push(ambiguousReviews[index]);
    }
  }

  console.log(`[第二階段抽取] 共有 ${ambiguousCount} 則模糊的五星好評，從中均勻抽取 ${sampleReviews.length} 則送交 AI 進行深度語意審核。`);

  // Call AI if sample found
  if (sampleReviews.length > 0) {
    try {
      const useLocal = process.env.AUDIT_MODEL === 'gemma';
      console.log(`[第二階段審核] 正在呼叫 ${useLocal ? '本地 Gemma (via Ollama)' : '雲端 Gemini 2.5 Flash'} 進行語意分析與利益誘因審查...`);
      const geminiResults = useLocal 
        ? await callLocalGemma(sampleReviews.map(r => ({
            username: r.username,
            stars: r.stars,
            text: r.text,
            daysElapsed: r.daysElapsed,
            isSpikePeriod: r.isSpikePeriod
          })))
        : await callGemini(sampleReviews.map(r => ({
            username: r.username,
            stars: r.stars,
            text: r.text,
            daysElapsed: r.daysElapsed,
            isSpikePeriod: r.isSpikePeriod
          })));

      console.log(`[第二階段結果] AI 審核完成，已成功解析 ${geminiResults.length} 則抽樣結果。`);

      geminiResults.forEach(item => {
        const inc = Math.min(5, Math.max(1, item.incentiveIntensity || 1));
        const aut = Math.min(5, Math.max(1, item.sentimentAuthenticity || 5));
        const gra = Math.min(5, Math.max(1, item.descriptionGranularity || 3));
        
        const scoreVal = (inc - 1) + (5 - aut) + (5 - gra); // Range: 0 to 12
        let confidence = 80;
        
        if (item.isWashed) {
          confidence = Math.round(50 + (scoreVal / 12) * 49); // 50% - 99%
        } else {
          confidence = Math.round(99 - (scoreVal / 12) * 49); // 50% - 99%
        }

        auditedMap[item.username] = {
          isWashed: item.isWashed,
          reason: item.reason,
          confidenceScore: confidence,
          issueType: item.issueType === 'none' ? null : item.issueType
        };
      });
    } catch (e) {
      console.warn(`[WARN] AI 審計失敗 (${storeName}): ${e.message}`);
    }
  }

  // Weight Calculation
  let originalSum = 0;
  let weightedSum = 0;
  let weightTotal = 0;
  let suspiciousReviewsCount = 0;
  let incentiveCount = 0;
  let templateCount = 0;

  reviews.forEach(r => {
    let audit = auditedMap[r.username] || {
      isWashed: false,
      confidenceScore: 80,
      issueType: null
    };

    const weight = audit.isWashed 
      ? 1 - (audit.confidenceScore / 100) 
      : (audit.confidenceScore / 100);

    originalSum += r.stars;
    weightedSum += r.stars * weight;
    weightTotal += weight;

    if (audit.isWashed) {
      suspiciousReviewsCount++;
      if (audit.issueType === 'incentive') {
        incentiveCount++;
      } else if (audit.issueType === 'template') {
        templateCount++;
      }
    }
  });

  const originalRating = originalSum / totalReviews;
  const filteredRating = weightTotal > 0 ? weightedSum / weightTotal : originalRating;
  
  // Calculate basic trust score based on organic weight ratio
  const basicTrustScore = totalReviews > 0 ? (weightTotal / totalReviews) * 100 : 100;
  
  // Apply heavy penalty for explicit bribe/incentive matches (Stage 1 keywords) and template spam
  // Deduct 15% per bribe review, and 5% per empty/duplicate template review
  const incentivePenalty = incentiveCount * 15;
  const templatePenalty = templateCount * 5;
  const trustScore = Math.max(0, basicTrustScore - incentivePenalty - templatePenalty);

  return {
    name: storeName,
    originalRating: parseFloat(originalRating.toFixed(2)),
    filteredRating: parseFloat(filteredRating.toFixed(2)),
    trustScore: parseFloat(trustScore.toFixed(0)),
    totalReviews,
    suspicious: suspiciousReviewsCount
  };
}

// 5. Test Runner
const dataDir = '/Users/jakehu/Desktop/Google-Map-TrueRating/restaurant_data';
const subdirs = [
  { path: '便當＿有洗', isWashed: true },
  { path: '便當＿沒洗', isWashed: false },
  { path: '手搖＿有洗', isWashed: true },
  { path: '手搖＿沒洗', isWashed: false },
  { path: '拉麵＿有洗', isWashed: true },
  { path: '拉麵＿沒洗', isWashed: false }
];

async function run() {
  const storeFiles = [];
  subdirs.forEach(sd => {
    const dirPath = path.join(dataDir, sd.path);
    if (!fs.existsSync(dirPath)) return;
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
    files.forEach(file => {
      storeFiles.push({
        name: file.replace('.csv', ''),
        filePath: path.join(dirPath, file),
        groundTruth: sd.isWashed ? 'Washed' : 'Clean'
      });
    });
  });

  console.log(`[系統訊息] 找到 ${storeFiles.length} 間商家。開始進行混合式兩階段審計評估...`);
  if (!apiKey) {
    console.log('[系統訊息] 未提供 API 金鑰，第二階段將以模擬模式執行。');
  }

  const results = [];
  
  for (let i = 0; i < storeFiles.length; i++) {
    const store = storeFiles[i];
    const prefix = `(${i + 1}/${storeFiles.length}) 分析中: ${store.name}...`;
    statsMonitor.setStoreInfo(prefix);
    await statsMonitor.start();

    const content = fs.readFileSync(store.filePath, 'utf-8');
    const reviews = parseReviews(content);
    
    const stats = await analyzeStore(store.name, reviews);
    results.push({
      ...stats,
      groundTruth: store.groundTruth
    });
    
    statsMonitor.stop();
    if (process.stdout.isTTY) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
    } else {
      process.stdout.write('\r\x1b[K');
    }
    const summary = statsMonitor.getSummaryString();
    console.log(`${prefix} 完成 (信譽評分: ${stats.trustScore}% | ${summary})`);
  }

  let tp = 0, tn = 0, fp = 0, fn = 0;

  // If apiKey or local Gemma exists, Stage 2 completes audits. Clean stores hit ~98% trustScore.
  // Washed stores will remain low. We set threshold to 90%
  const threshold = (apiKey || process.env.AUDIT_MODEL === 'gemma') ? 90 : 79.2;

  results.forEach(res => {
    const predicted = res.trustScore < threshold ? 'Washed' : 'Clean';
    res.predicted = predicted;
    
    if (res.groundTruth === 'Washed' && predicted === 'Washed') tp++;
    else if (res.groundTruth === 'Clean' && predicted === 'Clean') tn++;
    else if (res.groundTruth === 'Clean' && predicted === 'Washed') fp++;
    else if (res.groundTruth === 'Washed' && predicted === 'Clean') fn++;
  });

  console.log('\n---------------------------------------------------------------------------------------------');
  console.log('| 商家名稱\t\t| 標籤\t| 預測\t| 信任度 | 總評論 | 可疑數 | 原星等 | 過濾星等 |');
  console.log('---------------------------------------------------------------------------------------------');
  results.forEach(res => {
    const displayName = res.name.substring(0, 10);
    const nameTab = displayName.length < 8 ? '\t\t' : '\t';
    console.log(`| ${displayName}${nameTab}| ${res.groundTruth}\t| ${res.predicted}\t| ${res.trustScore}%\t | ${res.totalReviews}\t  | ${res.suspicious}\t   | ${res.originalRating}\t| ${res.filteredRating}\t   |`);
  });
  console.log('---------------------------------------------------------------------------------------------');

  const accuracy = (tp + tn) / results.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log('\n--- 混合式兩階段過濾效能統計 (Classification Performance) ---');
  console.log(`- 總測試商家數: ${results.length}`);
  console.log(`- 準確率 (Accuracy): ${(accuracy * 100).toFixed(2)}%`);
  console.log(`- 精確率 (Precision): ${(precision * 100).toFixed(2)}%`);
  console.log(`- 召回率 (Recall): ${(recall * 100).toFixed(2)}%`);
  console.log(`- F1-Score: ${f1.toFixed(4)}`);
}

run();
