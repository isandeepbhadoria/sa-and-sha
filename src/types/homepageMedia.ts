/**
 * Phase 10.5D.3A.16B: Homepage Media CMS Types & Defaults
 * Durable Cloud Object Storage & Media CMS data contracts
 */

export interface HeroSlideFocalPosition {
  preset?: "center" | "top" | "bottom" | "left" | "right" | "custom";
  x: number; // 0-100, default 50
  y: number; // 0-100, default 50
}

export interface HeroSlide {
  id: string;
  image: string;
  altText: string;
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
  redirectUrl?: string;
  sortOrder: number;
  enabled: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  storagePath?: string;
  focalPosition?: HeroSlideFocalPosition;
  createdAt: string;
  updatedAt: string;
}

export interface HeroSliderSettings {
  autoplay: boolean;
  slideInterval: number; // in seconds (3-10, default 5)
}

export interface HeroSliderConfig {
  settings: HeroSliderSettings;
  slides: HeroSlide[];
  updatedAt: string;
  updatedBy: string;
}

export interface InstagramMediaItem {
  id: string;
  image: string;
  altText: string;
  caption?: string;
  redirectUrl: string;
  sortOrder: number;
  enabled: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  storagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BestOfInstagramConfig {
  items: InstagramMediaItem[];
  updatedAt: string;
  updatedBy: string;
}

export interface ReelMediaItem {
  id: string;
  videoUrl: string;
  posterUrl: string;
  title: string;
  caption?: string;
  redirectUrl: string;
  sortOrder: number;
  enabled: boolean;
  width?: number;
  height?: number;
  videoDuration?: number;
  fileSize?: number;
  videoStoragePath?: string;
  posterStoragePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstaReelsConfig {
  items: ReelMediaItem[];
  updatedAt: string;
  updatedBy: string;
}

export interface HomepageMediaPayload {
  hero: HeroSliderConfig;
  instagram: BestOfInstagramConfig;
  reels: InstaReelsConfig;
}

// Public storefront payload — stripped of admin audit details, updatedBy, internal storage paths
export interface PublicHeroSliderConfig {
  settings: HeroSliderSettings;
  slides: Omit<HeroSlide, "storagePath">[];
  updatedAt: string;
}

export interface PublicBestOfInstagramConfig {
  items: Omit<InstagramMediaItem, "storagePath">[];
  updatedAt: string;
}

export interface PublicInstaReelsConfig {
  items: Omit<ReelMediaItem, "videoStoragePath" | "posterStoragePath">[];
  updatedAt: string;
}

export interface PublicHomepageMediaPayload {
  hero: PublicHeroSliderConfig;
  instagram: PublicBestOfInstagramConfig;
  reels: PublicInstaReelsConfig;
}

// Canonical resolution standards
export const HERO_CANONICAL_WIDTH = 2400;
export const HERO_CANONICAL_HEIGHT = 1000;
export const INSTAGRAM_CANONICAL_WIDTH = 1080;
export const INSTAGRAM_CANONICAL_HEIGHT = 1350;
export const REEL_POSTER_CANONICAL_WIDTH = 1080;
export const REEL_POSTER_CANONICAL_HEIGHT = 1920;
export const REEL_RECOMMENDED_WIDTH = 1080;
export const REEL_RECOMMENDED_HEIGHT = 1920;

export const BRAND_INSTAGRAM_URL = "https://www.instagram.com/_saandsha";

export const DEFAULT_HERO_SLIDER_SETTINGS: HeroSliderSettings = {
  autoplay: true,
  slideInterval: 5,
};

// Curated default migration fallbacks ensuring the homepage hero NEVER breaks if CMS is empty
export const DEFAULT_FALLBACK_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-default-1",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=2400&q=80",
    altText: "Sa and Sha ladies apparel collection",
    heading: "Effortless Elegance, Everyday",
    subheading: "New Collection",
    ctaLabel: "Shop Now",
    redirectUrl: "/shop/all",
    sortOrder: 1,
    enabled: true,
    width: 2400,
    height: 1000,
    focalPosition: { preset: "center", x: 50, y: 50 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "hero-default-2",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=2400&q=80",
    altText: "Sa and Sha trousers and layering pieces",
    heading: "Comfort Meets Style",
    subheading: "New Arrivals",
    ctaLabel: "Explore Trousers",
    redirectUrl: "/shop/product/trousers",
    sortOrder: 2,
    enabled: true,
    width: 2400,
    height: 1000,
    focalPosition: { preset: "center", x: 50, y: 50 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

// Fallback items: empty by default so absent CMS data cleanly hides social sections rather than displaying fictional counts
export const DEFAULT_FALLBACK_INSTAGRAM_ITEMS: InstagramMediaItem[] = [];
export const DEFAULT_FALLBACK_REEL_ITEMS: ReelMediaItem[] = [];
