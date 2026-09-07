import React, { useState, useEffect } from "react";
import {
  Sliders,
  Image as ImageIcon,
  Instagram,
  Film,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import {
  HeroSlide,
  HeroSliderConfig,
  InstagramMediaItem,
  BestOfInstagramConfig,
  ReelMediaItem,
  InstaReelsConfig,
  HomepageMediaPayload,
  HERO_CANONICAL_WIDTH,
  HERO_CANONICAL_HEIGHT,
  INSTAGRAM_CANONICAL_WIDTH,
  INSTAGRAM_CANONICAL_HEIGHT,
  DEFAULT_FALLBACK_HERO_SLIDES,
  DEFAULT_HERO_SLIDER_SETTINGS,
  DEFAULT_FALLBACK_INSTAGRAM_ITEMS,
  DEFAULT_FALLBACK_REEL_ITEMS
} from "../../types/homepageMedia";
import { auth } from "../../lib/firebase";

interface HomepageMediaAdminProps {
  getAdminAuthToken?: (forceRefresh?: boolean) => Promise<string | null>;
}

export const HomepageMediaAdmin: React.FC<HomepageMediaAdminProps> = ({ getAdminAuthToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<"hero" | "instagram" | "reels">("hero");

  // State
  const [heroConfig, setHeroConfig] = useState<HeroSliderConfig>({
    settings: DEFAULT_HERO_SLIDER_SETTINGS,
    slides: DEFAULT_FALLBACK_HERO_SLIDES,
    updatedAt: new Date().toISOString(),
    updatedBy: "system"
  });

  const [instagramConfig, setInstagramConfig] = useState<BestOfInstagramConfig>({
    items: DEFAULT_FALLBACK_INSTAGRAM_ITEMS,
    updatedAt: new Date().toISOString(),
    updatedBy: "system"
  });

  const [reelsConfig, setReelsConfig] = useState<InstaReelsConfig>({
    items: DEFAULT_FALLBACK_REEL_ITEMS,
    updatedAt: new Date().toISOString(),
    updatedBy: "system"
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const getToken = async (): Promise<string | null> => {
    if (getAdminAuthToken) {
      const t = await getAdminAuthToken();
      if (t) return t;
    }
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const token = await getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // Load existing media CMS configs
  const loadMediaConfig = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/homepage-media", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load media configs (${res.status})`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        const payload: HomepageMediaPayload = data.data;
        if (payload.hero) setHeroConfig(payload.hero);
        if (payload.instagram) setInstagramConfig(payload.instagram);
        if (payload.reels) setReelsConfig(payload.reels);
      }
    } catch (err: any) {
      console.warn("Could not fetch admin media config, using defaults:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMediaConfig();
  }, []);

  // Show temporary feedback toast
  const notify = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  // ---------------------------------------------------------------------------
  // CLIENT-SIDE IMAGE VALIDATION & UPLOADS
  // ---------------------------------------------------------------------------

  const handleFileUpload = async (
    file: File,
    targetSection: "hero" | "instagram" | "reel_video" | "reel_poster",
    slideOrItemId: string,
    onSuccess: (url: string, width?: number, height?: number, size?: number, storagePath?: string) => void
  ) => {
    setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: "" }));

    // 1. File size check
    const maxBytes = targetSection === "reel_video" ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      const limitMb = targetSection === "reel_video" ? 25 : 5;
      const err = `File exceeds ${limitMb}MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
      setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
      notify("error", err);
      return;
    }

    // 2. Client-side dimension validation for images
    if (targetSection === "hero" || targetSection === "instagram" || targetSection === "reel_poster") {
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(file.type)) {
        const err = "Invalid image format. Only JPG, PNG, and WEBP are supported.";
        setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
        notify("error", err);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);

        if (targetSection === "hero") {
          if (width !== HERO_CANONICAL_WIDTH || height !== HERO_CANONICAL_HEIGHT) {
            const err = `Hero images must be 2400 × 1000 px. Your image is ${width} × ${height}px.`;
            setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
            notify("error", err);
            return;
          }
        } else if (targetSection === "instagram") {
          const ratio = width / height;
          const expectedRatio = INSTAGRAM_CANONICAL_WIDTH / INSTAGRAM_CANONICAL_HEIGHT; // 0.8
          if (Math.abs(ratio - expectedRatio) > 0.05 && !(width === 1080 && height === 1350)) {
            const err = `Instagram images must be 1080 × 1350 px (4:5 ratio). Your image is ${width} × ${height}px.`;
            setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
            notify("error", err);
            return;
          }
        }

        // Send to server upload endpoint
        await uploadFileToServer(file, targetSection, slideOrItemId, width, height, onSuccess);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const err = "Failed to load image for validation. File might be corrupted.";
        setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
        notify("error", err);
      };

      img.src = objectUrl;
    } else {
      // Reel Video
      const allowedVideoMimes = ["video/mp4", "video/webm"];
      if (!allowedVideoMimes.includes(file.type)) {
        const err = "Invalid video format. Only MP4 and WebM videos are supported.";
        setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
        notify("error", err);
        return;
      }

      await uploadFileToServer(file, targetSection, slideOrItemId, 1080, 1920, onSuccess);
    }
  };

  const uploadFileToServer = async (
    file: File,
    targetSection: string,
    slideOrItemId: string,
    width: number | undefined,
    height: number | undefined,
    onSuccess: (url: string, width?: number, height?: number, size?: number, storagePath?: string) => void
  ) => {
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetSection", targetSection);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/admin/homepage-media/upload", {
        method: "POST",
        headers,
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const err = data.error || "Upload failed.";
        setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: err }));
        notify("error", err);
        return;
      }

      onSuccess(
        data.url,
        data.dimensions?.width || width,
        data.dimensions?.height || height,
        data.fileSize || file.size,
        data.storagePath
      );
      notify("success", "Media uploaded and saved to Cloud Storage successfully.");
    } catch (err: any) {
      const errMessage = err.message || "Failed to process upload.";
      setUploadErrors((prev) => ({ ...prev, [slideOrItemId]: errMessage }));
      notify("error", errMessage);
    }
  };

  // ---------------------------------------------------------------------------
  // SAVE HANDLERS
  // ---------------------------------------------------------------------------

  const saveHero = async () => {
    if (heroConfig.slides.length < 1 || heroConfig.slides.length > 5) {
      notify("error", "Hero slider must contain between 1 and 5 slides.");
      return;
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/homepage-media/hero", {
        method: "PUT",
        headers,
        body: JSON.stringify(heroConfig)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save hero slider.");
      }
      setHeroConfig(data.data);
      notify("success", "Hero slider updated and published to storefront.");
    } catch (err: any) {
      notify("error", err.message || "Error saving hero slider.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveInstagram = async () => {
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/homepage-media/instagram", {
        method: "PUT",
        headers,
        body: JSON.stringify(instagramConfig)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save Instagram configuration.");
      }
      setInstagramConfig(data.data);
      notify("success", "Best of Instagram section updated successfully.");
    } catch (err: any) {
      notify("error", err.message || "Error saving Instagram configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveReels = async () => {
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/homepage-media/reels", {
        method: "PUT",
        headers,
        body: JSON.stringify(reelsConfig)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save Reels configuration.");
      }
      setReelsConfig(data.data);
      notify("success", "Insta Reels section updated successfully.");
    } catch (err: any) {
      notify("error", err.message || "Error saving Reels configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="admin-homepage-media-cms">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans font-bold tracking-[0.2em] text-[#B85C38] uppercase">
              Storefront CMS
            </span>
            <span className="text-xs text-stone-300">|</span>
            <span className="text-xs text-stone-500 font-sans">
              Admin Media Manager
            </span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#1F1B16] mt-1">
            Homepage Media CMS
          </h2>
          <p className="text-xs text-stone-600 font-sans mt-1 max-w-2xl">
            Control the canonical 2400 × 1000 Hero Carousel, 4:5 social cards in Best of Instagram, and 9:16 portrait video reels.
          </p>
        </div>

        <button
          onClick={loadMediaConfig}
          disabled={isLoading}
          className="px-4 py-2 border border-stone-300 rounded text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Reload CMS</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 text-xs font-sans border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Subsection Tab Switcher */}
      <div className="flex border-b border-stone-200 bg-white rounded-t-lg px-4 pt-2 gap-2" id="media-cms-subtabs">
        <button
          onClick={() => setActiveSubTab("hero")}
          id="media-subtab-hero"
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "hero"
              ? "border-[#B85C38] text-[#B85C38]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Hero Slider ({heroConfig.slides.length}/5)</span>
        </button>

        <button
          onClick={() => setActiveSubTab("instagram")}
          id="media-subtab-instagram"
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "instagram"
              ? "border-[#B85C38] text-[#B85C38]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Instagram className="w-4 h-4" />
          <span>Best of Instagram ({instagramConfig.items.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("reels")}
          id="media-subtab-reels"
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "reels"
              ? "border-[#B85C38] text-[#B85C38]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Insta Reels ({reelsConfig.items.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. HERO SLIDER SUBSECTION */}
      {/* ==================================================================== */}
      {activeSubTab === "hero" && (
        <div className="space-y-6">
          {/* Slider Global Settings Card */}
          <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1F1B16] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#B85C38]" />
              <span>Hero Carousel Configuration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {/* Autoplay Toggle */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded border border-stone-200">
                <div>
                  <span className="font-sans text-xs font-bold text-[#1F1B16] block">
                    Automatic Slide Transition
                  </span>
                  <span className="text-[11px] font-sans text-stone-500">
                    Cycle slides automatically when 2+ slides exist
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={heroConfig.settings.autoplay}
                  onChange={(e) =>
                    setHeroConfig((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, autoplay: e.target.checked }
                    }))
                  }
                  id="hero-autoplay-toggle"
                  className="w-5 h-5 accent-[#B85C38] cursor-pointer"
                />
              </div>

              {/* Interval Slider */}
              <div className="p-4 bg-stone-50 rounded border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-xs font-bold text-[#1F1B16]">
                    Transition Interval
                  </span>
                  <span className="text-xs font-bold text-[#B85C38]">
                    {heroConfig.settings.slideInterval}s
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={heroConfig.settings.slideInterval}
                  onChange={(e) =>
                    setHeroConfig((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, slideInterval: Number(e.target.value) }
                    }))
                  }
                  id="hero-interval-slider"
                  className="w-full accent-[#B85C38] cursor-pointer"
                />
                <span className="text-[10px] text-stone-500 block">
                  Allowed range: 3 to 10 seconds (default: 5s)
                </span>
              </div>

              {/* Dimension Specification Badge */}
              <div className="p-4 bg-[#FAF7F2] rounded border border-[#C9B79C]/40 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-[#B85C38] uppercase tracking-wider">
                  Canonical Desktop Specification
                </span>
                <span className="text-sm font-bold text-[#1F1B16] mt-0.5">
                  2400 × 1000 pixels (12:5 Aspect Ratio)
                </span>
                <span className="text-[11px] text-stone-600 mt-1">
                  Supported formats: JPG, PNG, WEBP (Max 5MB)
                </span>
              </div>
            </div>
          </div>

          {/* Slides List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-[#1F1B16]">
                Hero Slides ({heroConfig.slides.length} of 5)
              </h3>

              <button
                onClick={() => {
                  if (heroConfig.slides.length >= 5) {
                    notify("error", "Maximum of 5 hero slides allowed.");
                    return;
                  }
                  const newSlide: HeroSlide = {
                    id: `hero_slide_${Date.now()}`,
                    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=2400&q=80",
                    altText: "Artisanal Pure Linen Collection",
                    heading: "New Editorial Collection",
                    subheading: "Artisanal European Flax",
                    ctaLabel: "Shop The Look",
                    redirectUrl: "/shop/shirts",
                    sortOrder: heroConfig.slides.length + 1,
                    enabled: true,
                    width: 2400,
                    height: 1000,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  setHeroConfig((prev) => ({
                    ...prev,
                    slides: [...prev.slides, newSlide]
                  }));
                }}
                disabled={heroConfig.slides.length >= 5}
                id="hero-add-slide-btn"
                className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                  heroConfig.slides.length >= 5
                    ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                    : "bg-[#1F1B16] hover:bg-[#B85C38] text-white cursor-pointer transition-colors shadow-xs"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add Slide</span>
              </button>
            </div>

            {heroConfig.slides.map((slide, index) => {
              const error = uploadErrors[slide.id];
              const isCanonical =
                slide.width === HERO_CANONICAL_WIDTH && slide.height === HERO_CANONICAL_HEIGHT;

              return (
                <div
                  key={slide.id}
                  id={`hero-admin-slide-card-${index}`}
                  className="bg-white rounded-lg border border-stone-200 p-5 shadow-xs space-y-4"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-sans font-bold text-sm text-[#1F1B16]">
                        {slide.heading || `Slide #${index + 1}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          slide.enabled
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {slide.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>

                    {/* Controls: Reorder & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (index === 0) return;
                          const newSlides = [...heroConfig.slides];
                          const temp = newSlides[index - 1];
                          newSlides[index - 1] = newSlides[index];
                          newSlides[index] = temp;
                          setHeroConfig((prev) => ({ ...prev, slides: newSlides }));
                        }}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1.5 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (index === heroConfig.slides.length - 1) return;
                          const newSlides = [...heroConfig.slides];
                          const temp = newSlides[index + 1];
                          newSlides[index + 1] = newSlides[index];
                          newSlides[index] = temp;
                          setHeroConfig((prev) => ({ ...prev, slides: newSlides }));
                        }}
                        disabled={index === heroConfig.slides.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (heroConfig.slides.length <= 1) {
                            notify("error", "The hero carousel must have at least 1 slide.");
                            return;
                          }
                          setHeroConfig((prev) => ({
                            ...prev,
                            slides: prev.slides.filter((_, i) => i !== index)
                          }));
                        }}
                        title="Delete Slide"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Error display if upload failed */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Preview thumbnail with dimensions & interactive focal position picker */}
                    <div className="lg:col-span-5 space-y-2.5">
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                          const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
                          setHeroConfig((prev) => ({
                            ...prev,
                            slides: prev.slides.map((s, i) =>
                              i === index ? { ...s, focalPosition: { x, y } } : s
                            )
                          }));
                        }}
                        title="Click anywhere to reposition subject focal point"
                        className="relative aspect-[12/5] w-full rounded overflow-hidden bg-stone-900 border border-stone-300 shadow-xs cursor-crosshair group"
                      >
                        <img
                          src={slide.image}
                          alt={slide.altText || "Preview"}
                          style={{
                            objectPosition: `${slide.focalPosition?.x ?? 50}% ${slide.focalPosition?.y ?? 50}%`
                          }}
                          className="w-full h-full object-cover transition-all"
                        />
                        {/* Focal Point Reticle Pin */}
                        <div
                          style={{
                            left: `${slide.focalPosition?.x ?? 50}%`,
                            top: `${slide.focalPosition?.y ?? 50}%`
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center"
                        >
                          <div className="w-5 h-5 rounded-full border-2 border-white bg-[#B85C38]/80 shadow-md flex items-center justify-center animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        </div>

                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] text-white font-mono pointer-events-none">
                          {slide.width && slide.height
                            ? `${slide.width} × ${slide.height} px`
                            : "2400 × 1000 px"}
                        </div>

                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] text-white/90 font-mono pointer-events-none">
                          Focal: {slide.focalPosition?.x ?? 50}%, {slide.focalPosition?.y ?? 50}%
                        </div>
                      </div>

                      {/* Focal point quick alignment presets */}
                      <div className="p-2 rounded bg-stone-50 border border-stone-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-stone-600 font-bold uppercase tracking-wider">
                          <span>Subject Focal Point</span>
                          <span className="text-stone-400 font-normal lowercase">(click image or preset)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setHeroConfig((prev) => ({
                                ...prev,
                                slides: prev.slides.map((s, i) =>
                                  i === index ? { ...s, focalPosition: { x: 50, y: 20 } } : s
                                )
                              }));
                            }}
                            className={`py-1 px-1.5 rounded text-[11px] font-medium border text-center transition-colors cursor-pointer ${
                              (slide.focalPosition?.y ?? 50) <= 30
                                ? "bg-[#B85C38] text-white border-[#B85C38]"
                                : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            Top (Face/Head)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHeroConfig((prev) => ({
                                ...prev,
                                slides: prev.slides.map((s, i) =>
                                  i === index ? { ...s, focalPosition: { x: 50, y: 50 } } : s
                                )
                              }));
                            }}
                            className={`py-1 px-1.5 rounded text-[11px] font-medium border text-center transition-colors cursor-pointer ${
                              (slide.focalPosition?.y ?? 50) > 30 && (slide.focalPosition?.y ?? 50) < 70
                                ? "bg-[#B85C38] text-white border-[#B85C38]"
                                : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            Center (Default)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHeroConfig((prev) => ({
                                ...prev,
                                slides: prev.slides.map((s, i) =>
                                  i === index ? { ...s, focalPosition: { x: 50, y: 80 } } : s
                                )
                              }));
                            }}
                            className={`py-1 px-1.5 rounded text-[11px] font-medium border text-center transition-colors cursor-pointer ${
                              (slide.focalPosition?.y ?? 50) >= 70
                                ? "bg-[#B85C38] text-white border-[#B85C38]"
                                : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            Bottom (Full Look)
                          </button>
                        </div>
                      </div>

                      {/* Dimension verification badge */}
                      <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-stone-50 border border-stone-200">
                        <span className="text-stone-600 font-medium">
                          Required: 2400 × 1000
                        </span>
                        <span
                          className={`font-bold ${
                            isCanonical ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          Actual: {slide.width || 2400} × {slide.height || 1000}
                        </span>
                      </div>

                      {/* File Upload Button */}
                      <div>
                        <label className="w-full py-2 px-3 border border-dashed border-stone-300 hover:border-[#B85C38] rounded text-xs font-bold text-stone-700 hover:text-[#B85C38] bg-stone-50 hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-2 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload 2400 × 1000 Image</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(
                                  e.target.files[0],
                                  "hero",
                                  slide.id,
                                  (newUrl, w, h, size, sPath) => {
                                    setHeroConfig((prev) => ({
                                      ...prev,
                                      slides: prev.slides.map((s, i) =>
                                        i === index
                                          ? {
                                              ...s,
                                              image: newUrl,
                                              storagePath: sPath || s.storagePath,
                                              width: w || 2400,
                                              height: h || 1000,
                                              fileSize: size
                                            }
                                          : s
                                      )
                                    }));
                                  }
                                );
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Right: Slide Form Fields */}
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Image URL */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Image URL *
                        </label>
                        <input
                          type="text"
                          value={slide.image}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, image: val } : s
                              )
                            }));
                          }}
                          placeholder="https://images.unsplash.com/... or /uploads/..."
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* Alt Text (Required) */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Alt Text (Accessibility) *
                        </label>
                        <input
                          type="text"
                          value={slide.altText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, altText: val } : s
                              )
                            }));
                          }}
                          placeholder="Describe the image content..."
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* Heading */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Editorial Heading
                        </label>
                        <input
                          type="text"
                          value={slide.heading || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, heading: val } : s
                              )
                            }));
                          }}
                          placeholder="e.g. Summer Solace in Pure Linen"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* Subheading */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Subheading
                        </label>
                        <input
                          type="text"
                          value={slide.subheading || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, subheading: val } : s
                              )
                            }));
                          }}
                          placeholder="e.g. Artisanal European Flax"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* CTA Label */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          CTA Label
                        </label>
                        <input
                          type="text"
                          value={slide.ctaLabel || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, ctaLabel: val } : s
                              )
                            }));
                          }}
                          placeholder="e.g. Shop Shirts"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* Redirect URL */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Redirect URL
                        </label>
                        <input
                          type="text"
                          value={slide.redirectUrl || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, redirectUrl: val } : s
                              )
                            }));
                          }}
                          placeholder="e.g. /shop/shirts"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-[#B85C38] focus:border-[#B85C38]"
                        />
                      </div>

                      {/* Enabled Toggle */}
                      <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={slide.enabled !== false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setHeroConfig((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) =>
                                i === index ? { ...s, enabled: checked } : s
                              )
                            }));
                          }}
                          id={`hero-slide-enabled-${index}`}
                          className="w-4 h-4 accent-[#B85C38] cursor-pointer"
                        />
                        <label
                          htmlFor={`hero-slide-enabled-${index}`}
                          className="text-xs font-bold text-stone-700 cursor-pointer"
                        >
                          Enable this slide on homepage
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Hero Slider Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={saveHero}
              disabled={isSaving}
              id="hero-save-btn"
              className="px-6 py-3 rounded bg-[#B85C38] hover:bg-[#A04E2E] text-white font-sans text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Hero Slider Changes"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. BEST OF INSTAGRAM SUBSECTION */}
      {/* ==================================================================== */}
      {activeSubTab === "instagram" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1F1B16]">
                Best of Instagram Feed ({instagramConfig.items.length} items)
              </h3>
              <p className="text-xs text-stone-600 font-sans mt-0.5">
                Standard format: 1080 × 1350 px (4:5 social ratio). Supports 4 to 12 curated items.
              </p>
            </div>

            <button
              onClick={() => {
                const newItem: InstagramMediaItem = {
                  id: `insta_item_${Date.now()}`,
                  image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&q=80",
                  altText: "Customer styled in pure linen shirt",
                  caption: "Relaxed European flax tailored for tropical warmth. @saandsha",
                  redirectUrl: "/shop/shirts",
                  sortOrder: instagramConfig.items.length + 1,
                  enabled: true,
                  width: 1080,
                  height: 1350,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setInstagramConfig((prev) => ({
                  ...prev,
                  items: [...prev.items, newItem]
                }));
              }}
              id="insta-add-item-btn"
              className="px-4 py-2 rounded bg-[#1F1B16] hover:bg-[#B85C38] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Social Card</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {instagramConfig.items.map((item, index) => {
              const error = uploadErrors[item.id];
              return (
                <div
                  key={item.id}
                  id={`insta-admin-card-${index}`}
                  className="bg-white rounded-lg border border-stone-200 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <span className="font-sans font-bold text-xs text-[#1F1B16]">
                      Item #{index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (index === 0) return;
                          const newItems = [...instagramConfig.items];
                          const temp = newItems[index - 1];
                          newItems[index - 1] = newItems[index];
                          newItems[index] = temp;
                          setInstagramConfig((prev) => ({ ...prev, items: newItems }));
                        }}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (index === instagramConfig.items.length - 1) return;
                          const newItems = [...instagramConfig.items];
                          const temp = newItems[index + 1];
                          newItems[index + 1] = newItems[index];
                          newItems[index] = temp;
                          setInstagramConfig((prev) => ({ ...prev, items: newItems }));
                        }}
                        disabled={index === instagramConfig.items.length - 1}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setInstagramConfig((prev) => ({
                            ...prev,
                            items: prev.items.filter((_, i) => i !== index)
                          }));
                        }}
                        className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-3">
                    {/* Thumbnail & File Upload */}
                    <div className="col-span-4 space-y-2">
                      <div className="aspect-[4/5] w-full rounded overflow-hidden bg-stone-100 border border-stone-200">
                        <img
                          src={item.image}
                          alt={item.altText || "Preview"}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="text-[10px] text-center text-stone-600 font-mono">
                        {item.width && item.height
                          ? `${item.width} × ${item.height}`
                          : "1080 × 1350"}
                      </div>
                      <label className="w-full py-1.5 px-2 border border-dashed border-stone-300 hover:border-[#B85C38] rounded text-[10px] font-bold text-stone-700 bg-stone-50 hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload 4:5</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(
                                e.target.files[0],
                                "instagram",
                                item.id,
                                (newUrl, w, h, size, sPath) => {
                                  setInstagramConfig((prev) => ({
                                    ...prev,
                                    items: prev.items.map((it, i) =>
                                      i === index
                                        ? {
                                            ...it,
                                            image: newUrl,
                                            storagePath: sPath || it.storagePath,
                                            width: w || 1080,
                                            height: h || 1350,
                                            fileSize: size
                                          }
                                        : it
                                    )
                                  }));
                                }
                              );
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Fields */}
                    <div className="col-span-8 space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Image URL *
                        </label>
                        <input
                          type="text"
                          value={item.image}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInstagramConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === index ? { ...it, image: val } : it
                              )
                            }));
                          }}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Alt Text *
                        </label>
                        <input
                          type="text"
                          value={item.altText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInstagramConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === index ? { ...it, altText: val } : it
                              )
                            }));
                          }}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Redirect URL (Link) *
                        </label>
                        <input
                          type="text"
                          value={item.redirectUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInstagramConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === index ? { ...it, redirectUrl: val } : it
                              )
                            }));
                          }}
                          placeholder="/shop/shirts or https://instagram.com/..."
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Caption & Hashtags
                        </label>
                        <input
                          type="text"
                          value={item.caption || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInstagramConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === index ? { ...it, caption: val } : it
                              )
                            }));
                          }}
                          placeholder="e.g. Classic linen tailoring. @saandsha"
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setInstagramConfig((prev) => ({
                                ...prev,
                                items: prev.items.map((it, i) =>
                                  i === index ? { ...it, enabled: checked } : it
                                )
                              }));
                            }}
                            className="w-3.5 h-3.5 accent-[#B85C38]"
                          />
                          <span>Active</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={saveInstagram}
              disabled={isSaving}
              id="insta-save-btn"
              className="px-6 py-3 rounded bg-[#B85C38] hover:bg-[#A04E2E] text-white font-sans text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Instagram Changes"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. INSTA REELS SUBSECTION */}
      {/* ==================================================================== */}
      {activeSubTab === "reels" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1F1B16]">
                Insta Reels Showcase ({reelsConfig.items.length} reels)
              </h3>
              <p className="text-xs text-stone-600 font-sans mt-0.5">
                Portrait 9:16 video cards (recommended 1080 × 1920). Preload optimized with poster thumbnails.
              </p>
            </div>

            <button
              onClick={() => {
                const newReel: ReelMediaItem = {
                  id: `reel_item_${Date.now()}`,
                  videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                  posterUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&q=80",
                  title: "Linen in Motion: The Pure Linen Shirt",
                  caption: "Unmatched tropical breathability engineered into every stitch.",
                  redirectUrl: "/shop/shirts",
                  sortOrder: reelsConfig.items.length + 1,
                  enabled: true,
                  width: 1080,
                  height: 1920,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setReelsConfig((prev) => ({
                  ...prev,
                  items: [...prev.items, newReel]
                }));
              }}
              id="reels-add-item-btn"
              className="px-4 py-2 rounded bg-[#1F1B16] hover:bg-[#B85C38] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Portrait Reel</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reelsConfig.items.map((reel, index) => {
              const error = uploadErrors[reel.id];
              return (
                <div
                  key={reel.id}
                  id={`reel-admin-card-${index}`}
                  className="bg-white rounded-lg border border-stone-200 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <span className="font-sans font-bold text-xs text-[#1F1B16]">
                      Reel #{index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (index === 0) return;
                          const newReels = [...reelsConfig.items];
                          const temp = newReels[index - 1];
                          newReels[index - 1] = newReels[index];
                          newReels[index] = temp;
                          setReelsConfig((prev) => ({ ...prev, items: newReels }));
                        }}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (index === reelsConfig.items.length - 1) return;
                          const newReels = [...reelsConfig.items];
                          const temp = newReels[index + 1];
                          newReels[index + 1] = newReels[index];
                          newReels[index] = temp;
                          setReelsConfig((prev) => ({ ...prev, items: newReels }));
                        }}
                        disabled={index === reelsConfig.items.length - 1}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setReelsConfig((prev) => ({
                            ...prev,
                            items: prev.items.filter((_, i) => i !== index)
                          }));
                        }}
                        className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-3">
                    {/* Video/Poster Preview */}
                    <div className="col-span-5 space-y-2">
                      <div className="aspect-[9/16] w-full rounded overflow-hidden bg-stone-900 border border-stone-200 relative">
                        <img
                          src={reel.posterUrl}
                          alt={reel.title}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Film className="w-6 h-6 text-white/80" />
                        </div>
                      </div>

                      {/* Poster Upload */}
                      <label className="w-full py-1.5 px-2 border border-dashed border-stone-300 hover:border-[#B85C38] rounded text-[10px] font-bold text-stone-700 bg-stone-50 hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-1 cursor-pointer text-center">
                        <Upload className="w-3 h-3" />
                        <span>Poster (Img)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(
                                e.target.files[0],
                                "reel_poster",
                                reel.id,
                                (newUrl, _w, _h, _size, sPath) => {
                                  setReelsConfig((prev) => ({
                                    ...prev,
                                    items: prev.items.map((r, i) =>
                                      i === index
                                        ? { ...r, posterUrl: newUrl, posterStoragePath: sPath || r.posterStoragePath }
                                        : r
                                    )
                                  }));
                                }
                              );
                            }
                          }}
                        />
                      </label>

                      {/* Video File Upload */}
                      <label className="w-full py-1.5 px-2 border border-dashed border-stone-300 hover:border-[#B85C38] rounded text-[10px] font-bold text-[#B85C38] bg-stone-50 hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-1 cursor-pointer text-center">
                        <Upload className="w-3 h-3" />
                        <span>Video (MP4)</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(
                                e.target.files[0],
                                "reel_video",
                                reel.id,
                                (newUrl, _w, _h, size, sPath) => {
                                  setReelsConfig((prev) => ({
                                    ...prev,
                                    items: prev.items.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            videoUrl: newUrl,
                                            videoStoragePath: sPath || r.videoStoragePath,
                                            fileSize: size
                                          }
                                        : r
                                    )
                                  }));
                                }
                              );
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Fields */}
                    <div className="col-span-7 space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Video URL *
                        </label>
                        <input
                          type="text"
                          value={reel.videoUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReelsConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((r, i) =>
                                i === index ? { ...r, videoUrl: val } : r
                              )
                            }));
                          }}
                          placeholder="https://...mp4"
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Poster URL *
                        </label>
                        <input
                          type="text"
                          value={reel.posterUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReelsConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((r, i) =>
                                i === index ? { ...r, posterUrl: val } : r
                              )
                            }));
                          }}
                          placeholder="https://...jpg"
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Reel Title *
                        </label>
                        <input
                          type="text"
                          value={reel.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReelsConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((r, i) =>
                                i === index ? { ...r, title: val } : r
                              )
                            }));
                          }}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Caption
                        </label>
                        <input
                          type="text"
                          value={reel.caption || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReelsConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((r, i) =>
                                i === index ? { ...r, caption: val } : r
                              )
                            }));
                          }}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase">
                          Redirect URL
                        </label>
                        <input
                          type="text"
                          value={reel.redirectUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReelsConfig((prev) => ({
                              ...prev,
                              items: prev.items.map((r, i) =>
                                i === index ? { ...r, redirectUrl: val } : r
                              )
                            }));
                          }}
                          placeholder="/shop/shirts"
                          className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                        />
                      </div>

                      <div className="pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reel.enabled !== false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setReelsConfig((prev) => ({
                                ...prev,
                                items: prev.items.map((r, i) =>
                                  i === index ? { ...r, enabled: checked } : r
                                )
                              }));
                            }}
                            className="w-3.5 h-3.5 accent-[#B85C38]"
                          />
                          <span>Active on Storefront</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={saveReels}
              disabled={isSaving}
              id="reels-save-btn"
              className="px-6 py-3 rounded bg-[#B85C38] hover:bg-[#A04E2E] text-white font-sans text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Reels Changes"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
