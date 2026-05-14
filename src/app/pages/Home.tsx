import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Shield, Star, AlertTriangle, TrendingDown, ArrowRight, Search } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f1e8]">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Cute Character Illustration */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mb-8"
          >
            <div className="inline-block relative">
              {/* Main character container */}
              <div className="bg-[#6b8e7f] rounded-3xl p-8 border-4 border-[#4a5d52] shadow-lg relative">
                {/* Simple cute character */}
                <div className="relative w-32 h-32 mx-auto">
                  {/* Head */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#f5e6d3] rounded-full border-3 border-[#4a5d52]"></div>
                  {/* Eyes */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-4">
                    <div className="w-2 h-2 bg-[#4a5d52] rounded-full"></div>
                    <div className="w-2 h-2 bg-[#4a5d52] rounded-full"></div>
                  </div>
                  {/* Smile */}
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 w-3 h-1 border-b-2 border-[#4a5d52] rounded-full"></div>
                  {/* Headscarf/turban */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-16 bg-[#5b7a9f] rounded-t-full border-3 border-[#4a5d52]"></div>
                  <div className="absolute top-4 right-0 w-10 h-12 bg-[#e8c547] rounded-full border-3 border-[#4a5d52]"></div>
                  {/* Body holding magnifying glass */}
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-20 h-12 bg-[#e8c547] rounded-lg border-3 border-[#4a5d52]"></div>
                  {/* Magnifying glass */}
                  <div className="absolute top-24 left-2">
                    <div className="w-8 h-8 border-3 border-[#4a5d52] rounded-full bg-white/50"></div>
                    <div className="w-1 h-6 bg-[#4a5d52] -mt-2 ml-3 rotate-45"></div>
                  </div>
                </div>
              </div>
              {/* Floating stars */}
              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-4 -right-4 text-3xl"
              >⭐</motion.div>
              <motion.div
                animate={{ y: [5, -5, 5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute -bottom-4 -left-4 text-2xl"
              >⭐</motion.div>
            </div>
          </motion.div>

          <h1 className="text-4xl font-bold mb-3 text-[#4a5d52]">
            疑騙真星
          </h1>
          <p className="text-lg text-[#6b8e7f] mb-8 max-w-xl mx-auto leading-relaxed">
            幫你分析 Google Maps 評價<br />
            找出可疑的「五星好評」<br />
            看見真實的店家評分！！！
          </p>

          <motion.button
            onClick={() => navigate('/analyzer')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#e8c547] text-[#4a5d52] px-8 py-3 rounded-full text-lg font-bold shadow-lg hover:shadow-xl transition-shadow border-3 border-[#4a5d52] flex items-center gap-3 mx-auto"
          >
            開始分析
            <Search className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="bg-white rounded-3xl p-6 shadow-md border-3 border-[#d4c5b0]">
            <h3 className="text-lg font-bold mb-2 text-[#4a5d52]">信任度分析</h3>
            <p className="text-sm text-[#6b8e7f] leading-relaxed">
              偵測時間異常、樣板文字等可疑模式，給出信任分數
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border-3 border-[#d4c5b0]">
            <h3 className="text-lg font-bold mb-2 text-[#4a5d52]">真實星級</h3>
            <p className="text-sm text-[#6b8e7f] leading-relaxed">
              濾掉可疑評價，重新計算真實的店家評分
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border-3 border-[#d4c5b0]">
            <h3 className="text-lg font-bold mb-2 text-[#4a5d52]">詳細報告</h3>
            <p className="text-sm text-[#6b8e7f] leading-relaxed">
              清楚標示每則評價的問題，幫助你做決定
            </p>
          </div>
        </motion.div>

        {/* Problem Statement */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-[#e8dcc8] rounded-3xl p-8 shadow-md border-3 border-[#d4c5b0] mb-12"
        >
          <h2 className="text-xl font-bold mb-6 text-[#4a5d52] text-center">
            常見的評價造假方式
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 bg-white rounded-2xl p-4 border-2 border-[#d4c5b0]">
              <div className="text-2xl">★</div>
              <div>
                <div className="font-bold text-[#4a5d52] text-sm mb-1">時間異常集中</div>
                <div className="text-xs text-[#6b8e7f]">短時間內大量五星評價</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white rounded-2xl p-4 border-2 border-[#d4c5b0]">
              <div className="text-2xl">☆</div>
              <div>
                <div className="font-bold text-[#4a5d52] text-sm mb-1">樣板文字</div>
                <div className="text-xs text-[#6b8e7f]">重複的「超好吃！推推推！」</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white rounded-2xl p-4 border-2 border-[#d4c5b0]">
              <div className="text-2xl">☆</div>
              <div>
                <div className="font-bold text-[#4a5d52] text-sm mb-1">內容空泛</div>
                <div className="text-xs text-[#6b8e7f]">沒有具體描述的籠統好評</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white rounded-2xl p-4 border-2 border-[#d4c5b0]">
              <div className="text-2xl">★</div>
              <div>
                <div className="font-bold text-[#4a5d52] text-sm mb-1">打卡送優惠</div>
                <div className="text-xs text-[#6b8e7f]">誘導消費者給好評</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center bg-[#6b8e7f] text-white rounded-3xl p-10 shadow-lg border-3 border-[#4a5d52]"
        >
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-2xl font-bold mb-3">準備好了嗎？</h2>
          <p className="text-base mb-6 opacity-90">
            最多可同時比較 3 間店家<br />
            找出最值得信賴的選擇
          </p>
          <motion.button
            onClick={() => navigate('/analyzer')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#e8c547] text-[#4a5d52] px-8 py-3 rounded-full text-lg font-bold shadow-lg hover:shadow-xl transition-shadow border-3 border-[#4a5d52] flex items-center gap-3 mx-auto"
          >
            立即開始
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-10 text-center text-sm text-[#6b8e7f]"
        >
          <p>本平台由 AI 系統針對 Google Maps 公開評論進行行為模式與語意特徵之演算法分析，結果僅供個人決策參考，不保證分析結果之絕對準確性，亦不代表對該店家產品品質、衛生條件或服務水準之最終評價。使用者應自行判斷資訊之真實性，本平台不對因參考此報告而產生的任何消費爭議或損失承擔法律責任。</p>
        </motion.div>
      </div>
    </div>
  );
}
