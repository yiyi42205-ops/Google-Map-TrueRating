import { AlertTriangle, Clock, FileText, ThumbsUp } from 'lucide-react';

interface ReviewCardProps {
  author: string;
  rating: number;
  date: string;
  text: string;
  flags: {
    timeAnomaly?: boolean;
    templateText?: boolean;
    vague?: boolean;
  };
}

export function ReviewCard({ author, rating, date, text, flags }: ReviewCardProps) {
  const hasFlags = flags.timeAnomaly || flags.templateText || flags.vague;

  return (
    <div className={`p-4 rounded-lg border ${hasFlags ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-medium">{author}</div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
              ))}
            </div>
            <span>{date}</span>
          </div>
        </div>
        {hasFlags && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>

      <p className="text-gray-700 mb-3">{text}</p>

      {hasFlags && (
        <div className="flex flex-wrap gap-2">
          {flags.timeAnomaly && (
            <div className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
              <Clock className="w-3 h-3" />
              時間異常集中
            </div>
          )}
          {flags.templateText && (
            <div className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
              <FileText className="w-3 h-3" />
              樣板文字
            </div>
          )}
          {flags.vague && (
            <div className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
              <ThumbsUp className="w-3 h-3" />
              內容空泛
            </div>
          )}
        </div>
      )}
    </div>
  );
}
