import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noindex?: boolean;
  canonical?: string;
  structuredData?: object | object[];
}

export function useSEO({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  noindex = false,
  canonical,
  structuredData
}: SEOProps) {
  useEffect(() => {
    // 1. Dynamic Title
    const formattedTitle = title.includes('Sa and Sha') ? title : `${title} | Sa and Sha`;
    document.title = formattedTitle;

    // Helper to set or create meta content dynamically
    const setMetaContent = (selector: string, content?: string) => {
      if (content === undefined) return;
      let element = document.querySelector(selector);
      if (element) {
        element.setAttribute('content', content);
      } else {
        const head = document.getElementsByTagName('head')[0];
        const newMeta = document.createElement('meta');
        
        if (selector.startsWith('meta[name=')) {
          const nameMatch = selector.match(/name="([^"]+)"/);
          if (nameMatch) {
            newMeta.setAttribute('name', nameMatch[1]);
          }
        } else if (selector.startsWith('meta[property=')) {
          const propMatch = selector.match(/property="([^"]+)"/);
          if (propMatch) {
            newMeta.setAttribute('property', propMatch[1]);
          }
        }
        
        newMeta.setAttribute('content', content);
        head.appendChild(newMeta);
      }
    };

    // 2. Meta description
    if (description) {
      setMetaContent('meta[name="description"]', description);
    }

    // 3. Open Graph & Twitter Titles
    const displayOgTitle = ogTitle || formattedTitle;
    setMetaContent('meta[property="og:title"]', displayOgTitle);
    setMetaContent('meta[name="twitter:title"]', displayOgTitle);

    // 4. Open Graph & Twitter Descriptions
    const displayOgDesc = ogDescription || description;
    if (displayOgDesc) {
      setMetaContent('meta[property="og:description"]', displayOgDesc);
      setMetaContent('meta[name="twitter:description"]', displayOgDesc);
    }

    // 5. Open Graph & Twitter Images
    if (ogImage) {
      setMetaContent('meta[property="og:image"]', ogImage);
      setMetaContent('meta[name="twitter:image"]', ogImage);
    }

    // 6. Robots Noindex/Nofollow Directive
    const robotsSelector = 'meta[name="robots"]';
    let robotsMeta = document.querySelector(robotsSelector);
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    } else {
      if (robotsMeta) {
        robotsMeta.setAttribute('content', 'index, follow');
      }
    }

    // 7. Canonical URL Enforcement (Preferred: www.sa-and-sha.com without query/tracking parameters)
    const baseCanonical = canonical || `https://www.sa-and-sha.com${window.location.pathname.replace(/\/$/, '') || '/'}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', baseCanonical);

    // 8. Dynamic JSON-LD Structured Data Injection
    const scriptClass = 'seo-structured-data-script';
    // Clean up old dynamic structured data tags
    document.querySelectorAll(`script.${scriptClass}`).forEach(el => el.remove());

    if (structuredData) {
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];
      dataArray.forEach(data => {
        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.classList.add(scriptClass);
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      });
    }
  }, [title, description, ogTitle, ogDescription, ogImage, noindex, canonical, structuredData]);
}

