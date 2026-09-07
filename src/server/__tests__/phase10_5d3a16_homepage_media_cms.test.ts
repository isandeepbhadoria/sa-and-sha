import { describe, it, expect } from "vitest";
import {
  sanitizeRedirectUrl,
  validateHeroSlide,
  validateHeroSliderConfig,
  validateInstagramItem,
  validateInstagramConfig,
  validateReelItem,
  validateReelsConfig,
  parseImageDimensionsFromBuffer,
  inspectAndValidateMediaUpload,
  getPublicHomepageMedia
} from "../homepageMediaHelpers";
import {
  HERO_CANONICAL_WIDTH,
  HERO_CANONICAL_HEIGHT,
  INSTAGRAM_CANONICAL_WIDTH,
  INSTAGRAM_CANONICAL_HEIGHT,
  HeroSlide
} from "../../types/homepageMedia";

describe("Phase 10.5D.3A.16: Homepage Media CMS Suite", () => {
  describe("1. URL Sanitization & Security", () => {
    it("allows valid relative internal paths", () => {
      expect(sanitizeRedirectUrl("/shop/shirts")).toBe("/shop/shirts");
      expect(sanitizeRedirectUrl("/shop/collection/summer-solace")).toBe("/shop/collection/summer-solace");
      expect(sanitizeRedirectUrl("/about")).toBe("/about");
    });

    it("allows valid external http and https URLs", () => {
      expect(sanitizeRedirectUrl("https://www.instagram.com/p/C12345/")).toBe("https://www.instagram.com/p/C12345/");
      expect(sanitizeRedirectUrl("http://example.com/lookbook")).toBe("http://example.com/lookbook");
    });

    it("strictly rejects dangerous and unsafe URL schemes", () => {
      expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeRedirectUrl("JAVASCRIPT:alert('xss')")).toBe("");
      expect(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe("");
      expect(sanitizeRedirectUrl("vbscript:msgbox")).toBe("");
      expect(sanitizeRedirectUrl("//malicious-domain.com")).toBe("");
      expect(sanitizeRedirectUrl("")).toBe("");
      expect(sanitizeRedirectUrl(null as any)).toBe("");
    });
  });

  describe("2. Hero Slider Validation", () => {
    it("accepts valid hero slide with canonical 2400 × 1000 resolution", () => {
      const result = validateHeroSlide({
        image: "https://example.com/hero.jpg",
        altText: "Pure Linen European Flax Shirts",
        width: 2400,
        height: 1000,
        redirectUrl: "/shop/shirts"
      });
      expect(result.valid).toBe(true);
    });

    it("strictly rejects non-canonical hero dimensions with exact user-facing error message", () => {
      const result = validateHeroSlide({
        image: "https://example.com/hero.jpg",
        altText: "Pure Linen European Flax Shirts",
        width: 1920,
        height: 1080
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Hero images must be 2400 × 1000 px. Your image is 1920 × 1080px.");
    });

    it("rejects hero slide missing alt text", () => {
      const result = validateHeroSlide({
        image: "https://example.com/hero.jpg",
        altText: "   ",
        width: 2400,
        height: 1000
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("alt text is required");
    });

    it("rejects hero slider config with 0 slides or more than 5 slides", () => {
      const emptyConfig = validateHeroSliderConfig({
        settings: { autoplay: true, slideInterval: 5 },
        slides: []
      });
      expect(emptyConfig.valid).toBe(false);
      expect(emptyConfig.error).toBe("Hero slider must contain between 1 and 5 slides.");

      const sixSlides = Array(6).fill({
        image: "https://example.com/hero.jpg",
        altText: "Slide",
        width: 2400,
        height: 1000
      });
      const overflowConfig = validateHeroSliderConfig({
        settings: { autoplay: true, slideInterval: 5 },
        slides: sixSlides
      });
      expect(overflowConfig.valid).toBe(false);
      expect(overflowConfig.error).toBe("Hero slider must contain between 1 and 5 slides.");
    });

    it("enforces slide interval between 3 and 10 seconds", () => {
      const validSlide: HeroSlide = {
        id: "slide_test_1",
        sortOrder: 0,
        enabled: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
        image: "https://example.com/hero.jpg",
        altText: "Slide",
        width: 2400,
        height: 1000
      };

      const tooFast = validateHeroSliderConfig({
        settings: { autoplay: true, slideInterval: 2 },
        slides: [validSlide]
      });
      expect(tooFast.valid).toBe(false);
      expect(tooFast.error).toBe("Slide interval must be between 3 and 10 seconds.");

      const tooSlow = validateHeroSliderConfig({
        settings: { autoplay: true, slideInterval: 12 },
        slides: [validSlide]
      });
      expect(tooSlow.valid).toBe(false);
      expect(tooSlow.error).toBe("Slide interval must be between 3 and 10 seconds.");

      const justRight = validateHeroSliderConfig({
        settings: { autoplay: true, slideInterval: 5 },
        slides: [validSlide]
      });
      expect(justRight.valid).toBe(true);
    });
  });

  describe("3. Best of Instagram Validation", () => {
    it("accepts valid Instagram item with 1080 × 1350 resolution (4:5 ratio)", () => {
      const result = validateInstagramItem({
        image: "https://example.com/insta.jpg",
        altText: "Customer in White Linen",
        redirectUrl: "https://instagram.com/p/123",
        width: 1080,
        height: 1350
      });
      expect(result.valid).toBe(true);
    });

    it("rejects non-4:5 Instagram image with clear explanatory error", () => {
      const result = validateInstagramItem({
        image: "https://example.com/insta.jpg",
        altText: "Customer in White Linen",
        redirectUrl: "https://instagram.com/p/123",
        width: 1200,
        height: 630 // Landscape
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Instagram images must be 1080 × 1350 px (4:5 ratio). Your image is 1200 × 630px.");
    });

    it("rejects Instagram item missing image URL", () => {
      const result = validateInstagramItem({
        image: "",
        altText: "Customer in White Linen"
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Instagram image URL is required.");
    });
  });

  describe("4. Insta Reels Validation", () => {
    it("accepts valid Reel item with video, poster, title, and sanitized redirect", () => {
      const result = validateReelItem({
        videoUrl: "https://example.com/video.mp4",
        posterUrl: "https://example.com/poster.jpg",
        title: "Styling Pure French Linen",
        redirectUrl: "/shop/shirts"
      });
      expect(result.valid).toBe(true);
    });

    it("rejects Reel item missing poster thumbnail", () => {
      const result = validateReelItem({
        videoUrl: "https://example.com/video.mp4",
        posterUrl: "",
        title: "Styling Pure French Linen"
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Poster thumbnail URL is required");
    });
  });

  describe("5. Buffer Binary Inspection & Dimension Parsing", () => {
    it("parses PNG buffer dimensions and mime type correctly", () => {
      // Construct a minimal valid PNG buffer with IHDR chunk
      const pngBuf = Buffer.alloc(33);
      // PNG Signature
      pngBuf[0] = 0x89;
      pngBuf[1] = 0x50;
      pngBuf[2] = 0x4E;
      pngBuf[3] = 0x47;
      pngBuf[4] = 0x0D;
      pngBuf[5] = 0x0A;
      pngBuf[6] = 0x1A;
      pngBuf[7] = 0x0A;
      // IHDR length 13
      pngBuf.writeUInt32BE(13, 8);
      // Chunk type 'IHDR'
      pngBuf.write("IHDR", 12, "ascii");
      // Width 2400
      pngBuf.writeUInt32BE(2400, 16);
      // Height 1000
      pngBuf.writeUInt32BE(1000, 20);

      const parsed = parseImageDimensionsFromBuffer(pngBuf);
      expect(parsed).not.toBeNull();
      expect(parsed?.width).toBe(2400);
      expect(parsed?.height).toBe(1000);
      expect(parsed?.mimeType).toBe("image/png");

      const inspectResult = inspectAndValidateMediaUpload(pngBuf, "image/png", "hero");
      expect(inspectResult.valid).toBe(true);
      expect(inspectResult.dimensions).toEqual({ width: 2400, height: 1000 });
    });

    it("rejects hero upload if dimensions are not 2400 × 1000", () => {
      const pngBuf = Buffer.alloc(33);
      pngBuf[0] = 0x89;
      pngBuf[1] = 0x50;
      pngBuf[2] = 0x4E;
      pngBuf[3] = 0x47;
      pngBuf[4] = 0x0D;
      pngBuf[5] = 0x0A;
      pngBuf[6] = 0x1A;
      pngBuf[7] = 0x0A;
      pngBuf.writeUInt32BE(13, 8);
      pngBuf.write("IHDR", 12, "ascii");
      pngBuf.writeUInt32BE(1920, 16);
      pngBuf.writeUInt32BE(1080, 20);

      const inspectResult = inspectAndValidateMediaUpload(pngBuf, "image/png", "hero");
      expect(inspectResult.valid).toBe(false);
      expect(inspectResult.error).toBe("Hero images must be 2400 × 1000 px. Your image is 1920 × 1080px.");
    });

    it("verifies MP4 video upload magic bytes and size check", () => {
      const mp4Buf = Buffer.alloc(100);
      mp4Buf.write("....ftypmp42", 0, "ascii");

      const inspectResult = inspectAndValidateMediaUpload(mp4Buf, "video/mp4", "reel_video");
      expect(inspectResult.valid).toBe(true);
      expect(inspectResult.mimeType).toBe("video/mp4");
    });
  });

  describe("6. Migration Fallback Guarantees (Phase 16B)", () => {
    it("returns default fallback payload with editorial hero and clean empty social lists when database is offline", async () => {
      const media = await getPublicHomepageMedia(null);
      expect(media.hero.slides.length).toBeGreaterThanOrEqual(1);
      expect(media.hero.slides[0].width).toBe(HERO_CANONICAL_WIDTH);
      expect(media.hero.slides[0].height).toBe(HERO_CANONICAL_HEIGHT);
      // Under Phase 16B, empty arrays are returned to avoid inventing fictional social counts/posts
      expect(Array.isArray(media.instagram.items)).toBe(true);
      expect(media.instagram.items.length).toBe(0);
      expect(Array.isArray(media.reels.items)).toBe(true);
      expect(media.reels.items.length).toBe(0);
    });
  });
});
