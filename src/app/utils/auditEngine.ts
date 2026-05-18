import { Review } from './csvParser';

export interface AuditResult {
  isWashed: boolean;
  reason: string;
  confidenceScore: number;
  issueType: 'incentive' | 'template' | 'discrepancy' | null;
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
  '打卡', '活動', '五星', '五顆星', '好評', '評論送', '打卡送', '好評送', '免費送', 
  '送小菜', '送起司球', '送飲料', '送肉', '送單點', '送麻糬', '送奶酪'
];

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

  // 2. Catch generic "送" but filter out non-incentive terms like "外送", "配送", "送禮", "送給"
  if (text.includes('送') && !text.includes('外送') && !text.includes('配送') && !text.includes('送禮') && !text.includes('送給')) {
    return {
      isWashed: true,
      reason: `直接匹配到打卡/活動/贈送交易關鍵字：『送』。`,
      confidenceScore: 100,
      issueType: 'incentive',
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

  const auditedReviews = reviews.map(review => {
    const audit = auditReview(review);
    
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
  const filteredRating = weightTotal > 0 ? weightedSum / weightTotal : originalRating;
  const trustScore = totalReviews > 0 ? (weightTotal / totalReviews) * 100 : 100;

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
