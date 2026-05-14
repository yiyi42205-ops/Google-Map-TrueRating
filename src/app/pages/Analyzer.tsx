import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Link as LinkIcon, X } from 'lucide-react';

export function Analyzer() {
  const navigate = useNavigate();
  const [urls, setUrls] = useState(['', '', '']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleClear = (index: number) => {
    const newUrls = [...urls];
    newUrls[index] = '';
    setUrls(newUrls);
  };

  const handleAnalyze = () => {
    const filledUrls = urls.filter(url => url.trim() !== '');
    if (filledUrls.length === 0) return;

    setIsAnalyzing(true);

    // Simulate analysis
    setTimeout(() => {
      navigate('/results', { state: { urls: filledUrls } });
    }, 3000);
  };

  const filledCount = urls.filter(url => url.trim() !== '').length;

  return (
    <div className="min-h-screen bg-[#f5f1e8] py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate('/')}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mb-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-shadow border-2 border-[#d4c5b0] text-[#4a5d52]"
        >
          <ArrowLeft className="w-5 h-5" />
          返回首頁
        </motion.button>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-4 mb-6 text-center shadow-md border-3 border-[#e8c547]"
        >
          <p className="text-sm text-[#6b8e7f]">
            💡 最多可輸入 3 間店家進行比較分析
          </p>
        </motion.div>

        {/* Analysis Box */}
        <div className="relative w-full max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow-lg p-8 border-3 border-[#d4c5b0]">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="text-5xl mb-3">★☆★☆★</div>
              <h1 className="text-2xl font-bold text-[#4a5d52] mb-2">開始分析評價</h1>
              <p className="text-sm text-[#6b8e7f]">輸入店家的 Google Maps 連結</p>
            </motion.div>

            {/* Status Bar */}
            <div className="bg-[#f5f1e8] rounded-2xl p-3 mb-6 border-2 border-[#e8dcc8]">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[#6b8e7f]">
                  <div className="w-2 h-2 bg-[#6b8e7f] rounded-full animate-pulse"></div>
                  <span>請輸入⋯⋯</span>
                </div>
                <span className="text-[#4a5d52] font-bold">{filledCount}/3 店家</span>
              </div>
            </div>

            {/* URL Input Slots */}
            <div className="space-y-4 mb-6">
              {urls.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#f5f1e8] rounded-2xl p-4 border-2 border-[#e8dcc8]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-[#e8c547] text-[#4a5d52] font-bold px-3 py-1 rounded-full text-sm border-2 border-[#4a5d52]">
                      店家 {index + 1}
                    </div>
                    {url && (
                      <motion.button
                        onClick={() => handleClear(index)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="ml-auto bg-[#d4a5a5] text-white p-1.5 rounded-full border-2 border-[#4a5d52]"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b8e7f]" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border-2 border-[#d4c5b0] focus:border-[#6b8e7f] outline-none text-[#4a5d52] placeholder-[#a0b3a0]"
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Main Action Button */}
            <motion.button
              onClick={handleAnalyze}
              disabled={isAnalyzing || filledCount === 0}
              whileHover={{ scale: filledCount > 0 && !isAnalyzing ? 1.02 : 1 }}
              whileTap={{ scale: filledCount > 0 && !isAnalyzing ? 0.98 : 1 }}
              className="w-full bg-[#6b8e7f] text-white font-bold text-lg py-4 rounded-full shadow-lg disabled:bg-[#c9bfae] disabled:cursor-not-allowed border-3 border-[#4a5d52] disabled:border-[#a0b3a0] transition-all"
            >
              <AnimatePresence mode="wait">
                {isAnalyzing ? (
                  <motion.div
                    key="analyzing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-3"
                  >
                    <Loader2 className="w-6 h-6 animate-spin" />
                    分析處理中...
                  </motion.div>
                ) : (
                  <motion.div
                    key="analyze"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-3"
                  >
                    開始分析 （{filledCount} 間店家）
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Processing Animation */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 text-center"
          >
            <div className="inline-block bg-white rounded-3xl p-8 shadow-lg border-3 border-[#6b8e7f]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 mx-auto mb-4 border-4 border-[#6b8e7f] border-t-transparent rounded-full"
              ></motion.div>
              <div className="text-lg font-bold text-[#4a5d52] mb-2">🔍 分析中...</div>
              <div className="text-sm text-[#6b8e7f]">正在檢測評價異常模式</div>
              <div className="mt-4 flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    className="w-2 h-2 bg-[#6b8e7f] rounded-full"
                  ></motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
