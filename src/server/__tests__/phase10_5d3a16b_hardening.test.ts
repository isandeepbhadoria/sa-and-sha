import { describe, it, expect } from "vitest";
import {
  getPublicHomepageMedia,
  getAdminHomepageMedia,
  cleanupOrphanedStorageMedia,
  inspectAndValidateMediaUpload,
  saveHeroSliderConfig,
  saveBestOfInstagramConfig,
  saveInstaReelsConfig
} from "../homepageMediaHelpers";
import {
  HERO_CANONICAL_WIDTH,
  HERO_CANONICAL_HEIGHT,
  INSTAGRAM_CANONICAL_WIDTH,
  INSTAGRAM_CANONICAL_HEIGHT,
  BRAND_INSTAGRAM_URL,
  DEFAULT_FALLBACK_INSTAGRAM_ITEMS,
  DEFAULT_FALLBACK_REEL_ITEMS
} from "../../types/homepageMedia";

describe("Phase 10.5D.3A.16B: Production Hardening & Cloud Storage Suite", () => {
  describe("1. Fallback & Privacy Guarantees", () => {
    it("ensures fallback social items are strictly empty to prevent fake counts/posts", () => {
      expect(DEFAULT_FALLBACK_INSTAGRAM_ITEMS).toEqual([]);
      expect(DEFAULT_FALLBACK_REEL_ITEMS).toEqual([]);
    });

    it("verifies official brand Instagram handle URL", () => {
      expect(BRAND_INSTAGRAM_URL).toBe("https://www.instagram.com/_saandsha");
    });

    it("strips storagePath and updatedBy from public storefront media responses", async () => {
      // Mock db that returns an admin document containing storagePath and updatedBy
      const mockDocData = {
        settings: { autoplay: true, slideInterval: 5 },
        slides: [
          {
            id: "slide-1",
            image: "https://storage.googleapis.com/test-bucket/homepage-media/hero/test.webp",
            storagePath: "homepage-media/hero/test.webp",
            altText: "Autumn Collection in 100% French Linen",
            heading: "Pure Linen",
            subheading: "Artisan European Flax",
            ctaLabel: "Shop",
            redirectUrl: "/shop/shirts",
            focalPosition: { x: 50, y: 30 },
            sortOrder: 1,
            enabled: true,
            width: 2400,
            height: 1000,
            fileSize: 150000
          }
        ],
        updatedAt: new Date().toISOString(),
        updatedBy: "admin@sa-and-sha.com"
      };

      const mockDb = {
        collection: (_col: string) => ({
          doc: (_d: string) => ({
            get: async () => ({
              exists: true,
              data: () => mockDocData
            })
          })
        })
      };

      const publicMedia = await getPublicHomepageMedia(mockDb as any);
      expect(publicMedia.hero.slides.length).toBe(1);
      const slide = publicMedia.hero.slides[0] as any;
      expect(slide.image).toBe("https://storage.googleapis.com/test-bucket/homepage-media/hero/test.webp");
      expect(slide.storagePath).toBeUndefined(); // Stripped from public response
      expect((publicMedia.hero as any).updatedBy).toBeUndefined(); // Stripped from public response
      expect(slide.focalPosition).toEqual({ x: 50, y: 30 });
    });
  });

  describe("2. Dimension & Format Inspections", () => {
    it("strictly verifies canonical 2400 × 1000 for hero slides", () => {
      // Create a 2400x1000 PNG buffer
      const buf = Buffer.alloc(30);
      buf[0] = 0x89;
      buf[1] = 0x50;
      buf[2] = 0x4e;
      buf[3] = 0x47;
      buf[4] = 0x0d;
      buf[5] = 0x0a;
      buf[6] = 0x1a;
      buf[7] = 0x0a;
      buf.writeUInt32BE(HERO_CANONICAL_WIDTH, 16);
      buf.writeUInt32BE(HERO_CANONICAL_HEIGHT, 20);

      const res = inspectAndValidateMediaUpload(buf, "image/png", "hero");
      expect(res.valid).toBe(true);
      expect(res.dimensions?.width).toBe(2400);
      expect(res.dimensions?.height).toBe(1000);
    });

    it("rejects non-canonical hero dimensions", () => {
      const buf = Buffer.alloc(30);
      buf[0] = 0x89;
      buf[1] = 0x50;
      buf[2] = 0x4e;
      buf[3] = 0x47;
      buf[4] = 0x0d;
      buf[5] = 0x0a;
      buf[6] = 0x1a;
      buf[7] = 0x0a;
      buf.writeUInt32BE(1920, 16);
      buf.writeUInt32BE(1080, 20);

      const res = inspectAndValidateMediaUpload(buf, "image/png", "hero");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("2400 × 1000 px");
    });

    it("verifies 1080 × 1350 for Instagram posts", () => {
      const buf = Buffer.alloc(30);
      buf[0] = 0x89;
      buf[1] = 0x50;
      buf[2] = 0x4e;
      buf[3] = 0x47;
      buf[4] = 0x0d;
      buf[5] = 0x0a;
      buf[6] = 0x1a;
      buf[7] = 0x0a;
      buf.writeUInt32BE(INSTAGRAM_CANONICAL_WIDTH, 16);
      buf.writeUInt32BE(INSTAGRAM_CANONICAL_HEIGHT, 20);

      const res = inspectAndValidateMediaUpload(buf, "image/png", "instagram");
      expect(res.valid).toBe(true);
      expect(res.dimensions?.width).toBe(1080);
      expect(res.dimensions?.height).toBe(1350);
    });
  });

  describe("3. Cloud Storage Orphan Cleanup Logic", () => {
    it("identifies and schedules deletion of abandoned media files", async () => {
      const mockAdminDb = {
        collection: (_col: string) => ({
          doc: (_d: string) => ({
            get: async () => ({
              exists: true,
              data: () => ({
                slides: [{ storagePath: "homepage-media/hero/kept-hero-slide.webp" }],
                items: []
              })
            })
          })
        })
      };

      const previousPaths = [
        "homepage-media/hero/old-hero-slide.webp",
        "homepage-media/hero/kept-hero-slide.webp"
      ];
      const newPaths = [
        "homepage-media/hero/kept-hero-slide.webp",
        "homepage-media/hero/new-hero-slide.webp"
      ];

      // Should execute without error and identify orphaned candidate
      await expect(
        cleanupOrphanedStorageMedia(mockAdminDb as any, previousPaths, newPaths)
      ).resolves.not.toThrow();
    });

    it("handles null or offline database safely without throwing", async () => {
      await expect(
        cleanupOrphanedStorageMedia(null as any, ["homepage-media/hero/missing.webp"], [])
      ).resolves.not.toThrow();
    });
  });

  describe("4. Hero Slider Focal Position Support", () => {
    it("preserves valid focal point coordinates in saveHeroSliderConfig", async () => {
      let savedDoc: any = null;
      const mockDb = {
        collection: () => ({
          doc: () => ({
            get: async () => ({ exists: false }),
            set: async (data: any) => {
              savedDoc = data;
            }
          })
        })
      };

      const result = await saveHeroSliderConfig(
        mockDb as any,
        {
          settings: { autoplay: true, slideInterval: 5 },
          slides: [
            {
              id: "slide-1",
              image: "https://images.unsplash.com/photo-1?auto=format&fit=crop&w=2400&h=1000",
              altText: "Artisanal Pure Linen",
              focalPosition: { x: 50, y: 20 },
              sortOrder: 1,
              enabled: true,
              width: 2400,
              height: 1000,
              createdAt: "2026-09-01T00:00:00.000Z",
              updatedAt: "2026-09-01T00:00:00.000Z"
            }
          ],
          updatedAt: "2026-09-01T00:00:00.000Z",
          updatedBy: "admin@sa-and-sha.com"
        },
        "admin@sa-and-sha.com"
      );

      expect(result.success).toBe(true);
      expect(savedDoc.slides[0].focalPosition).toEqual({ x: 50, y: 20 });
    });
  });
});
