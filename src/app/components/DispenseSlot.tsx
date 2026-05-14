import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface DispenseSlotProps {
  isOpen: boolean;
  children: ReactNode;
}

export function DispenseSlot({ isOpen, children }: DispenseSlotProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-8">
      {/* Content Area - Simple and Clean */}
      <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 border-3 border-[#d4c5b0] shadow-lg">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: isOpen ? 0 : -20, opacity: isOpen ? 1 : 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 15 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
