import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard';

interface ProductCarouselShelfProps {
  idPrefix: string;
  eyebrow: string;
  eyebrowColorClass?: string;
  title: string;
  subtitle: string;
  viewAllLink: string;
  viewAllId: string;
  leftScrollId: string;
  rightScrollId: string;
  products: Product[];
  autoScrollIntervalMs?: number;
  bgClassName?: string;
  showBorderY?: boolean;
}

export const ProductCarouselShelf: React.FC<ProductCarouselShelfProps> = ({
  idPrefix,
  eyebrow,
  eyebrowColorClass = 'text-[#B08D57]',
  title,
  subtitle,
  viewAllLink,
  viewAllId,
  leftScrollId,
  rightScrollId,
  products,
  autoScrollIntervalMs = 4500,
  bgClassName = '',
  showBorderY = false,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // IntersectionObserver: only auto-scroll when the section is visible in viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Temporary pause on user manual navigation
  const pauseUserInteractionTemporarily = useCallback((durationMs: number = 6000) => {
    setIsUserInteracting(true);
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, durationMs);
  }, []);

  // Manual scroll handler
  const handleScroll = (direction: 'left' | 'right') => {
    pauseUserInteractionTemporarily();
    const container = scrollRef.current;
    if (!container) return;

    // Card width (280px) + gap (24px) = 304px
    const step = 304;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === 'right') {
      if (container.scrollLeft >= maxScroll - 15) {
        // Smooth loop back to start
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: step, behavior: 'smooth' });
      }
    } else {
      if (container.scrollLeft <= 15) {
        // Smooth loop to end
        container.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: -step, behavior: 'smooth' });
      }
    }
  };

  // Smart Auto-Scroll Timer: advances one card smoothly unless hovered or interacting
  useEffect(() => {
    if (isHovered || isUserInteracting || !isVisible || prefersReducedMotion) {
      return;
    }

    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container) return;

      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll <= 15) return; // Content fits in viewport, no scroll needed

      const step = 304;
      if (container.scrollLeft >= maxScroll - 20) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, autoScrollIntervalMs);

    return () => clearInterval(interval);
  }, [isHovered, isUserInteracting, isVisible, prefersReducedMotion, autoScrollIntervalMs]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      id={`section-${idPrefix}`}
      className={`${bgClassName} ${showBorderY ? 'border-y border-[#E5D2BC]/20' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="relative mb-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className={`text-xs font-sans font-bold tracking-[0.25em] uppercase ${eyebrowColorClass}`}>
              {eyebrow}
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C] mt-2">
              {title}
            </h2>
            <p className="font-sans text-xs md:text-sm text-[#2A211C]/65 mt-2">
              {subtitle}
            </p>
          </div>

          {/* Unified Controls: View All Link + Left / Right Arrow Scroll Buttons */}
          <div className="flex items-center justify-center md:justify-end gap-4 mt-4 md:mt-0 md:absolute md:right-0 md:bottom-0">
            <Link
              to={viewAllLink}
              className="text-xs font-sans font-bold tracking-widest text-[#B08D57] uppercase hover:underline flex items-center gap-1.5 transition-all py-1.5"
              id={viewAllId}
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                className="p-2 border border-[#E5D2BC]/30 hover:bg-[#2A211C] hover:text-white rounded transition-colors text-[#2A211C] bg-white cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
                id={leftScrollId}
                aria-label={`Scroll ${title} left`}
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                className="p-2 border border-[#E5D2BC]/30 hover:bg-[#2A211C] hover:text-white rounded transition-colors text-[#2A211C] bg-white cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
                id={rightScrollId}
                aria-label={`Scroll ${title} right`}
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontally Scrollable Product Shelf with Hover Pause & Touch Support */}
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => pauseUserInteractionTemporarily(8000)}
          className="flex gap-6 overflow-x-auto pb-4 pt-1 snap-x scroll-smooth scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div key={product.id} className="w-[280px] shrink-0 snap-start">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
