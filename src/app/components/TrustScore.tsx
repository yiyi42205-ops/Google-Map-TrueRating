import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface TrustScoreProps {
  score: number;
  totalReviews: number;
  suspiciousReviews: number;
}

export function TrustScore({ score, totalReviews, suspiciousReviews }: TrustScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 80) return '高信任度';
    if (score >= 60) return '中等信任度';
    return '低信任度';
  };

  const getIcon = () => {
    if (score >= 80) return <CheckCircle className="w-8 h-8" />;
    if (score >= 60) return <Shield className="w-8 h-8" />;
    return <AlertTriangle className="w-8 h-8" />;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <div className="flex items-center gap-4 mb-4">
        <div className={getScoreColor()}>
          {getIcon()}
        </div>
        <div>
          <h3 className="text-2xl font-bold">{getScoreLabel()}</h3>
          <p className="text-gray-600">評價信任度分數</p>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className={`text-5xl font-bold ${getScoreColor()}`}>{score}</span>
        <span className="text-gray-500 pb-2">/100</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className={`h-3 rounded-full transition-all ${
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <div className="text-2xl font-bold text-gray-800">{totalReviews}</div>
          <div className="text-sm text-gray-600">總評價數</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{suspiciousReviews}</div>
          <div className="text-sm text-gray-600">可疑評價</div>
        </div>
      </div>
    </div>
  );
}
