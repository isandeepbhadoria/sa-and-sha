/**
 * Phase 10.5D.3A.16B: Homepage Media CMS Backend Helpers
 * Validation, security guards, dimensions parsing, durable cloud storage, and Firestore persistence
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAdminStorageBucket } from "./firebaseAdmin";
import {
  HeroSlide,
  HeroSliderConfig,
  InstagramMediaItem,
  BestOfInstagramConfig,
  ReelMediaItem,
  InstaReelsConfig,
  HomepageMediaPayload,
  PublicHomepageMediaPayload,
  HERO_CANONICAL_WIDTH,
  HERO_CANONICAL_HEIGHT,
  INSTAGRAM_CANONICAL_WIDTH,
  INSTAGRAM_CANONICAL_HEIGHT,
  REEL_POSTER_CANONICAL_WIDTH,
  REEL_POSTER_CANONICAL_HEIGHT,
  DEFAULT_FALLBACK_HERO_SLIDES,
  DEFAULT_HERO_SLIDER_SETTINGS,
  DEFAULT_FALLBACK_INSTAGRAM_ITEMS,
  DEFAULT_FALLBACK_REEL_ITEMS
} from "../types/homepageMedia";

/**
 * Sanitizes redirect URLs to prevent XSS and malicious protocols.
 * Allows safe relative paths (e.g. /shop/shirts) and external http/https URLs.
 * Rejects javascript:, data:, vbscript:, etc.
 */
export function sanitizeRedirectUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Relative links within app
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  // Safe external protocols
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // If not a valid URL or relative path, reject
    return "";
  }

  return "";
}

/**
 * Strict validation of hero slide resolution and fields.
 * Canonical: 2400 × 1000 px.
 */
export function validateHeroSlide(slide: Partial<HeroSlide>): { valid: boolean; error?: string } {
  if (!slide || typeof slide !== "object") {
    return { valid: false, error: "Invalid slide payload." };
  }

  if (!slide.image || typeof slide.image !== "string" || !slide.image.trim()) {
    return { valid: false, error: "Hero slide image URL is required." };
  }

  if (!slide.altText || typeof slide.altText !== "string" || !slide.altText.trim()) {
    return { valid: false, error: "Hero slide alt text is required for accessibility." };
  }

  // Exact resolution validation if dimensions are provided
  if (slide.width !== undefined && slide.height !== undefined) {
    const width = Number(slide.width);
    const height = Number(slide.height);
    if (width !== HERO_CANONICAL_WIDTH || height !== HERO_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Hero images must be 2400 × 1000 px. Your image is ${width} × ${height}px.`
      };
    }
  }

  if (slide.redirectUrl) {
    const sanitized = sanitizeRedirectUrl(slide.redirectUrl);
    if (!sanitized) {
      return { valid: false, error: "Invalid redirect URL. Only safe internal paths or http/https URLs are permitted." };
    }
  }

  // Focal position validation if provided
  if (slide.focalPosition) {
    const x = Number(slide.focalPosition.x);
    const y = Number(slide.focalPosition.y);
    if (isNaN(x) || x < 0 || x > 100 || isNaN(y) || y < 0 || y > 100) {
      return { valid: false, error: "Hero slide focal coordinates must be between 0 and 100%." };
    }
  }

  return { valid: true };
}

/**
 * Validates the full Hero Slider configuration:
 * 1 to 5 slides, interval between 3 and 10 seconds.
 */
export function validateHeroSliderConfig(config: Partial<HeroSliderConfig>): { valid: boolean; error?: string } {
  if (!config || !Array.isArray(config.slides)) {
    return { valid: false, error: "Hero slider configuration must contain a slides array." };
  }

  if (config.slides.length < 1 || config.slides.length > 5) {
    return { valid: false, error: "Hero slider must contain between 1 and 5 slides." };
  }

  const interval = Number(config.settings?.slideInterval ?? 5);
  if (isNaN(interval) || interval < 3 || interval > 10) {
    return { valid: false, error: "Slide interval must be between 3 and 10 seconds." };
  }

  for (let i = 0; i < config.slides.length; i++) {
    const check = validateHeroSlide(config.slides[i]);
    if (!check.valid) {
      return { valid: false, error: `Slide #${i + 1}: ${check.error}` };
    }
  }

  return { valid: true };
}

/**
 * Validates Instagram media item:
 * Image required, altText required.
 * Standardizes to 1080 × 1350 px (4:5 ratio).
 */
export function validateInstagramItem(item: Partial<InstagramMediaItem>): { valid: boolean; error?: string } {
  if (!item || typeof item !== "object") {
    return { valid: false, error: "Invalid Instagram item payload." };
  }

  if (!item.image || typeof item.image !== "string" || !item.image.trim()) {
    return { valid: false, error: "Instagram image URL is required." };
  }

  if (!item.altText || typeof item.altText !== "string" || !item.altText.trim()) {
    return { valid: false, error: "Alt text is required for Instagram image." };
  }

  if (item.width !== undefined && item.height !== undefined) {
    const width = Number(item.width);
    const height = Number(item.height);
    if (width !== INSTAGRAM_CANONICAL_WIDTH || height !== INSTAGRAM_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Instagram images must be 1080 × 1350 px (4:5 ratio). Your image is ${width} × ${height}px.`
      };
    }
  }

  if (item.redirectUrl) {
    const sanitized = sanitizeRedirectUrl(item.redirectUrl);
    if (!sanitized) {
      return { valid: false, error: "Invalid redirect URL. Only safe internal paths or http/https URLs are permitted." };
    }
  }

  return { valid: true };
}

/**
 * Validates Best of Instagram configuration:
 * Supports up to 12 items.
 */
export function validateInstagramConfig(config: Partial<BestOfInstagramConfig>): { valid: boolean; error?: string } {
  if (!config || !Array.isArray(config.items)) {
    return { valid: false, error: "Best of Instagram configuration must contain an items array." };
  }

  if (config.items.length > 12) {
    return { valid: false, error: "Best of Instagram configuration cannot exceed 12 items." };
  }

  for (let i = 0; i < config.items.length; i++) {
    const check = validateInstagramItem(config.items[i]);
    if (!check.valid) {
      return { valid: false, error: `Item #${i + 1}: ${check.error}` };
    }
  }

  return { valid: true };
}

/**
 * Validates Insta Reel item:
 * Video URL, poster URL, and title required.
 * Video MIME must be MP4 or WebM.
 * Poster canonical: 1080 × 1920 (9:16).
 */
export function validateReelItem(item: Partial<ReelMediaItem>): { valid: boolean; error?: string } {
  if (!item || typeof item !== "object") {
    return { valid: false, error: "Invalid Reel item payload." };
  }

  if (!item.videoUrl || typeof item.videoUrl !== "string" || !item.videoUrl.trim()) {
    return { valid: false, error: "Reel video URL is required." };
  }

  if (!item.posterUrl || typeof item.posterUrl !== "string" || !item.posterUrl.trim()) {
    return { valid: false, error: "Poster thumbnail URL is required for Reel video performance." };
  }

  if (!item.title || typeof item.title !== "string" || !item.title.trim()) {
    return { valid: false, error: "Accessible title is required for Reel video." };
  }

  if (item.width !== undefined && item.height !== undefined) {
    const width = Number(item.width);
    const height = Number(item.height);
    if (width !== REEL_POSTER_CANONICAL_WIDTH || height !== REEL_POSTER_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Reel poster images must be 1080 × 1920 px (9:16 ratio). Your image is ${width} × ${height}px.`
      };
    }
  }

  if (item.redirectUrl) {
    const sanitized = sanitizeRedirectUrl(item.redirectUrl);
    if (!sanitized) {
      return { valid: false, error: "Invalid redirect URL. Only safe internal paths or http/https URLs are permitted." };
    }
  }

  return { valid: true };
}

/**
 * Validates Insta Reels configuration.
 */
export function validateReelsConfig(config: Partial<InstaReelsConfig>): { valid: boolean; error?: string } {
  if (!config || !Array.isArray(config.items)) {
    return { valid: false, error: "Insta Reels configuration must contain an items array." };
  }

  if (config.items.length > 12) {
    return { valid: false, error: "Insta Reels configuration cannot exceed 12 items." };
  }

  for (let i = 0; i < config.items.length; i++) {
    const check = validateReelItem(config.items[i]);
    if (!check.valid) {
      return { valid: false, error: `Reel #${i + 1}: ${check.error}` };
    }
  }

  return { valid: true };
}

/**
 * Fast binary image dimension and magic bytes parser for Node.js Buffers.
 * Supports PNG, JPEG, WEBP without native C++ compilation or external dependencies.
 */
export function parseImageDimensionsFromBuffer(buffer: Buffer): { width: number; height: number; mimeType: string } | null {
  if (!buffer || buffer.length < 24) return null;

  // 1. PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height, mimeType: "image/png" };
  }

  // 2. JPEG check: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Baseline and Progressive SOF markers
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, mimeType: "image/jpeg" };
      }
      // Skip variable length markers
      if (marker !== 0xD8 && marker !== 0xD9 && marker !== 0x00) {
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        offset += 2;
      }
    }
  }

  // 3. WebP check: RIFF .... WEBP
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    const chunkHeader = buffer.slice(12, 16).toString("ascii");
    // VP8 (lossy)
    if (chunkHeader === "VP8 ") {
      const width = (buffer.readUInt16LE(26) & 0x3fff);
      const height = (buffer.readUInt16LE(28) & 0x3fff);
      return { width, height, mimeType: "image/webp" };
    }
    // VP8L (lossless)
    if (chunkHeader === "VP8L" && buffer[20] === 0x2f) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height, mimeType: "image/webp" };
    }
    // VP8X (extended)
    if (chunkHeader === "VP8X") {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, mimeType: "image/webp" };
    }
  }

  return null;
}

/**
 * Validates and inspects uploaded media buffer for type, magic bytes, dimensions, and size.
 */
export function inspectAndValidateMediaUpload(
  buffer: Buffer,
  declaredMimeType: string,
  targetSection: "hero" | "instagram" | "reel_video" | "reel_poster"
): { valid: boolean; error?: string; dimensions?: { width: number; height: number }; mimeType?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty file received." };
  }

  // File size ceilings: 5MB for images, 25MB for video
  const maxImageSize = 5 * 1024 * 1024; // 5MB
  const maxVideoSize = 25 * 1024 * 1024; // 25MB

  if (targetSection === "reel_video") {
    if (buffer.length > maxVideoSize) {
      return { valid: false, error: `Video file exceeds 25MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(1)}MB).` };
    }

    // Check video magic bytes
    const isMp4 = buffer.length >= 8 && buffer.slice(4, 8).toString("ascii") === "ftyp";
    const isWebm = buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;

    if (!isMp4 && !isWebm) {
      return { valid: false, error: "Invalid video file format. Only web-safe MP4 and WebM videos are supported." };
    }

    return {
      valid: true,
      mimeType: isMp4 ? "video/mp4" : "video/webm"
    };
  }

  // Target section is an image (hero, instagram, reel_poster)
  if (buffer.length > maxImageSize) {
    return { valid: false, error: `Image file exceeds 5MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(1)}MB).` };
  }

  const parsed = parseImageDimensionsFromBuffer(buffer);
  if (!parsed) {
    return { valid: false, error: "Invalid or corrupted image. Allowed formats: JPEG, PNG, WEBP." };
  }

  const { width, height, mimeType } = parsed;

  if (targetSection === "hero") {
    if (width !== HERO_CANONICAL_WIDTH || height !== HERO_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Hero images must be 2400 × 1000 px. Your image is ${width} × ${height}px.`
      };
    }
  } else if (targetSection === "instagram") {
    if (width !== INSTAGRAM_CANONICAL_WIDTH || height !== INSTAGRAM_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Instagram images must be 1080 × 1350 px (4:5 ratio). Your image is ${width} × ${height}px.`
      };
    }
  } else if (targetSection === "reel_poster") {
    if (width !== REEL_POSTER_CANONICAL_WIDTH || height !== REEL_POSTER_CANONICAL_HEIGHT) {
      return {
        valid: false,
        error: `Reel poster images must be 1080 × 1920 px (9:16 ratio). Your image is ${width} × ${height}px.`
      };
    }
  }

  return {
    valid: true,
    dimensions: { width, height },
    mimeType
  };
}

// ---------------------------------------------------------------------------
// CLOUD STORAGE INTEGRATION (Firebase Storage / Google Cloud Storage)
// ---------------------------------------------------------------------------

/**
 * Saves uploaded media buffer to durable Cloud Storage (your-project-id.firebasestorage.app)
 * returning the persistent download URL and storagePath.
 */
export async function saveBufferToCloudStorage(
  buffer: Buffer,
  targetSection: "hero" | "instagram" | "reel_poster" | "reel_video",
  extension: string,
  mimeType: string
): Promise<{ url: string; storagePath: string; fileSize: number }> {
  const bucket = getAdminStorageBucket();
  const folderMap: Record<string, string> = {
    hero: "homepage-media/hero",
    instagram: "homepage-media/instagram",
    reel_poster: "homepage-media/reel-posters",
    reel_video: "homepage-media/reels"
  };
  const folder = folderMap[targetSection] || "homepage-media/misc";
  const filename = `${targetSection}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const storagePath = `${folder}/${filename}`;

  const token = crypto.randomUUID();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType: mimeType,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

  return {
    url: downloadUrl,
    storagePath,
    fileSize: buffer.length
  };
}

/**
 * Creates a streaming GCS writeStream for video uploads, piping directly into Firebase Storage
 * to completely eliminate high Node.js memory consumption.
 */
export function createCloudVideoStreamWriter(
  extension: string,
  mimeType: string
): {
  file: any;
  writeStream: NodeJS.WritableStream;
  storagePath: string;
  getDownloadUrl: () => string;
} {
  const bucket = getAdminStorageBucket();
  const filename = `reel_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const storagePath = `homepage-media/reels/${filename}`;
  const token = crypto.randomUUID();

  const file = bucket.file(storagePath);
  const writeStream = file.createWriteStream({
    resumable: false,
    contentType: mimeType,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  return {
    file,
    writeStream,
    storagePath,
    getDownloadUrl: () =>
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
  };
}

/**
 * Saves uploaded media buffer with automatic cloud storage upload and safe local fallback.
 */
export async function saveUploadedMedia(
  buffer: Buffer,
  targetSection: "hero" | "instagram" | "reel_poster" | "reel_video",
  extension: string,
  mimeType: string
): Promise<{ url: string; storagePath: string; fileSize: number }> {
  try {
    return await saveBufferToCloudStorage(buffer, targetSection, extension, mimeType);
  } catch (err: any) {
    console.warn("[HOMEPAGE MEDIA] Cloud storage upload failed, falling back to local storage:", err.message);
    const localUrl = saveUploadedMediaFile(buffer, extension, targetSection);
    return {
      url: localUrl,
      storagePath: `local:${localUrl}`,
      fileSize: buffer.length
    };
  }
}

/**
 * Fallback local file saver for development/offline test runs.
 */
export function saveUploadedMediaFile(
  buffer: Buffer,
  extension: string,
  prefix: string = "media"
): string {
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "homepage-media");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${extension}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/homepage-media/${filename}`;
}

/**
 * Deletes an object from Firebase Storage if it exists.
 */
export async function deleteCloudStorageFile(storagePath: string): Promise<void> {
  if (!storagePath || storagePath.startsWith("local:") || storagePath.startsWith("http")) return;
  try {
    const bucket = getAdminStorageBucket();
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
    console.log(`[HOMEPAGE MEDIA] Cleaned up orphaned media from cloud storage: ${storagePath}`);
  } catch (err: any) {
    console.warn(`[HOMEPAGE MEDIA] Failed to delete cloud storage file (${storagePath}):`, err.message);
  }
}

/**
 * Safe cleanup of orphaned cloud files:
 * Compares previously existing storage paths against the new paths and all other active CMS documents.
 * Never deletes an object still referenced by any active CMS record.
 */
export async function cleanupOrphanedStorageMedia(
  adminDb: any,
  previousPaths: string[],
  currentPaths: string[]
): Promise<void> {
  if (!adminDb || !previousPaths.length) return;

  const candidatePaths = previousPaths.filter((p) => p && !currentPaths.includes(p));
  if (candidatePaths.length === 0) return;

  try {
    const [heroDoc, instaDoc, reelsDoc] = await Promise.all([
      adminDb.collection("homepage_media").doc("hero_slider").get(),
      adminDb.collection("homepage_media").doc("best_of_instagram").get(),
      adminDb.collection("homepage_media").doc("insta_reels").get()
    ]);

    const activePaths = new Set<string>();

    if (heroDoc.exists) {
      (heroDoc.data()?.slides || []).forEach((s: any) => {
        if (s.storagePath) activePaths.add(s.storagePath);
      });
    }
    if (instaDoc.exists) {
      (instaDoc.data()?.items || []).forEach((it: any) => {
        if (it.storagePath) activePaths.add(it.storagePath);
      });
    }
    if (reelsDoc.exists) {
      (reelsDoc.data()?.items || []).forEach((r: any) => {
        if (r.videoStoragePath) activePaths.add(r.videoStoragePath);
        if (r.posterStoragePath) activePaths.add(r.posterStoragePath);
      });
    }

    for (const path of candidatePaths) {
      if (!activePaths.has(path)) {
        await deleteCloudStorageFile(path);
      }
    }
  } catch (err: any) {
    console.warn("[HOMEPAGE MEDIA] Storage cleanup encountered an error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// FIRESTORE CMS ACCESS HELPERS
// ---------------------------------------------------------------------------

/**
 * Public storefront read helper:
 * STRICT PRIVACY: Does NOT expose updatedBy, admin email, internal storage paths, or audit metadata.
 * FALLBACK POLICY:
 * - No hero CMS data -> legacy hero fallback
 * - No Instagram CMS data -> section hidden (items: [])
 * - No Reel CMS data -> section hidden (items: [])
 */
export async function getPublicHomepageMedia(adminDb: any): Promise<PublicHomepageMediaPayload> {
  const fallbackPayload: PublicHomepageMediaPayload = {
    hero: {
      settings: DEFAULT_HERO_SLIDER_SETTINGS,
      slides: DEFAULT_FALLBACK_HERO_SLIDES.map(({ storagePath, ...s }) => s),
      updatedAt: new Date().toISOString()
    },
    instagram: {
      items: [],
      updatedAt: new Date().toISOString()
    },
    reels: {
      items: [],
      updatedAt: new Date().toISOString()
    }
  };

  if (!adminDb) return fallbackPayload;

  try {
    const heroDoc = await adminDb.collection("homepage_media").doc("hero_slider").get();
    const instaDoc = await adminDb.collection("homepage_media").doc("best_of_instagram").get();
    const reelsDoc = await adminDb.collection("homepage_media").doc("insta_reels").get();

    let hero = fallbackPayload.hero;
    if (heroDoc.exists) {
      const data = heroDoc.data();
      const rawSlides: any[] = Array.isArray(data.slides) ? data.slides : [];
      // Only enabled slides sorted by sortOrder, stripping private audit data and storagePath
      const activeSlides = rawSlides
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((s) => {
          const { storagePath, updatedBy: _u, ...publicSlide } = s;
          return {
            ...publicSlide,
            redirectUrl: sanitizeRedirectUrl(s.redirectUrl)
          };
        });

      hero = {
        settings: {
          autoplay: data.settings?.autoplay !== false,
          slideInterval: Math.max(3, Math.min(10, Number(data.settings?.slideInterval || 5)))
        },
        slides: activeSlides.length > 0 ? activeSlides : fallbackPayload.hero.slides,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    let instagram = fallbackPayload.instagram;
    if (instaDoc.exists) {
      const data = instaDoc.data();
      const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
      const activeItems = rawItems
        .filter((item) => item.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((item) => {
          const { storagePath, updatedBy: _u, ...publicItem } = item;
          return {
            ...publicItem,
            redirectUrl: sanitizeRedirectUrl(item.redirectUrl)
          };
        });

      instagram = {
        items: activeItems,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    let reels = fallbackPayload.reels;
    if (reelsDoc.exists) {
      const data = reelsDoc.data();
      const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
      const activeItems = rawItems
        .filter((item) => item.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((item) => {
          const { videoStoragePath, posterStoragePath, updatedBy: _u, ...publicItem } = item;
          return {
            ...publicItem,
            redirectUrl: sanitizeRedirectUrl(item.redirectUrl)
          };
        });

      reels = {
        items: activeItems,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    return { hero, instagram, reels };
  } catch (err) {
    console.error("[HOMEPAGE MEDIA] Error fetching public media from Firestore:", err);
    return fallbackPayload;
  }
}

/**
 * Admin read helper:
 * Retains audit information (updatedBy, storagePath) for the authorized administrator.
 */
export async function getAdminHomepageMedia(adminDb: any): Promise<HomepageMediaPayload> {
  const defaultMedia: HomepageMediaPayload = {
    hero: {
      settings: DEFAULT_HERO_SLIDER_SETTINGS,
      slides: DEFAULT_FALLBACK_HERO_SLIDES,
      updatedAt: new Date().toISOString(),
      updatedBy: "system_default"
    },
    instagram: {
      items: [],
      updatedAt: new Date().toISOString(),
      updatedBy: "system_default"
    },
    reels: {
      items: [],
      updatedAt: new Date().toISOString(),
      updatedBy: "system_default"
    }
  };

  if (!adminDb) return defaultMedia;

  try {
    const heroDoc = await adminDb.collection("homepage_media").doc("hero_slider").get();
    const instaDoc = await adminDb.collection("homepage_media").doc("best_of_instagram").get();
    const reelsDoc = await adminDb.collection("homepage_media").doc("insta_reels").get();

    const hero: HeroSliderConfig = heroDoc.exists
      ? {
          settings: {
            autoplay: heroDoc.data()?.settings?.autoplay !== false,
            slideInterval: Number(heroDoc.data()?.settings?.slideInterval || 5)
          },
          slides: (heroDoc.data()?.slides || []).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
          updatedAt: heroDoc.data()?.updatedAt || new Date().toISOString(),
          updatedBy: heroDoc.data()?.updatedBy || "admin"
        }
      : defaultMedia.hero;

    const instagram: BestOfInstagramConfig = instaDoc.exists
      ? {
          items: (instaDoc.data()?.items || []).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
          updatedAt: instaDoc.data()?.updatedAt || new Date().toISOString(),
          updatedBy: instaDoc.data()?.updatedBy || "admin"
        }
      : defaultMedia.instagram;

    const reels: InstaReelsConfig = reelsDoc.exists
      ? {
          items: (reelsDoc.data()?.items || []).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
          updatedAt: reelsDoc.data()?.updatedAt || new Date().toISOString(),
          updatedBy: reelsDoc.data()?.updatedBy || "admin"
        }
      : defaultMedia.reels;

    return { hero, instagram, reels };
  } catch (err) {
    console.error("[HOMEPAGE MEDIA] Error fetching admin media from Firestore:", err);
    return defaultMedia;
  }
}

/**
 * Saves Hero Slider configuration to Firestore with audit log and orphaned storage cleanup.
 */
export async function saveHeroSliderConfig(
  adminDb: any,
  config: HeroSliderConfig,
  adminEmail: string
): Promise<{ success: boolean; error?: string; config?: HeroSliderConfig }> {
  const validation = validateHeroSliderConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Fetch previous slides to detect orphaned storage files
  let previousPaths: string[] = [];
  try {
    const existingDoc = await adminDb.collection("homepage_media").doc("hero_slider").get();
    if (existingDoc.exists) {
      previousPaths = (existingDoc.data()?.slides || [])
        .map((s: any) => s.storagePath)
        .filter(Boolean);
    }
  } catch (_e) {
    // Non-blocking
  }

  const now = new Date().toISOString();
  const normalizedSlides: HeroSlide[] = config.slides.map((s, idx) => ({
    id: s.id || `hero_${Date.now()}_${idx}`,
    image: s.image,
    altText: s.altText.trim(),
    heading: s.heading?.trim() || "",
    subheading: s.subheading?.trim() || "",
    ctaLabel: s.ctaLabel?.trim() || "",
    redirectUrl: sanitizeRedirectUrl(s.redirectUrl),
    sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : idx + 1,
    enabled: s.enabled !== false,
    width: s.width || HERO_CANONICAL_WIDTH,
    height: s.height || HERO_CANONICAL_HEIGHT,
    fileSize: s.fileSize,
    storagePath: s.storagePath,
    focalPosition: s.focalPosition || { preset: "center", x: 50, y: 50 },
    createdAt: s.createdAt || now,
    updatedAt: now
  }));

  const payloadToStore: HeroSliderConfig = {
    settings: {
      autoplay: config.settings.autoplay !== false,
      slideInterval: Math.max(3, Math.min(10, Number(config.settings.slideInterval || 5)))
    },
    slides: normalizedSlides,
    updatedAt: now,
    updatedBy: adminEmail
  };

  await adminDb.collection("homepage_media").doc("hero_slider").set(payloadToStore);

  // Background cleanup of orphaned storage objects
  const newPaths = normalizedSlides.map((s) => s.storagePath).filter(Boolean) as string[];
  cleanupOrphanedStorageMedia(adminDb, previousPaths, newPaths).catch((err) => {
    console.warn("[HOMEPAGE MEDIA] Hero slide storage cleanup warning:", err.message);
  });

  return { success: true, config: payloadToStore };
}

/**
 * Saves Best of Instagram configuration to Firestore with audit log and orphaned storage cleanup.
 */
export async function saveBestOfInstagramConfig(
  adminDb: any,
  config: BestOfInstagramConfig,
  adminEmail: string
): Promise<{ success: boolean; error?: string; config?: BestOfInstagramConfig }> {
  const validation = validateInstagramConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let previousPaths: string[] = [];
  try {
    const existingDoc = await adminDb.collection("homepage_media").doc("best_of_instagram").get();
    if (existingDoc.exists) {
      previousPaths = (existingDoc.data()?.items || [])
        .map((it: any) => it.storagePath)
        .filter(Boolean);
    }
  } catch (_e) {
    // Non-blocking
  }

  const now = new Date().toISOString();
  const normalizedItems: InstagramMediaItem[] = config.items.map((item, idx) => ({
    id: item.id || `insta_${Date.now()}_${idx}`,
    image: item.image,
    altText: item.altText.trim(),
    caption: item.caption?.trim() || "",
    redirectUrl: sanitizeRedirectUrl(item.redirectUrl),
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx + 1,
    enabled: item.enabled !== false,
    width: item.width || INSTAGRAM_CANONICAL_WIDTH,
    height: item.height || INSTAGRAM_CANONICAL_HEIGHT,
    fileSize: item.fileSize,
    storagePath: item.storagePath,
    createdAt: item.createdAt || now,
    updatedAt: now
  }));

  const payloadToStore: BestOfInstagramConfig = {
    items: normalizedItems,
    updatedAt: now,
    updatedBy: adminEmail
  };

  await adminDb.collection("homepage_media").doc("best_of_instagram").set(payloadToStore);

  const newPaths = normalizedItems.map((it) => it.storagePath).filter(Boolean) as string[];
  cleanupOrphanedStorageMedia(adminDb, previousPaths, newPaths).catch((err) => {
    console.warn("[HOMEPAGE MEDIA] Instagram storage cleanup warning:", err.message);
  });

  return { success: true, config: payloadToStore };
}

/**
 * Saves Insta Reels configuration to Firestore with audit log and orphaned storage cleanup.
 */
export async function saveInstaReelsConfig(
  adminDb: any,
  config: InstaReelsConfig,
  adminEmail: string
): Promise<{ success: boolean; error?: string; config?: InstaReelsConfig }> {
  const validation = validateReelsConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let previousPaths: string[] = [];
  try {
    const existingDoc = await adminDb.collection("homepage_media").doc("insta_reels").get();
    if (existingDoc.exists) {
      previousPaths = (existingDoc.data()?.items || []).flatMap((r: any) => [
        r.videoStoragePath,
        r.posterStoragePath
      ]).filter(Boolean);
    }
  } catch (_e) {
    // Non-blocking
  }

  const now = new Date().toISOString();
  const normalizedItems: ReelMediaItem[] = config.items.map((item, idx) => ({
    id: item.id || `reel_${Date.now()}_${idx}`,
    videoUrl: item.videoUrl,
    posterUrl: item.posterUrl,
    title: item.title.trim(),
    caption: item.caption?.trim() || "",
    redirectUrl: sanitizeRedirectUrl(item.redirectUrl),
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx + 1,
    enabled: item.enabled !== false,
    width: item.width || REEL_POSTER_CANONICAL_WIDTH,
    height: item.height || REEL_POSTER_CANONICAL_HEIGHT,
    fileSize: item.fileSize,
    videoStoragePath: item.videoStoragePath,
    posterStoragePath: item.posterStoragePath,
    createdAt: item.createdAt || now,
    updatedAt: now
  }));

  const payloadToStore: InstaReelsConfig = {
    items: normalizedItems,
    updatedAt: now,
    updatedBy: adminEmail
  };

  await adminDb.collection("homepage_media").doc("insta_reels").set(payloadToStore);

  const newPaths = normalizedItems.flatMap((r) => [r.videoStoragePath, r.posterStoragePath]).filter(Boolean) as string[];
  cleanupOrphanedStorageMedia(adminDb, previousPaths, newPaths).catch((err) => {
    console.warn("[HOMEPAGE MEDIA] Reels storage cleanup warning:", err.message);
  });

  return { success: true, config: payloadToStore };
}
