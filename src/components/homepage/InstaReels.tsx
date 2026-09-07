import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight, ExternalLink, Film } from "lucide-react";
import { ReelMediaItem, InstaReelsConfig, DEFAULT_FALLBACK_REEL_ITEMS } from "../../types/homepageMedia";
import { useNavigate } from "react-router-dom";

interface InstaReelsProps {
  initialConfig?: InstaReelsConfig;
}

export const InstaReels: React.FC<InstaReelsProps> = ({ initialConfig }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReelMediaItem[]>(
    initialConfig?.items || DEFAULT_FALLBACK_REEL_ITEMS
  );
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [loadedVideoIds, setLoadedVideoIds] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  // Sync with API
  useEffect(() => {
    let mounted = true;
    fetch("/api/homepage-media")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (mounted && data.success && data.data?.reels?.items) {
          const fetched = data.data.reels.items;
          if (Array.isArray(fetched)) {
            setItems(fetched);
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
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // IntersectionObserver to attach lazy video sources when approaching viewport and pause when offscreen
  useEffect(() => {
    if (!carouselRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute("data-reel-id");
          if (!reelId) return;
          const video = videoRefs.current[reelId];

          if (entry.isIntersecting) {
            // Lazy load video src when card approaches viewport
            setLoadedVideoIds((prev) => (prev[reelId] ? prev : { ...prev, [reelId]: true }));
          } else {
            // Pause video if scrolled offscreen
            if (video && !video.paused) {
              video.pause();
              setActivePlayingId((current) => (current === reelId ? null : current));
            }
          }
        });
      },
      { rootMargin: "150px", threshold: 0.25 }
    );

    const cards = carouselRef.current.querySelectorAll("[data-reel-id]");
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [activeItems]);

  // If no items in CMS, hide section cleanly (no fictional social content)
  if (activeItems.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const togglePlay = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Ensure video src is attached
    setLoadedVideoIds((prev) => ({ ...prev, [reelId]: true }));

    const video = videoRefs.current[reelId];
    if (!video) return;

    // Strict single-playback guarantee: pause any currently playing reel
    if (activePlayingId && activePlayingId !== reelId) {
      const prevVideo = videoRefs.current[activePlayingId];
      if (prevVideo) {
        prevVideo.pause();
      }
    }

    if (video.paused) {
      video
        .play()
        .then(() => {
          setActivePlayingId(reelId);
        })
        .catch((err) => {
          console.warn("Video playback prevented:", err);
        });
    } else {
      video.pause();
      setActivePlayingId(null);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    Object.values(videoRefs.current).forEach((v: HTMLVideoElement | null) => {
      if (v) v.muted = nextMuted;
    });
  };

  const handleRedirect = (redirectUrl?: string) => {
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
      id="homepage-insta-reels"
      aria-label="Insta Reels Showcase"
      className="py-14 sm:py-16 bg-[#F5F1E8] border-t border-[#C9B79C]/25"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section Header - Center Aligned */}
        <div className="relative mb-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase">
                Movement & Texture
              </span>
              <span className="text-xs text-stone-400 font-sans">|</span>
              <span className="text-xs font-sans font-semibold text-[#1F1B16]/75 flex items-center gap-1">
                <Film className="w-3 h-3 text-[#B85C38]" />
                Portrait Series
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F1B16] mt-2">
              Insta Reels
            </h2>
            <p className="font-sans text-xs sm:text-sm text-[#1F1B16]/65 mt-2">
              Witness the natural breathability, movement, and silhouette of certified European flax in motion.
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center md:justify-end gap-2 mt-4 md:mt-0 md:absolute md:right-0 md:bottom-0">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll Reels left"
              id="reels-scroll-left"
              className="p-2.5 rounded-full border border-[#C9B79C]/40 bg-white hover:bg-[#1F1B16] hover:text-white text-[#1F1B16] transition-colors shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll Reels right"
              id="reels-scroll-right"
              className="p-2.5 rounded-full border border-[#C9B79C]/40 bg-white hover:bg-[#1F1B16] hover:text-white text-[#1F1B16] transition-colors shadow-xs cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reels Container */}
        <div
          ref={carouselRef}
          className="flex lg:grid lg:grid-cols-5 gap-4 sm:gap-5 overflow-x-auto lg:overflow-x-visible pb-4 pt-1 snap-x scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {activeItems.map((reel) => {
            const isPlaying = activePlayingId === reel.id;
            const isSourceAttached = !!loadedVideoIds[reel.id];

            return (
              <div
                key={reel.id}
                data-reel-id={reel.id}
                id={`reel-card-${reel.id}`}
                className="w-[220px] sm:w-[240px] lg:w-auto shrink-0 snap-start relative aspect-[9/16] rounded-xl overflow-hidden bg-stone-900 shadow-md border border-[#C9B79C]/35 group cursor-pointer"
                onClick={(e) => togglePlay(reel.id, e)}
              >
                {/* Poster Image (Always visible before play or when paused) */}
                <img
                  src={reel.posterUrl}
                  alt={reel.title}
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
                    isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}
                />

                {/* Video Element: lazy loaded src, muted by default, playsInline */}
                <video
                  ref={(el) => (videoRefs.current[reel.id] = el)}
                  src={isSourceAttached ? reel.videoUrl : undefined}
                  preload="none"
                  playsInline
                  muted={isMuted}
                  loop
                  aria-label={reel.title}
                  className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
                    isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                />

                {/* Ambient Top / Bottom Gradients for Text Contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 pointer-events-none" />

                {/* Top Badge (Reel Monogram & Audio Toggle) */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 text-white text-[10px] font-sans font-bold">
                    <Film className="w-3 h-3 text-[#C9B79C]" />
                    <span>REEL</span>
                  </div>

                  {isPlaying && (
                    <button
                      onClick={toggleMute}
                      aria-label={isMuted ? "Unmute Reel" : "Mute Reel"}
                      className="p-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white/90 border border-white/20 transition-colors cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Center Play / Pause Indicator Button */}
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div
                    className={`w-12 h-12 rounded-full bg-black/40 backdrop-blur-xs border border-white/30 text-white flex items-center justify-center shadow-lg transition-all duration-300 ${
                      isPlaying
                        ? "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                        : "opacity-90 group-hover:scale-110"
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Bottom Overlay: Title, Caption & Explicit Redirect Button */}
                <div className="absolute bottom-3 inset-x-3 z-20 space-y-2 pointer-events-auto">
                  <div>
                    <h3 className="text-white font-serif text-sm font-bold line-clamp-1 drop-shadow-sm">
                      {reel.title}
                    </h3>
                    {reel.caption && (
                      <p className="text-white/80 font-sans text-[11px] line-clamp-2 mt-0.5 leading-snug drop-shadow-sm">
                        {reel.caption}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRedirect(reel.redirectUrl);
                    }}
                    id={`reel-cta-${reel.id}`}
                    className="w-full py-1.5 px-2.5 rounded bg-white/95 hover:bg-white text-[#1F1B16] font-sans text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>View Reel</span>
                    <ExternalLink className="w-2.5 h-2.5 text-[#B85C38]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
