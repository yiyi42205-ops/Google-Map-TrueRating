import { Review } from './csvParser';

export interface AuditResult {
  isWashed: boolean;
  reason: string;
  confidenceScore: number;
  issueType: 'incentive' | 'template' | 'discrepancy' | null;
  reasoningPath?: string;
  incentiveIntensity?: number;
  sentimentAuthenticity?: number;
  descriptionGranularity?: number;
}

export interface ShopStats {
  storeName: string;
  originalRating: number;
  filteredRating: number;
  trustScore: number;
  totalReviews: number;
  suspiciousReviews: number;
  issues: {
    timeAnomaly: number;
    templateText: number;
    vague: number;
  };
  ratingDistribution: {
    original: { [key: number]: number };
    filtered: { [key: number]: number };
  };
  auditedReviews: (Review & { audit: AuditResult })[];
}

// Bribe/Incentive keywords typically used in "Five-star reviews for free appetizers/drinks/discount"
const INCENTIVE_KEYWORDS = [
  '打卡', '活動', '評論送', '打卡送', '好評送', '免費送', 
  '送小菜', '送起司球', '送飲料', '送肉', '送單點', '送麻糬', '送奶酪'
];

const EMPTY_WORDS = new Set([
  '讚', '超讚', '好吃', '推', '棒', '美味', '讚的', '讚啦', '很讚', '推推', 
  '讚喔', '好喝', '讚讚', '不錯', '好讚', '好店', '優', '優質', '讚哩',
  '讚啊', '極推', '大推', '好食', '真讚', '好美味'
]);

/**
 * Audit an individual review based on local heuristic rules.
 */
export function auditReview(review: Review): AuditResult {
  const text = review.text || '';

  // 1. Explicit Bribe/Incentive Check
  for (const keyword of INCENTIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        isWashed: true,
        reason: `直接提及打卡/活動/贈送交易關鍵字：『${keyword}』。`,
        confidenceScore: 100,
        issueType: 'incentive',
      };
    }
  }

  // 2. Catch generic "送" but filter out non-incentive terms like "外送", "配送", "送禮", "送給" etc.
  const excludes = ['外送', '配送', '送禮', '送給', '送餐', '送上', '送來', '送錯', '送客', '送走', '送出', '推送', '面送', '送速度', '送口', '送入'];
  if (text.includes('送') && !excludes.some(ex => text.includes(ex))) {
    return {
      isWashed: true,
      reason: `直接匹配到打卡/活動/贈送交易關鍵字：『送』。`,
      confidenceScore: 100,
      issueType: 'incentive',
    };
  }

  // 3. Catch extremely short generic empty/template reviews (e.g. "讚", "推", "好吃")
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

  // Fallback (Non-washed in Stage 1)
  return {
    isWashed: false,
    reason: '評論無顯性利益交換跡象。',
    confidenceScore: 80,
    issueType: null,
  };
}

function getNGrams(str: string, n = 2): Set<string> {
  const ngrams = new Set<string>();
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

function calculateJaccardSimilarity(s1: string, s2: string): number {
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

/**
 * Computes full audit metrics for a restaurant's list of parsed reviews.
 */
export function computeShopStats(storeName: string, reviews: Review[]): ShopStats {
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return {
      storeName,
      originalRating: 0,
      filteredRating: 0,
      trustScore: 100,
      totalReviews: 0,
      suspiciousReviews: 0,
      issues: { timeAnomaly: 0, templateText: 0, vague: 0 },
      ratingDistribution: {
        original: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        filtered: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
      auditedReviews: [],
    };
  }

  // Precompute pairwise similarity to detect template farm copy-pastes
  const duplicateFlags = new Set<number>();
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

  let originalSum = 0;
  let weightedSum = 0;
  let weightTotal = 0;
  let suspiciousReviewsCount = 0;

  const originalDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const filteredDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const issuesCount = {
    timeAnomaly: 0, // Maps to 'incentive' in our local model
    templateText: 0, // Maps to 'template'
    vague: 0, // Maps to 'discrepancy'
  };

  const auditedReviews = reviews.map((review, idx) => {
    let audit = auditReview(review);
    
    // Override with template flag if high similarity was detected
    if (!audit.isWashed && duplicateFlags.has(idx)) {
      audit = {
        isWashed: true,
        reason: '⚠️ 檢測到此評論內文與店內其他評論相似度大於 75%，高度疑似模板洗評。',
        confidenceScore: 90,
        issueType: 'template'
      };
    }
    
    // Compute review weight based on confidence score (no binary hard cut-off!)
    const weight = audit.isWashed 
      ? 1 - (audit.confidenceScore / 100) 
      : (audit.confidenceScore / 100);

    // Accumulate original stats
    originalSum += review.stars;
    originalDistribution[review.stars as 1 | 2 | 3 | 4 | 5] = (originalDistribution[review.stars as 1 | 2 | 3 | 4 | 5] || 0) + 1;

    // Accumulate weighted stats
    weightedSum += review.stars * weight;
    weightTotal += weight;

    // Accumulate weighted star distribution (rounded to 1 decimal to avoid floating point precision leaks)
    filteredDistribution[review.stars as 1 | 2 | 3 | 4 | 5] = parseFloat(
      ((filteredDistribution[review.stars as 1 | 2 | 3 | 4 | 5] || 0) + weight).toFixed(1)
    );

    if (audit.isWashed) {
      suspiciousReviewsCount++;
      if (audit.issueType === 'incentive') {
        issuesCount.timeAnomaly++;
      } else if (audit.issueType === 'template') {
        issuesCount.templateText++;
      } else if (audit.issueType === 'discrepancy') {
        issuesCount.vague++;
      }
    }

    return {
      ...review,
      audit,
    };
  });

  const originalRating = originalSum / totalReviews;
  const basicFilteredRating = weightTotal > 0 ? weightedSum / weightTotal : originalRating;
  
  // Calculate trust score based on ratio of suspicious reviews (2x penalty factor)
  const trustScore = Math.max(0, 100 - (suspiciousReviewsCount / totalReviews) * 100 * 2.0);
  
  // Apply a trust penalty to the de-watered rating to reflect the reputational fraud risk
  const trustPenalty = (100 - trustScore) * 0.02;
  const filteredRating = Math.max(1.0, basicFilteredRating - trustPenalty);

  return {
    storeName,
    originalRating: parseFloat(originalRating.toFixed(2)),
    filteredRating: parseFloat(filteredRating.toFixed(2)),
    trustScore: parseFloat(trustScore.toFixed(0)),
    totalReviews,
    suspiciousReviews: suspiciousReviewsCount,
    issues: issuesCount,
    ratingDistribution: {
      original: originalDistribution,
      filtered: filteredDistribution,
    },
    auditedReviews,
  };
}
