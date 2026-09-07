import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { AlertCircle, ArrowLeft, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';

export const NotFoundPage: React.FC = () => {
  useSEO({
    title: 'Page Not Found | Sa and Sha',
    description: 'The premium linen garment or page you are looking for does not exist. Explore Sa and Sha menswear and custom shirts on our homepage.',
    noindex: true
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-center space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-20 h-20 bg-[#B85C38]/10 text-[#B85C38] flex items-center justify-center rounded-full"
      >
        <AlertCircle className="w-10 h-10" />
      </motion.div>

      <div className="space-y-3">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#C9B79C] uppercase">Error 404</span>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#1F1B16]">Garment Not Found</h1>
        <p className="font-sans text-xs md:text-sm text-[#1F1B16]/60 max-w-md mx-auto leading-relaxed">
          The path or item you requested seems to have been tailored out of our catalog. Let us help you find your perfect fit.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
        <Link
          to="/"
          className="w-full sm:w-auto bg-[#1F1B16] hover:bg-[#1F1B16]/90 text-white font-sans font-bold text-xs uppercase tracking-widest py-3.5 px-8 rounded flex items-center justify-center gap-2 transition-colors"
          id="notfound-home-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <Link
          to="/shop/all"
          className="w-full sm:w-auto bg-transparent hover:bg-[#1F1B16]/5 text-[#1F1B16] font-sans font-bold text-xs uppercase tracking-widest py-3.5 px-8 rounded border border-[#1F1B16]/30 flex items-center justify-center gap-2 transition-all"
          id="notfound-shop-btn"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Shop Collections</span>
        </Link>
      </div>
    </div>
  );
};
