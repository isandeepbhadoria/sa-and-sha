import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Play, Pause, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HeroSlide, HeroSliderConfig, DEFAULT_FALLBACK_HERO_SLIDES, DEFAULT_HERO_SLIDER_SETTINGS } from "../../types/homepageMedia";

interface HeroSliderProps {
  initialConfig?: HeroSliderConfig;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ initialConfig }) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<HeroSliderConfig>(
    initialConfig || {
      settings: DEFAULT_HERO_SLIDER_SETTINGS,
      slides: DEFAULT_FALLBACK_HERO_SLIDES,
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    }
  );

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Fetch updated config from public API if initialConfig wasn't provided or to sync
  useEffect(() => {
    let mounted = true;
    fetch("/api/homepage-media")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (mounted && data.success && data.data?.hero) {
          setConfig(data.data.hero);
        }
      })
      .catch((_err) => {
        // Fallback remains active
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeSlides = (config.slides || [])
    .filter((s) => s.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const slidesToRender = activeSlides.length > 0 ? activeSlides : DEFAULT_FALLBACK_HERO_SLIDES;
  const isMultiSlide = slidesToRender.length > 1;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slidesToRender.length);
  }, [slidesToRender.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? slidesToRender.length - 1 : prev - 1));
  }, [slidesToRender.length]);

  // Autoplay loop
  useEffect(() => {
    if (!isMultiSlide || isPaused || prefersReducedMotion || config.settings.autoplay === false) {
      return;
    }

    const intervalMs = Math.max(3, Math.min(10, config.settings.slideInterval || 5)) * 1000;
    const timer = setInterval(() => {
      nextSlide();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isMultiSlide, isPaused, prefersReducedMotion, config.settings.autoplay, config.settings.slideInterval, nextSlide]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isMultiSlide) return;
    if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "ArrowRight") {
      nextSlide();
    }
  };

  // Touch swipe support
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !isMultiSlide) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  const currentItem = slidesToRender[currentSlide] || slidesToRender[0];

  const handleCtaClick = (redirectUrl?: string) => {
    if (!redirectUrl) {
      navigate("/shop/shirts");
      return;
    }
    if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(redirectUrl);
    }
  };

  return (
    <section
      id="homepage-hero-slider"
      aria-label="Sa and Sha Hero Showcase"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative w-full overflow-hidden bg-stone-900 focus:outline-none focus:ring-1 focus:ring-[#B08D57]
                 h-[420px] min-[400px]:h-[440px] sm:h-[480px] md:h-[500px] lg:h-[540px] xl:h-[550px] min-[1400px]:h-[570px] 2xl:h-[600px] max-h-[600px]
                 flex items-center justify-center select-none"
    >
      {/* Background Slides */}
      <AnimatePresence mode={prefersReducedMotion ? "sync" : "wait"}>
        <motion.div
          key={currentItem.id || currentSlide}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.8 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.8 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Subtle dark tint to ensure WCAG AA contrast for text overlays */}
          <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
          <img
            src={currentItem.image}
            alt={currentItem.altText || "Sa and Sha Editorial Banner"}
            loading={currentSlide === 0 ? "eager" : "lazy"}
            style={{
              objectPosition: `${currentItem.focalPosition?.x ?? 50}% ${currentItem.focalPosition?.y ?? 50}%`
            }}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Editorial Slide Content Overlay */}
      <div className="relative z-20 max-w-5xl mx-auto px-6 text-center text-white py-8 sm:py-10 md:py-12">
        {currentItem.subheading && (
          <span className="text-xs sm:text-sm font-sans font-bold tracking-[0.25em] text-[#E5D2BC] uppercase block mb-3 drop-shadow-sm">
            {currentItem.subheading}
          </span>
        )}

        {currentItem.heading && (
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 drop-shadow-md max-w-3xl mx-auto leading-tight">
            {currentItem.heading}
          </h1>
        )}

        {currentItem.ctaLabel && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => handleCtaClick(currentItem.redirectUrl)}
              className="px-8 py-3.5 bg-[#B08D57] hover:bg-[#A04E2E] text-white font-sans text-xs sm:text-sm font-bold tracking-widest uppercase transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 group cursor-pointer rounded-sm"
              id={`hero-cta-btn-${currentSlide}`}
            >
              <span>{currentItem.ctaLabel}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* Multi-Slide Carousel Controls (Rendered ONLY when 2 or more active slides exist) */}
      {isMultiSlide && (
        <>
          {/* Previous Slide Arrow */}
          <button
            onClick={prevSlide}
            aria-label="Previous Hero Slide"
            id="hero-slider-prev-btn"
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/90 hover:text-white transition-all backdrop-blur-xs border border-white/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B08D57]"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* Next Slide Arrow */}
          <button
            onClick={nextSlide}
            aria-label="Next Hero Slide"
            id="hero-slider-next-btn"
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/90 hover:text-white transition-all backdrop-blur-xs border border-white/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B08D57]"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* Bottom Pagination Indicators and Pause/Play Toggle */}
          <div className="absolute bottom-5 left-0 right-0 z-30 flex items-center justify-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? "Play Hero Carousel" : "Pause Hero Carousel"}
              id="hero-slider-pause-toggle"
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition-colors border border-white/20 text-xs flex items-center justify-center mr-1"
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>

            {/* Indicator Dots */}
            <div className="flex items-center gap-2">
              {slidesToRender.map((slide, idx) => (
                <button
                  key={slide.id || idx}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  id={`hero-indicator-dot-${idx}`}
                  className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                    currentSlide === idx
                      ? "w-8 bg-white shadow-sm"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
