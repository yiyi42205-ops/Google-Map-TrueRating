import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2 } from 'lucide-react';

interface VendingMachineProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function VendingMachine({ url, setUrl, onAnalyze, isAnalyzing }: VendingMachineProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Vending Machine Body */}
      <div className="bg-gradient-to-b from-red-600 to-red-700 rounded-3xl shadow-2xl p-8 border-8 border-red-800">
        {/* Top Sign */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-400 text-red-900 text-center py-4 px-6 rounded-xl mb-6 shadow-lg"
        >
          <h1 className="text-3xl font-black tracking-wider">評價真實性分析機</h1>
          <p className="text-sm font-semibold mt-1">REVIEW AUTHENTICITY ANALYZER</p>
        </motion.div>

        {/* Display Screen */}
        <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-2xl p-6 mb-6 border-4 border-gray-800 shadow-inner">
          <div className="bg-green-400/20 rounded-xl p-4 font-mono text-green-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">READY</span>
            </div>
            <div className="text-xs mb-3 text-green-200">請輸入 Google Map 連結</div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="w-full bg-black/50 text-green-300 px-3 py-2 rounded border border-green-600 focus:border-green-400 outline-none placeholder-green-700"
              onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
            />
          </div>
        </div>

        {/* Product Selection Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { code: 'A1', label: '快速分析', icon: '⚡' },
            { code: 'A2', label: '深度分析', icon: '🔍' },
            { code: 'A3', label: '完整報告', icon: '📊' },
            { code: 'B1', label: '信任度', icon: '🛡️' },
            { code: 'B2', label: '星級比對', icon: '⭐' },
            { code: 'B3', label: '問題偵測', icon: '⚠️' },
          ].map((item) => (
            <motion.div
              key={item.code}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border-2 border-white/30 cursor-pointer hover:bg-white/20 transition-colors"
            >
              <div className="text-white font-bold text-sm mb-1">{item.code}</div>
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-white text-xs">{item.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Control Panel */}
        <div className="bg-gray-900 rounded-2xl p-6 border-4 border-gray-800">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((num) => (
              <motion.button
                key={num}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="bg-gradient-to-b from-gray-700 to-gray-800 text-white font-bold text-xl py-3 rounded-lg shadow-lg border-2 border-gray-600 hover:from-gray-600 hover:to-gray-700"
              >
                {num}
              </motion.button>
            ))}
          </div>

          {/* Main Action Button */}
          <motion.button
            onClick={onAnalyze}
            disabled={isAnalyzing || !url.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-xl py-4 rounded-xl shadow-lg disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed border-4 border-green-700 disabled:border-gray-700 transition-all"
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
                  <Search className="w-6 h-6" />
                  開始分析
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Coin Return Slot */}
        <div className="mt-6 flex items-center justify-between">
          <div className="bg-black rounded-lg px-4 py-2 border-2 border-gray-700">
            <div className="text-yellow-400 text-xs font-bold">💰 找零口</div>
          </div>
          <div className="bg-yellow-600 rounded-lg px-4 py-2 border-2 border-yellow-800 shadow-inner">
            <div className="text-yellow-900 text-xs font-bold">🪙 投幣口</div>
          </div>
        </div>
      </div>

      {/* Machine Shadow */}
      <div className="absolute inset-x-0 -bottom-4 h-8 bg-black/20 blur-xl rounded-full -z-10"></div>
    </div>
  );
}
