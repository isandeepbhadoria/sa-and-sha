import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Instagram } from "lucide-react";
import { InstagramMediaItem, BestOfInstagramConfig, BRAND_INSTAGRAM_URL } from "../../types/homepageMedia";
import { useNavigate } from "react-router-dom";

interface BestOfInstagramProps {
  initialConfig?: BestOfInstagramConfig;
}

export const BestOfInstagram: React.FC<BestOfInstagramProps> = ({ initialConfig }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<InstagramMediaItem[]>(initialConfig?.items || []);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Sync with API
  useEffect(() => {
    let mounted = true;
    fetch("/api/homepage-media")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (mounted && data.success && data.data?.instagram?.items) {
          const fetchedItems = data.data.instagram.items;
          if (Array.isArray(fetchedItems)) {
            setItems(fetchedItems);
          }
        }
      })
      .catch((_err) => {
        // Fallback active
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeItems = items
    .filter((it) => it.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // If no items are configured in CMS, hide section gracefully (no fictional social content)
  if (activeItems.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -360 : 360;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleCardClick = (redirectUrl?: string) => {
    if (!redirectUrl) {
      window.open(BRAND_INSTAGRAM_URL, "_blank", "noopener,noreferrer");
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
      id="homepage-best-of-instagram"
      aria-label="Best of Instagram"
      className="py-14 sm:py-16 bg-[#FAF7F2] border-t border-[#C9B79C]/20"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section Header - Center Aligned */}
        <div className="relative mb-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase">
                Social Lookbook
              </span>
              <span className="text-xs text-stone-400 font-sans">|</span>
              <a
                href={BRAND_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-sans font-semibold text-[#1F1B16]/75 hover:text-[#B85C38] transition-colors flex items-center gap-1"
                id="insta-handle-link"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>@_saandsha</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F1B16] mt-2">
              Best of Instagram
            </h2>
            <p className="font-sans text-xs sm:text-sm text-[#1F1B16]/65 mt-2">
              Curated community moments, effortless draping, and everyday linen stories. Tag @_saandsha to be featured.
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center md:justify-end gap-2 mt-4 md:mt-0 md:absolute md:right-0 md:bottom-0">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll Instagram items left"
              id="insta-scroll-left"
              className="p-2.5 rounded-full border border-[#C9B79C]/40 bg-white hover:bg-[#1F1B16] hover:text-white text-[#1F1B16] transition-colors shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll Instagram items right"
              id="insta-scroll-right"
              className="p-2.5 rounded-full border border-[#C9B79C]/40 bg-white hover:bg-[#1F1B16] hover:text-white text-[#1F1B16] transition-colors shadow-xs cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel / Grid */}
        <div
          ref={carouselRef}
          className="flex lg:grid lg:grid-cols-4 gap-5 sm:gap-6 overflow-x-auto lg:overflow-x-visible pb-4 pt-1 snap-x scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {activeItems.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item.redirectUrl)}
                id={`insta-card-${item.id}`}
                className="w-[280px] sm:w-[320px] lg:w-auto shrink-0 snap-start bg-white rounded-lg border border-[#C9B79C]/30 overflow-hidden shadow-xs hover:shadow-md hover:border-[#B85C38]/40 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
              >
                {/* 1. Curated Social Header (Factually Accurate) */}
                <div className="p-3.5 flex items-center justify-between border-b border-[#C9B79C]/15 bg-[#FAF7F2]/60">
                  <div className="flex items-center gap-2.5">
                    {/* Brand Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[#1F1B16] text-[#FAF7F2] font-serif font-bold text-xs flex items-center justify-center border border-[#C9B79C]/40 shadow-xs">
                      K
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans font-bold text-xs text-[#1F1B16] tracking-tight">
                        _saandsha
                      </span>
                      <span className="text-[10px] font-sans text-stone-500">
                        Pure European Flax
                      </span>
                    </div>
                  </div>
                  <Instagram className="w-4 h-4 text-stone-400 group-hover:text-[#B85C38] transition-colors" />
                </div>

                {/* 2. Media Image (4:5 Aspect Ratio) */}
                <div className="relative aspect-[4/5] w-full bg-stone-100 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.altText || "Sa and Sha Editorial Look"}
                    loading="lazy"
                    className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-500"
                  />
                  {/* Subtle caption overlay on hover */}
                  {item.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none line-clamp-3">
                      {item.caption}
                    </div>
                  )}
                </div>

                {/* 3. Lookbook Clean Footer */}
                <div className="p-3.5 bg-white space-y-2 border-t border-stone-100">
                  {item.caption ? (
                    <p className="text-xs font-sans text-stone-700 line-clamp-2 leading-relaxed">
                      {item.caption}
                    </p>
                  ) : (
                    <p className="text-xs font-sans text-stone-500 italic">
                      Crafted in certified European flax.
                    </p>
                  )}
                  <div className="pt-1 flex items-center justify-between text-[11px] font-sans font-bold text-[#B85C38]">
                    <span className="group-hover:underline flex items-center gap-1">
                      <span>View Look</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explore All Link / Button */}
        <div className="mt-8 sm:mt-10 flex justify-center">
          <a
            href={BRAND_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            id="insta-explore-all-btn"
            className="px-8 py-3 rounded border border-[#1F1B16] text-[#1F1B16] hover:bg-[#1F1B16] hover:text-[#FAF7F2] font-sans text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>Follow @_saandsha on Instagram</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
};
