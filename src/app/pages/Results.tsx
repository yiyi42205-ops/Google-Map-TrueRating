import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Trophy, AlertTriangle, ExternalLink } from 'lucide-react';
import { DispenseSlot } from '../components/DispenseSlot';

// Mock data generator
const generateMockData = (index: number) => {
  const scenarios = [
    {
      storeName: '麵屋長樂',
      originalRating: 4.8,
      filteredRating: 3.2,
      trustScore: 42,
      totalReviews: 156,
      suspiciousReviews: 89,
      issues: { timeAnomaly: 45, templateText: 32, vague: 12 },
    },
    {
      storeName: '小高拉麵',
      originalRating: 4.5,
      filteredRating: 4.3,
      trustScore: 78,
      totalReviews: 98,
      suspiciousReviews: 15,
      issues: { timeAnomaly: 8, templateText: 5, vague: 2 },
    },
    {
      storeName: '墨洋拉麵',
      originalRating: 4.7,
      filteredRating: 3.9,
      trustScore: 61,
      totalReviews: 124,
      suspiciousReviews: 42,
      issues: { timeAnomaly: 22, templateText: 15, vague: 5 },
    },
  ];

  return scenarios[index % 3];
};

export function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const urls = (location.state?.urls as string[]) || [];

  const results = urls.map((_, index) => generateMockData(index));

  // Find best store (highest trust score)
  const bestStoreIndex = results.reduce((maxIdx, current, idx, arr) =>
    current.trustScore > arr[maxIdx].trustScore ? idx : maxIdx, 0
  );

  return (
    <div className="min-h-screen bg-[#f5f1e8] py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate('/analyzer')}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mb-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-shadow border-2 border-[#d4c5b0] text-[#4a5d52]"
        >
          <ArrowLeft className="w-5 h-5" />
          重新分析
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 shadow-lg mb-6 border-3 border-[#d4c5b0] text-center"
        >
          <h1 className="text-2xl font-bold mb-2 text-[#4a5d52]">分析報告</h1>
          <p className="text-[#6b8e7f]">已完成 {results.length} 間店家的評價真實性分析</p>
        </motion.div>

        {/* Winner Card */}
        {results.length > 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#e8c547] rounded-3xl p-6 shadow-lg mb-6 border-3 border-[#4a5d52]"
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">🏆</div>
              <div>
                <div className="text-[#4a5d52] font-bold text-sm mb-1">最值得信賴</div>
                <div className="text-2xl font-bold text-[#4a5d52]">{results[bestStoreIndex].storeName}</div>
                <div className="text-[#6b8e7f] text-sm mt-1">
                  信任度分數：{results[bestStoreIndex].trustScore}/100
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dispense Slot with Results */}
        <DispenseSlot isOpen={true}>
          <div className="space-y-4">
            {results.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`bg-white rounded-3xl shadow-lg overflow-hidden border-3 ${
                  index === bestStoreIndex ? 'border-[#e8c547]' : 'border-[#d4c5b0]'
                }`}
              >
                {/* Store Header */}
                <div className={`p-5 ${
                  index === bestStoreIndex
                    ? 'bg-[#e8c547]'
                    : 'bg-[#6b8e7f]'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-[#4a5d52]">
                        {index === bestStoreIndex && <span className="text-2xl">🏆</span>}
                        {result.storeName}
                      </h2>
                      <p className="text-sm text-[#4a5d52]/80">{result.totalReviews} 則評價</p>
                    </div>
                    <button className="bg-white/30 hover:bg-white/50 p-2 rounded-full transition-colors border-2 border-[#4a5d52]">
                      <ExternalLink className="w-5 h-5 text-[#4a5d52]" />
                    </button>
                  </div>
                </div>

                {/* Results Grid */}
                <div className="p-5">
                  {/* Trust Score & Suspicious Reviews */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-2xl p-4 border-2 ${
                      result.trustScore >= 70
                        ? 'bg-[#d4e8d4] border-[#6b8e7f]'
                        : result.trustScore >= 50
                        ? 'bg-[#f5ead4] border-[#e8c547]'
                        : 'bg-[#f5d4d4] border-[#d4a5a5]'
                    }`}>
                      <div className="text-xs text-[#6b8e7f] mb-1">信任度分數</div>
                      <div className={`text-2xl font-bold ${
                        result.trustScore >= 70
                          ? 'text-[#4a5d52]'
                          : result.trustScore >= 50
                          ? 'text-[#8b7534]'
                          : 'text-[#8b5a5a]'
                      }`}>
                        {result.trustScore}/100
                      </div>
                    </div>
                    <div className="bg-[#f5d4d4] rounded-2xl p-4 border-2 border-[#d4a5a5]">
                      <div className="text-xs text-[#6b8e7f] mb-1">可疑評價</div>
                      <div className="text-2xl font-bold text-[#8b5a5a]">{result.suspiciousReviews}則</div>
                    </div>
                  </div>

                  {/* Rating Comparison */}
                  <div className="bg-[#f5f1e8] rounded-2xl p-4 border-2 border-[#e8dcc8] mb-4">
                    <div className="text-sm font-bold mb-3 text-[#4a5d52]">星級比較</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-[#6b8e7f] mb-1">原始星級</div>
                        <div className="text-2xl font-bold text-[#4a5d52]">{result.originalRating.toFixed(1)}</div>
                        <div className="flex mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={i < Math.floor(result.originalRating) ? 'text-[#e8c547]' : 'text-[#d4c5b0]'}>★</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#6b8e7f] mb-1">濾水後星級</div>
                        <div className="text-2xl font-bold text-[#6b8e7f]">{result.filteredRating.toFixed(1)}</div>
                        <div className="flex mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={i < Math.floor(result.filteredRating) ? 'text-[#6b8e7f]' : 'text-[#d4c5b0]'}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {result.originalRating - result.filteredRating > 0.3 && (
                      <div className="mt-3 p-3 bg-[#f5d4d4] border-2 border-[#d4a5a5] rounded-xl text-xs text-[#8b5a5a] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        實際星級下降 {(result.originalRating - result.filteredRating).toFixed(1)} 顆星
                      </div>
                    )}
                  </div>

                  {/* Issues */}
                  <div className="bg-[#f5f1e8] rounded-2xl p-4 border-2 border-[#e8dcc8] mb-4">
                    <div className="text-sm font-bold mb-3 text-[#4a5d52]">問題分佈</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-white rounded-xl p-2 border-2 border-[#d4c5b0]">
                        <div className="text-xl font-bold text-[#d4a5a5]">{result.issues.timeAnomaly}</div>
                        <div className="text-xs text-[#6b8e7f]">時間集中</div>
                      </div>
                      <div className="text-center bg-white rounded-xl p-2 border-2 border-[#d4c5b0]">
                        <div className="text-xl font-bold text-[#e8c547]">{result.issues.templateText}</div>
                        <div className="text-xs text-[#6b8e7f]">樣板文字</div>
                      </div>
                      <div className="text-center bg-white rounded-xl p-2 border-2 border-[#d4c5b0]">
                        <div className="text-xl font-bold text-[#a0b3a0]">{result.issues.vague}</div>
                        <div className="text-xs text-[#6b8e7f]">內容空泛</div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className={`rounded-2xl p-4 text-sm border-2 ${
                    result.trustScore >= 70
                      ? 'bg-[#d4e8d4] border-[#6b8e7f] text-[#4a5d52]'
                      : result.trustScore >= 50
                      ? 'bg-[#f5ead4] border-[#e8c547] text-[#8b7534]'
                      : 'bg-[#f5d4d4] border-[#d4a5a5] text-[#8b5a5a]'
                  }`}>
                    <div className="font-bold mb-1">
                      {result.trustScore >= 70 ? '✅ 可信度高' : result.trustScore >= 50 ? '⚠️ 需謹慎' : '❌ 可信度低'}
                    </div>
                    <div className="text-xs">
                      {result.trustScore >= 70
                        ? '評價時間分佈正常，內容具體，建議可參考。'
                        : result.trustScore >= 50
                        ? '發現部分異常評價，建議多方比較。'
                        : '大量可疑評價，建議審慎評估。'}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </DispenseSlot>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex gap-4 justify-center flex-wrap"
        >
          <motion.button
            onClick={() => navigate('/analyzer')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#6b8e7f] text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-shadow border-3 border-[#4a5d52]"
          >
            分析其他店家
          </motion.button>
          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-[#4a5d52] px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-shadow border-3 border-[#d4c5b0]"
          >
            返回首頁
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
