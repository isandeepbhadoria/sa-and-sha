import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShop } from '../context/ShopContext';
import { CheckCircle2, ShoppingBag, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useShop();

  return (
    <AnimatePresence>
      {toast?.visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          id="toast-alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2A211C] text-[#FBF6EE] px-5 py-3.5 rounded-lg shadow-xl border border-[#E5D2BC]/20 max-w-md w-[calc(100vw-2rem)]"
        >
          <div className="bg-[#B08D57] text-white p-1 rounded-full shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1 text-sm font-sans font-medium tracking-wide leading-tight">
            {toast.message}
          </div>
          <button
            onClick={hideToast}
            className="text-white/60 hover:text-white p-1 shrink-0 transition-colors"
            aria-label="Close notification"
            id="toast-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
