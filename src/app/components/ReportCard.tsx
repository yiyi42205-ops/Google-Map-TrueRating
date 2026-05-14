import { motion } from 'motion/react';
import { TrustScore } from './TrustScore';
import { RatingComparison } from './RatingComparison';
import { IssuesSummary } from './IssuesSummary';
import { ReviewCard } from './ReviewCard';

interface ReportCardProps {
  data: {
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
    reviews: Array<{
      author: string;
      rating: number;
      date: string;
      text: string;
      flags: {
        timeAnomaly?: boolean;
        templateText?: boolean;
        vague?: boolean;
      };
    }>;
  };
}

export function ReportCard({ data }: ReportCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="bg-white rounded-xl shadow-xl overflow-hidden"
    >
      {/* Report Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <h2 className="text-xl font-bold mb-1">{data.storeName}</h2>
        <p className="text-sm opacity-90">完整分析報告 - {data.totalReviews} 則評價</p>
      </div>

      {/* Report Content */}
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="text-xs text-blue-600 mb-1">信任度分數</div>
            <div className="text-2xl font-bold text-blue-700">{data.trustScore}/100</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border border-red-200">
            <div className="text-xs text-red-600 mb-1">可疑評價</div>
            <div className="text-2xl font-bold text-red-700">{data.suspiciousReviews}則</div>
          </div>
        </div>

        {/* Rating Comparison - Compact */}
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm font-semibold mb-2">星級比較</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600">原始</div>
              <div className="text-xl font-bold text-gray-800">{data.originalRating.toFixed(1)} ⭐</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">濾水後</div>
              <div className="text-xl font-bold text-blue-600">{data.filteredRating.toFixed(1)} ⭐</div>
            </div>
          </div>
        </div>

        {/* Issues Summary - Compact */}
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm font-semibold mb-2">問題分佈</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{data.issues.timeAnomaly}</div>
              <div className="text-xs text-gray-600">時間集中</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{data.issues.templateText}</div>
              <div className="text-xs text-gray-600">樣板文字</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{data.issues.vague}</div>
              <div className="text-xs text-gray-600">內容空泛</div>
            </div>
          </div>
        </div>

        {/* Top Reviews */}
        <div>
          <div className="text-sm font-semibold mb-2">評價樣本 (前3則)</div>
          <div className="space-y-2">
            {data.reviews.slice(0, 3).map((review, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-2 border text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{review.author}</span>
                  <span className="text-gray-600">{review.date}</span>
                </div>
                <div className="text-gray-700 mb-1">{review.text.slice(0, 60)}...</div>
                {(review.flags.timeAnomaly || review.flags.templateText || review.flags.vague) && (
                  <div className="flex gap-1 flex-wrap">
                    {review.flags.timeAnomaly && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">⏰</span>
                    )}
                    {review.flags.templateText && (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">📝</span>
                    )}
                    {review.flags.vague && (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">💭</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className={`rounded-lg p-3 text-sm ${
          data.trustScore >= 70
            ? 'bg-green-50 border border-green-300 text-green-800'
            : data.trustScore >= 50
            ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
            : 'bg-red-50 border border-red-300 text-red-800'
        }`}>
          <div className="font-bold mb-1">
            {data.trustScore >= 70 ? '✅ 可信度高' : data.trustScore >= 50 ? '⚠️ 需謹慎' : '❌ 可信度低'}
          </div>
          <div className="text-xs">
            {data.trustScore >= 70
              ? '評價時間分佈正常，內容具體，建議可參考。'
              : data.trustScore >= 50
              ? '發現部分異常評價，建議多方比較。'
              : '大量可疑評價，建議審慎評估。'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
