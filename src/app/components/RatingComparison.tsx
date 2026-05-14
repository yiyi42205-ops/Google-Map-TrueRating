import { TrendingDown, Star } from 'lucide-react';

interface RatingComparisonProps {
  originalRating: number;
  filteredRating: number;
}

export function RatingComparison({ originalRating, filteredRating }: RatingComparisonProps) {
  const difference = originalRating - filteredRating;

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" />
        星級比較
      </h3>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-gray-600 mb-2">Google 原始星級</div>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-gray-800">{originalRating.toFixed(1)}</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < Math.floor(originalRating) ? 'text-yellow-400 text-2xl' : 'text-gray-300 text-2xl'}>★</span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-2">AI 濾水後真實星級</div>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-blue-600">{filteredRating.toFixed(1)}</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < Math.floor(filteredRating) ? 'text-blue-500 text-2xl' : 'text-gray-300 text-2xl'}>★</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {difference > 0.3 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-600" />
          <span className="text-red-700">
            濾除可疑評價後，實際星級下降 <strong>{difference.toFixed(1)}</strong> 顆星
          </span>
        </div>
      )}
    </div>
  );
}
