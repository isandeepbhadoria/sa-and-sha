import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { products as staticProducts } from "../src/data";

// Firebase Configuration setup — set these via env or firebase-applet-config.json
// for your own Sa and Sha Firebase project.
let firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || ""
};

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    firebaseConfig = { ...firebaseConfig, ...config };
  }
} catch (err) {
  // Config read fallback
}

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || "(default)";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, databaseId);

let firestoreSuccess = false;
let firestoreProductsCount = 0;

async function fetchPublishedProducts(): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });
    firestoreSuccess = true;
    firestoreProductsCount = products.length;
    return products.filter((p: any) => p.status !== 'draft');
  } catch (error) {
    console.warn("SEO WARNING: Firestore products could not be retrieved. Sitemap may be incomplete.");
    console.warn("Error details:", error instanceof Error ? error.message : error);
    firestoreSuccess = false;
    firestoreProductsCount = 0;
    return [];
  }
}

async function getAllProducts() {
  const dbProducts = await fetchPublishedProducts();
  const staticPublished = staticProducts.filter(p => p.status !== 'draft');
  
  const merged: any[] = [...dbProducts];
  let duplicatesRemoved = 0;

  for (const sp of staticPublished) {
    if (!merged.some(p => p.id === sp.id)) {
      merged.push(sp);
    } else {
      duplicatesRemoved++;
    }
  }

  return {
    merged,
    staticCount: staticProducts.length,
    firestoreCount: firestoreProductsCount,
    duplicatesRemoved
  };
}

function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function run() {
  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /checkout
Disallow: /admin
Disallow: /wishlist

Sitemap: https://www.sa-and-sha.com/sitemap.xml`;

  fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf-8");
  console.log("Successfully generated public/robots.txt");

  // 2. Generate sitemap.xml
  try {
    const { merged: activeProducts, staticCount, firestoreCount, duplicatesRemoved } = await getAllProducts();

    const staticAndCategoryUrls: string[] = [
      "https://www.sa-and-sha.com/",
      "https://www.sa-and-sha.com/about",
      "https://www.sa-and-sha.com/faq",
      "https://www.sa-and-sha.com/contact-support",
      "https://www.sa-and-sha.com/returns-exchanges",
      "https://www.sa-and-sha.com/shipping-delivery",
      "https://www.sa-and-sha.com/track-order",
    ];

    const shopPages = ["all", "bestsellers", "new-arrivals"];
    for (const page of shopPages) {
      staticAndCategoryUrls.push(`https://www.sa-and-sha.com/shop/${page}`);
    }

    const collections = ["apparel", "accessories"];
    for (const collectionId of collections) {
      staticAndCategoryUrls.push(`https://www.sa-and-sha.com/shop/collection/${collectionId}`);
    }

    const productTypes = ["dresses", "tops-shirts", "shorts-skirts", "co-ord-sets", "trousers", "jackets", "bags-pouches"];
    for (const productTypeId of productTypes) {
      staticAndCategoryUrls.push(`https://www.sa-and-sha.com/shop/product/${productTypeId}`);
    }

    const locSet = new Set<string>();
    let duplicateSitemapUrlsCount = 0;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    for (const urlStr of staticAndCategoryUrls) {
      if (locSet.has(urlStr)) {
        duplicateSitemapUrlsCount++;
        continue;
      }
      locSet.add(urlStr);

      const isHome = urlStr === "https://www.sa-and-sha.com/";
      const isShop = urlStr.includes("/shop/");
      const priority = isHome ? "1.0" : (isShop ? "0.8" : "0.7");
      const changefreq = isHome ? "daily" : (isShop ? "weekly" : "monthly");

      xml += `  <url>\n`;
      xml += `    <loc>${urlStr}</loc>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    let productUrlsCount = 0;
    for (const prod of activeProducts) {
      const targetSlug = prod.slug || slugify(prod.name);
      const prodUrl = `https://www.sa-and-sha.com/product/${targetSlug}`;
      if (locSet.has(prodUrl)) {
        duplicateSitemapUrlsCount++;
        continue;
      }
      locSet.add(prodUrl);
      productUrlsCount++;

      xml += `  <url>\n`;
      xml += `    <loc>${prodUrl}</loc>\n`;
      
      if (prod.updatedAt || prod.updated_at) {
        const dateVal = prod.updatedAt || prod.updated_at;
        try {
          const isoDate = new Date(dateVal).toISOString().split("T")[0];
          if (isoDate && !isNaN(new Date(dateVal).getTime())) {
            xml += `    <lastmod>${isoDate}</lastmod>\n`;
          }
        } catch {
          // ignore invalid date
        }
      }

      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf-8");
    console.log("Successfully generated public/sitemap.xml");

    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, "robots.txt"), robotsTxt, "utf-8");
      fs.writeFileSync(path.join(distDir, "sitemap.xml"), xml, "utf-8");
      console.log("Successfully copied robots.txt and sitemap.xml to dist/");
    }

    console.log("\n==========================================");
    console.log("SEO GENERATION REPORT");
    console.log("==========================================");
    console.log(`Static products: ${staticCount}`);
    console.log(`Firestore products retrieved: ${firestoreCount}`);
    console.log(`Duplicates removed: ${duplicatesRemoved}`);
    console.log(`Final public products: ${activeProducts.length}`);
    console.log(`Product URLs in sitemap: ${productUrlsCount}`);
    console.log(`Static/category URLs: ${staticAndCategoryUrls.length}`);
    console.log(`Total sitemap URLs: ${locSet.size}`);
    console.log(`Duplicate sitemap URLs: ${duplicateSitemapUrlsCount}`);
    console.log(`Firestore retrieval: ${firestoreSuccess ? "SUCCESS" : "FAILED"}`);
    console.log("==========================================\n");

  } catch (error) {
    console.error("Error generating sitemap:", error);
    process.exit(1);
  }
}

run();

