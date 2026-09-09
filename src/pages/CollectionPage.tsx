import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { products, categoryFAQs, COLOR_SWATCHES } from '../data';
import { ProductCard } from '../components/ProductCard';
import { useShop } from '../context/ShopContext';
import { SlidersHorizontal, Grid2X2, Grid3X3, X, ChevronDown, ChevronUp, RefreshCw, Star, Info, HelpCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSEO } from '../hooks/useSEO';
import { NotFoundPage } from './NotFoundPage';
import { getTaxonomyRouteInfo } from '../config/catalogTaxonomy';

export const CollectionPage: React.FC = () => {
  const { categorySlug, collectionId, productTypeId, subTypeSlug } = useParams<{
    categorySlug?: string;
    collectionId?: string;
    productTypeId?: string;
    subTypeSlug?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { products: contextProducts, showToast } = useShop();

  // Resolve canonical taxonomy route information
  const routeInfo = useMemo(() => {
    if (collectionId || productTypeId || subTypeSlug) {
      return getTaxonomyRouteInfo({
        collectionId,
        productTypeId,
        subTypeSlug
      });
    }

    if (categorySlug) {
      if (categorySlug === 'all') {
        return getTaxonomyRouteInfo({ curatedSlug: 'all' });
      }
      if (categorySlug === 'bestsellers') {
        return getTaxonomyRouteInfo({ curatedSlug: 'bestsellers' });
      }
      if (categorySlug === 'new-arrivals') {
        return getTaxonomyRouteInfo({ curatedSlug: 'new-arrivals' });
      }
      if (categorySlug === 'polos') {
        return {
          isValid: false,
          isComingSoon: false,
          title: "Page Not Found | Sa and Sha",
          h1: "Garment Not Found",
          metaDescription: "The polo category is no longer available in our active catalog.",
          canonicalPath: "/shop",
          canonicalUrl: "https://www.sa-and-sha.com/shop",
          breadcrumbs: [{ name: 'Home', url: '/' }]
        };
      }
      return {
        isValid: false,
        isComingSoon: false,
        title: "Page Not Found | Sa and Sha",
        h1: "Garment Not Found",
        metaDescription: "The requested category is not found in our catalog.",
        canonicalPath: "/404",
        canonicalUrl: "https://www.sa-and-sha.com/404",
        breadcrumbs: [{ name: 'Home', url: '/' }]
      };
    }

    // Default: /shop -> Shop All
    return getTaxonomyRouteInfo({ curatedSlug: 'all' });
  }, [collectionId, productTypeId, subTypeSlug, categorySlug]);

  // Redirect archived polos category to /shop if encountered
  useEffect(() => {
    if (categorySlug === 'polos') {
      navigate('/shop', { replace: true });
    }
  }, [categorySlug, navigate]);

  // Component UI States
  const [gridDensity, setGridDensity] = useState<'double' | 'quad'>('quad');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSeoExpanded, setIsSeoExpanded] = useState(false);

  // Accordion filters expanded state
  const [expandedFilters, setExpandedFilters] = useState({
    subCategory: true,
    color: true,
    price: true,
    size: true,
    fit: true,
    pattern: false,
    sleeve: false,
    collar: false,
    fabric: false
  });

  // Collapsible FAQ states
  const [faqExpanded, setFaqExpanded] = useState<Record<number, boolean>>({});

  // Reset page pagination size when category route changes
  useEffect(() => {
    setVisibleCount(8);
  }, [collectionId, productTypeId, subTypeSlug, categorySlug]);

  // Read filters from searchParams
  const activeSort = searchParams.get('sort') || 'featured';
  const activeSubCats = searchParams.get('subcategory')?.split(',') || [];
  const activeColors = searchParams.get('color')?.split(',') || [];
  const activeSizes = searchParams.get('size')?.split(',') || [];
  const activeFits = searchParams.get('fit')?.split(',') || [];
  const activePatterns = searchParams.get('pattern')?.split(',') || [];
  const activeSleeves = searchParams.get('sleeve')?.split(',') || [];
  const activeCollars = searchParams.get('collar')?.split(',') || [];
  const activeFabrics = searchParams.get('fabric')?.split(',') || [];
  const priceMax = searchParams.get('pricemax') ? Number(searchParams.get('pricemax')) : 5000;

  // Determine current category flags
  const currentCategory = useMemo(() => {
    const isShirts = routeInfo.filterProductType === 'tops-shirts';
    const isPants = routeInfo.filterProductType === 'trousers';
    return {
      name: routeInfo.h1,
      isShirts,
      isPants,
      isPolos: false
    };
  }, [routeInfo]);

  const breadcrumbSchema = useMemo(() => {
    if (!routeInfo.isValid) return null;
    const items = routeInfo.breadcrumbs.map((b, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": b.name,
      ...(b.url ? { "item": `https://www.sa-and-sha.com${b.url}` } : {})
    }));

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items
    };
  }, [routeInfo]);

  useSEO({
    title: routeInfo.title,
    description: routeInfo.metaDescription,
    canonical: routeInfo.canonicalUrl,
    structuredData: breadcrumbSchema ? [breadcrumbSchema] : undefined
  });

  // Set the default accordion expands based on shirts vs pants
  useEffect(() => {
    if (currentCategory.isShirts) {
      setExpandedFilters(prev => ({ ...prev, sleeve: true, collar: true }));
    } else {
      setExpandedFilters(prev => ({ ...prev, sleeve: false, collar: false }));
    }
  }, [currentCategory]);

  // Filter helper triggers
  const updateQueryParam = (key: string, values: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (values.length === 0) {
      newParams.delete(key);
    } else {
      newParams.set(key, values.join(','));
    }
    setSearchParams(newParams);
  };

  const toggleFilterValue = (paramKey: string, value: string, currentList: string[]) => {
    const updated = currentList.includes(value)
      ? currentList.filter(v => v !== value)
      : [...currentList, value];
    updateQueryParam(paramKey, updated);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('pricemax', value);
    setSearchParams(newParams);
  };

  const handleSortChange = (sortType: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', sortType);
    setSearchParams(newParams);
    setIsSortOpen(false);
  };

  const handleClearAll = () => {
    const cleanParams = new URLSearchParams();
    if (searchParams.get('search')) {
      cleanParams.set('search', searchParams.get('search')!);
    }
    setSearchParams(cleanParams);
  };

  const toggleAccordion = (field: keyof typeof expandedFilters) => {
    setExpandedFilters(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleFAQ = (idx: number) => {
    setFaqExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // 1. FILTERING & SORTING LOGIC
  const filteredProducts = useMemo(() => {
    let result = [...(contextProducts && contextProducts.length > 0 ? contextProducts : products)].filter(
      p => p.status !== 'archived' && !p.isDecommissioned && p.status !== 'draft'
    );

    // Search query support
    const searchVal = searchParams.get('search');
    if (searchVal) {
      const q = searchVal.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.fabric.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q)
      );
    }

    // Canonical category taxonomy filtering
    if (routeInfo.filterCollection) {
      result = result.filter(p => p.collection === routeInfo.filterCollection);
    }
    if (routeInfo.filterProductType) {
      result = result.filter(p => p.productType === routeInfo.filterProductType);
    }
    if (routeInfo.filterProductSubType) {
      result = result.filter(p => p.productSubType === routeInfo.filterProductSubType);
    }
    if (routeInfo.curatedType === 'bestsellers') {
      result = result.filter(p => p.bestseller);
    } else if (routeInfo.curatedType === 'new-arrivals') {
      result = result.filter(p => p.newArrival);
    }

    // Drawer Filters
    if (activeSubCats.length > 0) {
      result = result.filter(p => activeSubCats.includes(p.subCategory));
    }
    if (activeColors.length > 0) {
      result = result.filter(p => activeColors.includes(p.color));
    }
    if (activeSizes.length > 0) {
      result = result.filter(p => p.sizes.some(s => activeSizes.includes(s)));
    }
    if (activeFits.length > 0) {
      result = result.filter(p => activeFits.includes(p.fit));
    }
    if (activePatterns.length > 0) {
      result = result.filter(p => activePatterns.includes(p.pattern));
    }
    if (activeSleeves.length > 0) {
      result = result.filter(p => p.sleeve && activeSleeves.includes(p.sleeve));
    }
    if (activeCollars.length > 0) {
      result = result.filter(p => p.collar && activeCollars.includes(p.collar));
    }
    if (activeFabrics.length > 0) {
      result = result.filter(p => activeFabrics.some(af => p.fabric.toLowerCase().includes(af.toLowerCase())));
    }
    if (priceMax) {
      result = result.filter(p => p.price <= priceMax);
    }

    // Sort order operations
    if (activeSort === 'new-arrivals' || routeInfo.curatedType === 'new-arrivals') {
      result.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    } else if (activeSort === 'best-selling' || routeInfo.curatedType === 'bestsellers') {
      result.sort((a, b) => (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0));
    } else if (activeSort === 'price-low-high') {
      result.sort((a, b) => a.price - b.price);
    } else if (activeSort === 'price-high-low') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [
    contextProducts,
    routeInfo,
    searchParams,
    activeSort,
    activeSubCats,
    activeColors,
    activeSizes,
    activeFits,
    activePatterns,
    activeSleeves,
    activeCollars,
    activeFabrics,
    priceMax
  ]);

  // Paginated subset of visible items
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 8);
      setIsLoadingMore(false);
    }, 600);
  };

  // Sub-category filters selection lists depending on context
  const subCategoryOptions = useMemo(() => {
    if (routeInfo.filterProductType === 'tops-shirts') {
      return [
        { id: 'tops', label: 'Tops' },
        { id: 'shirts', label: 'Shirts' }
      ];
    }
    if (routeInfo.filterProductType === 'shorts-skirts') {
      return [
        { id: 'shorts', label: 'Shorts' },
        { id: 'skirts', label: 'Skirts' }
      ];
    }
    if (routeInfo.filterCollection === 'apparel') {
      return [
        { id: 'dresses', label: 'Dresses' },
        { id: 'tops', label: 'Tops' },
        { id: 'shirts', label: 'Shirts' },
        { id: 'shorts', label: 'Shorts' },
        { id: 'skirts', label: 'Skirts' },
        { id: 'co-ord-sets', label: 'Co-Ord Sets' },
        { id: 'trousers', label: 'Trousers' },
        { id: 'jackets', label: 'Jackets' }
      ];
    }
    return [
      { id: 'dresses', label: 'Dresses' },
      { id: 'tops', label: 'Tops' },
      { id: 'shirts', label: 'Shirts' },
      { id: 'shorts', label: 'Shorts' },
      { id: 'skirts', label: 'Skirts' },
      { id: 'co-ord-sets', label: 'Co-Ord Sets' },
      { id: 'trousers', label: 'Trousers' },
      { id: 'jackets', label: 'Jackets' },
      { id: 'bags-pouches', label: 'Bags & Pouches' }
    ];
  }, [routeInfo]);

  // Size list options (Apparel vs waist sizing)
  const sizeOptions = useMemo(() => {
    if (currentCategory.isPants) {
      return ['30', '32', '34', '36', '38'];
    }
    return ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  }, [currentCategory]);

  // Color Swatch references
  const colorOptions = useMemo(() => {
    return COLOR_SWATCHES;
  }, []);

  // Fabric list options
  const fabricOptions = ['Cotton', 'Linen-Cotton Blend', 'Georgette', 'Other'];

  // Accordion FAQs dynamically selected based on the resolved product type
  const currentFAQs = useMemo(() => {
    if (routeInfo.filterProductType && categoryFAQs[routeInfo.filterProductType]) {
      return categoryFAQs[routeInfo.filterProductType];
    }
    return Object.values(categoryFAQs).flat().slice(0, 5);
  }, [routeInfo]);

  // Current SEO descriptions
  const currentSeo = useMemo(() => {
    return {
      title: routeInfo.h1,
      description: routeInfo.metaDescription,
      comparisonTitle: 'Why Sa and Sha Transcends Fast Fashion',
      comparisonText: 'Every garment is made from quality fabrics with considered fits and finishing that hold up wear after wear.'
    };
  }, [routeInfo]);

  // If the route is invalid, render standard 404
  if (!routeInfo.isValid) {
    return <NotFoundPage />;
  }

  return (
    <div id="collection-page-container" className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      
      {/* a) Breadcrumbs */}
      <nav className="text-xs font-sans text-[#2A211C]/50 tracking-wider uppercase flex items-center gap-1.5" id="breadcrumb-nav">
        {routeInfo.breadcrumbs.map((crumb, idx) => {
          const isLast = idx === routeInfo.breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.name}>
              {idx > 0 && <span>/</span>}
              {crumb.url && !isLast ? (
                <Link to={crumb.url} className="hover:text-[#B08D57] transition-colors">
                  {crumb.name}
                </Link>
              ) : (
                <span className={isLast ? "text-[#2A211C] font-semibold" : ""}>{crumb.name}</span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* b) Page Header with Live Count */}
      <div className="flex flex-col md:flex-row justify-between items-baseline gap-2 border-b border-[#E5D2BC]/20 pb-4">
        <div>
          <h1 className="font-serif text-2xl md:text-4xl font-bold text-[#2A211C] tracking-tight">
            {searchParams.get('search') ? `Search results for: "${searchParams.get('search')}"` : routeInfo.h1}
          </h1>
          {searchParams.get('search') && (
            <p className="text-xs font-sans text-[#2A211C]/60 mt-1 uppercase font-medium tracking-widest">Search matches</p>
          )}
        </div>
        <span className="text-xs font-sans font-bold text-[#2A211C]/60 uppercase tracking-widest">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} Available
        </span>
      </div>

      {/* c) Sticky Utility Bar (Filters, Density, Sort) */}
      <div
        id="collection-utility-bar"
        className="sticky top-[73px] md:top-[85px] bg-[#FBF6EE]/95 backdrop-blur-sm border border-[#E5D2BC]/30 p-3.5 rounded-lg flex justify-between items-center z-30 shadow-sm"
      >
        {/* Toggle Filters trigger Button */}
        <button
          onClick={() => setIsFilterOpen(true)}
          className="flex items-center gap-2 px-3 py-2 border border-[#E5D2BC]/40 rounded bg-white hover:bg-[#2A211C] hover:text-[#FBF6EE] transition-all text-xs font-sans font-bold uppercase tracking-widest active:scale-95 cursor-pointer"
          id="toggle-filters-drawer-btn"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#B08D57]" />
          <span>Filters</span>
          {(activeSubCats.length + activeColors.length + activeSizes.length + activeFits.length + activePatterns.length + activeSleeves.length + activeCollars.length + activeFabrics.length + (priceMax < 5000 ? 1 : 0)) > 0 && (
            <span className="bg-[#B08D57] text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">
              {activeSubCats.length + activeColors.length + activeSizes.length + activeFits.length + activePatterns.length + activeSleeves.length + activeCollars.length + activeFabrics.length + (priceMax < 5000 ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Desktop grid controls & Sort layout */}
        <div className="flex items-center gap-4">
          
          {/* Density selection (Desktop Only) */}
          <div className="hidden md:flex items-center border border-[#E5D2BC]/30 rounded bg-white p-0.5 overflow-hidden">
            <button
              onClick={() => setGridDensity('double')}
              className={`p-1.5 transition-colors rounded ${
                gridDensity === 'double' ? 'bg-[#2A211C] text-[#FBF6EE]' : 'hover:bg-gray-100 text-[#2A211C]'
              }`}
              id="grid-density-double"
              aria-label="Two column grid"
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setGridDensity('quad')}
              className={`p-1.5 transition-colors rounded ${
                gridDensity === 'quad' ? 'bg-[#2A211C] text-[#FBF6EE]' : 'hover:bg-gray-100 text-[#2A211C]'
              }`}
              id="grid-density-quad"
              aria-label="Four column grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Selector Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1 px-3 py-2 border border-[#E5D2BC]/40 rounded bg-white text-xs font-sans font-bold uppercase tracking-widest hover:border-[#2A211C]"
              id="sort-trigger-btn"
            >
              <span>Sort: {activeSort.replace(/-/g, ' ')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Sort Dropdown Panel */}
            <AnimatePresence>
              {isSortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute right-0 top-[110%] w-48 bg-white border border-[#E5D2BC]/30 rounded-md shadow-xl z-50 overflow-hidden text-xs font-sans"
                >
                  <button onClick={() => handleSortChange('featured')} className={`w-full text-left px-4 py-2.5 hover:bg-[#F4E6D7]/30 transition-colors ${activeSort === 'featured' ? 'font-bold text-[#B08D57]' : ''}`}>Featured</button>
                  <button onClick={() => handleSortChange('new-arrivals')} className={`w-full text-left px-4 py-2.5 hover:bg-[#F4E6D7]/30 transition-colors ${activeSort === 'new-arrivals' ? 'font-bold text-[#B08D57]' : ''}`}>New Arrivals</button>
                  <button onClick={() => handleSortChange('best-selling')} className={`w-full text-left px-4 py-2.5 hover:bg-[#F4E6D7]/30 transition-colors ${activeSort === 'best-selling' ? 'font-bold text-[#B08D57]' : ''}`}>Best Selling</button>
                  <button onClick={() => handleSortChange('price-low-high')} className={`w-full text-left px-4 py-2.5 hover:bg-[#F4E6D7]/30 transition-colors ${activeSort === 'price-low-high' ? 'font-bold text-[#B08D57]' : ''}`}>Price: Low to High</button>
                  <button onClick={() => handleSortChange('price-high-low')} className={`w-full text-left px-4 py-2.5 hover:bg-[#F4E6D7]/30 transition-colors ${activeSort === 'price-high-low' ? 'font-bold text-[#B08D57]' : ''}`}>Price: High to Low</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Selected Filter Chips Row */}
      {(activeSubCats.length + activeColors.length + activeSizes.length + activeFits.length + activePatterns.length + activeSleeves.length + activeCollars.length + activeFabrics.length + (priceMax < 5000 ? 1 : 0)) > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-[#F4E6D7]/10 p-3 rounded border border-[#E5D2BC]/20 text-xs font-sans">
          <span className="font-bold text-[#2A211C]/60 uppercase tracking-widest text-[10px]">Active Filters:</span>
          
          {/* Render category chips */}
          {activeSubCats.map(sub => (
            <span key={sub} className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>{sub.replace(/-/g, ' ')}</span>
              <button onClick={() => toggleFilterValue('subcategory', sub, activeSubCats)} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {/* Render colors */}
          {activeColors.map(col => (
            <span key={col} className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>{col}</span>
              <button onClick={() => toggleFilterValue('color', col, activeColors)} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {/* Render sizes */}
          {activeSizes.map(sz => (
            <span key={sz} className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>Size: {sz}</span>
              <button onClick={() => toggleFilterValue('size', sz, activeSizes)} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {/* Render fits */}
          {activeFits.map(f => (
            <span key={f} className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>{f} Fit</span>
              <button onClick={() => toggleFilterValue('fit', f, activeFits)} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {/* Render patterns */}
          {activePatterns.map(pat => (
            <span key={pat} className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>{pat}</span>
              <button onClick={() => toggleFilterValue('pattern', pat, activePatterns)} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          ))}

          {/* Price Max */}
          {priceMax < 5000 && (
            <span className="bg-white border border-[#E5D2BC]/40 text-stone-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
              <span>Under ₹{priceMax}</span>
              <button onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('pricemax');
                setSearchParams(newParams);
              }} className="hover:text-red-600 font-bold"><X className="w-3 h-3" /></button>
            </span>
          )}

          <button
            onClick={handleClearAll}
            className="text-[10px] text-[#B08D57] font-bold uppercase tracking-wider hover:underline ml-2"
            id="clear-all-filters-btn"
          >
            Clear All
          </button>
        </div>
      )}

      {/* d) Product Grid listing */}
      {routeInfo.isComingSoon && filteredProducts.length === 0 ? (
        <div className="bg-white/80 border border-[#E5D2BC]/30 rounded-xl p-8 md:p-16 text-center space-y-6 shadow-sm my-6">
          <div className="w-16 h-16 bg-[#F4E6D7]/30 text-[#B08D57] flex items-center justify-center rounded-full mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <span className="text-[11px] font-sans font-bold tracking-[0.2em] text-[#B08D57] uppercase">Coming Soon</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">{routeInfo.h1} — Coming Soon</h2>
            <p className="font-sans text-xs md:text-sm text-[#2A211C]/70 leading-relaxed pt-2">
              {routeInfo.filterProductType === 'dresses' && (
                "Our dresses collection is currently in the works. Check back soon or explore our other categories."
              )}
              {routeInfo.filterProductType === 'shorts-skirts' && (
                "Our shorts and skirts collection for warm-weather styling is currently in the works."
              )}
              {routeInfo.filterProductType === 'co-ord-sets' && (
                "Matching top and bottom co-ord sets are being curated for effortless styling."
              )}
              {routeInfo.filterProductType === 'jackets' && (
                "Our jackets and layering pieces are currently in the works."
              )}
              {routeInfo.filterProductType === 'bags-pouches' && (
                "Our bags and pouches collection is currently in the works."
              )}
              {!['dresses', 'shorts-skirts', 'co-ord-sets', 'jackets', 'bags-pouches'].includes(routeInfo.filterProductType || '') && (
                "This category is currently being prepared. Explore our other categories below."
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/shop/all"
              className="w-full sm:w-auto bg-[#2A211C] hover:bg-[#B08D57] text-[#FBF6EE] font-sans font-bold text-xs uppercase tracking-widest py-3 px-6 rounded transition-colors"
            >
              Shop All Products
            </Link>
            <Link
              to="/shop/new-arrivals"
              className="w-full sm:w-auto bg-transparent hover:bg-[#2A211C]/5 text-[#2A211C] font-sans font-bold text-xs uppercase tracking-widest py-3 px-6 rounded border border-[#2A211C]/30 transition-colors"
            >
              New Arrivals
            </Link>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-[#E5D2BC]/40 rounded-xl bg-[#F4E6D7]/5">
          <Info className="w-10 h-10 text-[#E5D2BC] mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-[#2A211C]">No Results Found</h3>
          <p className="font-sans text-xs text-[#2A211C]/60 mt-1 max-w-sm mx-auto leading-normal">
            We couldn’t find any items matching your filter specifications. Try broadening your criteria or resetting filters.
          </p>
          <button
            onClick={handleClearAll}
            className="bg-[#2A211C] text-[#FBF6EE] hover:bg-[#B08D57] transition-colors py-2 px-5 mt-5 text-xs font-sans font-semibold uppercase tracking-wider rounded"
            id="reset-filter-no-results-btn"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Grid layout depending on density */}
          <div
            className={`grid gap-6 ${
              gridDensity === 'double'
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}
          >
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Load More buttons pagination */}
          {visibleCount < filteredProducts.length && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 border border-[#E5D2BC] hover:bg-[#2A211C] hover:text-[#FBF6EE] px-8 py-3.5 rounded font-sans font-bold text-xs uppercase tracking-widest transition-all text-[#2A211C] bg-white disabled:opacity-50"
                id="load-more-btn"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B08D57]" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Products</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* e) Below the grid: Collapsible SEO & FAQ Footer section */}
      <section className="border-t border-[#E5D2BC]/20 pt-10 mt-16 space-y-6">
        <div className="flex justify-between items-baseline">
          <h3 className="font-serif text-lg font-bold text-[#2A211C]">About our {currentCategory.name}</h3>
          <button
            onClick={() => setIsSeoExpanded(!isSeoExpanded)}
            className="text-xs font-sans font-bold text-[#B08D57] uppercase tracking-wider hover:underline"
            id="expand-seo-btn"
          >
            {isSeoExpanded ? 'Read Less' : 'Read More'}
          </button>
        </div>

        <AnimatePresence>
          {isSeoExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-10 text-xs md:text-sm text-[#2A211C]/70 leading-relaxed font-medium"
            >
              {/* Category description */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-sm text-[#2A211C]">{currentSeo.title}</h4>
                <p>{currentSeo.description}</p>
              </div>

              {/* Comparison table */}
              <div className="space-y-4">
                <h4 className="font-serif font-bold text-sm text-[#2A211C]">{currentSeo.comparisonTitle}</h4>
                <p>{currentSeo.comparisonText}</p>
                <div className="overflow-x-auto rounded-lg border border-[#E5D2BC]/30 shadow-sm">
                  <table className="w-full text-left font-sans text-[11px] md:text-xs">
                    <thead>
                      <tr className="bg-[#F4E6D7]/30 text-[#2A211C] font-bold border-b border-[#E5D2BC]/30">
                        <th className="p-3">Characteristic</th>
                        <th className="p-3">Sa and Sha Blend</th>
                        <th className="p-3">Standard Mall Fabrics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5D2BC]/20 bg-white">
                      <tr>
                        <td className="p-3 font-semibold text-[#2A211C]">Breathability</td>
                        <td className="p-3">Natural fibers keep you cool and comfortable all day.</td>
                        <td className="p-3">Synthetic solid fibers trap body heat and humidity.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-[#2A211C]">Durability</td>
                        <td className="p-3">Strengthens with washings, organic luster becomes buttery and smooth.</td>
                        <td className="p-3">Pills, stretches, and loses shape after multiple washes.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-[#2A211C]">Pre-Shrinkage</td>
                        <td className="p-3">Garment-washed and pre-shrunk for exact sizing confidence.</td>
                        <td className="p-3">Shrinks up to 5% on first cold water wash.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category FAQ accordion */}
              <div className="space-y-3">
                <h4 className="font-serif font-bold text-sm text-[#2A211C] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#B08D57]" />
                  <span>Frequently Asked Questions</span>
                </h4>
                <div className="divide-y divide-[#E5D2BC]/20 border-t border-b border-[#E5D2BC]/20">
                  {currentFAQs.map((faq, idx) => (
                    <div key={idx} className="py-3">
                      <button
                        onClick={() => toggleFAQ(idx)}
                        className="w-full flex justify-between items-center text-left font-sans text-xs md:text-sm font-semibold text-[#2A211C] hover:text-[#B08D57]"
                        id={`faq-btn-${idx}`}
                      >
                        <span>{faq.q}</span>
                        {faqExpanded[idx] ? <ChevronUp className="w-4 h-4 text-[#E5D2BC]" /> : <ChevronDown className="w-4 h-4 text-[#E5D2BC]" />}
                      </button>
                      <AnimatePresence>
                        {faqExpanded[idx] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden font-sans text-[11px] md:text-xs text-[#2A211C]/60 leading-relaxed mt-2"
                          >
                            {faq.a}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* f) Slide-in Filter Drawer (Slide from left on desktop/tablet, bottom on mobile) */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed left-0 top-0 bottom-0 w-full max-w-sm bg-[#FBF6EE] z-50 shadow-2xl flex flex-col border-r border-[#E5D2BC]/30"
              id="filter-drawer-panel"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#E5D2BC]/30 flex justify-between items-center bg-[#2A211C] text-[#FBF6EE]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#E5D2BC]" />
                  <span className="font-sans font-bold uppercase tracking-widest text-xs">Filter Collections</span>
                </div>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white"
                  id="close-filters-drawer-btn"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Collapsible Groups scrollable list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-[#2A211C]">
                
                {/* 1. Subcategory filter */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('subCategory')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Sub Category</span>
                    {expandedFilters.subCategory ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.subCategory && (
                    <div className="space-y-2 pl-1">
                      {subCategoryOptions.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeSubCats.includes(opt.id)}
                            onChange={() => toggleFilterValue('subcategory', opt.id, activeSubCats)}
                            className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                          />
                          <span className="font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Color swatches */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('color')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Color Swatch</span>
                    {expandedFilters.color ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.color && (
                    <div className="flex flex-wrap gap-2 pl-1">
                      {colorOptions.map(col => {
                        const isSel = activeColors.includes(col.name);
                        return (
                          <button
                            key={col.name}
                            onClick={() => toggleFilterValue('color', col.name, activeColors)}
                            className={`px-2.5 py-1.5 rounded-md border text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${
                              isSel ? 'border-[#B08D57] bg-white ring-1 ring-[#B08D57]' : 'border-[#E5D2BC]/30 bg-white hover:border-[#2A211C]'
                            }`}
                            id={`color-swatch-filter-${col.name.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: col.hex }} />
                            <span>{col.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Price slider range */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('price')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Price Range</span>
                    {expandedFilters.price ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.price && (
                    <div className="space-y-3 px-1">
                      <div className="flex justify-between text-xs font-sans font-bold">
                        <span>₹1,500</span>
                        <span>₹{priceMax.toLocaleString('en-IN')}</span>
                      </div>
                      <input
                        type="range"
                        min="1500"
                        max="5000"
                        step="100"
                        value={priceMax}
                        onChange={handlePriceChange}
                        className="w-full accent-[#B08D57] h-1.5 bg-[#F4E6D7] rounded-lg cursor-pointer"
                        id="price-range-slider"
                      />
                      <span className="text-[10px] font-sans text-[#2A211C]/60 leading-none">Max Limit: ₹5,000</span>
                    </div>
                  )}
                </div>

                {/* 4. Sizes chips */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('size')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Sizes</span>
                    {expandedFilters.size ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.size && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {sizeOptions.map(sz => {
                        const isSel = activeSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            onClick={() => toggleFilterValue('size', sz, activeSizes)}
                            className={`w-9 h-9 text-[11px] font-sans font-bold rounded border flex items-center justify-center transition-all ${
                              isSel ? 'bg-[#2A211C] text-[#FBF6EE] border-[#2A211C] font-extrabold shadow' : 'bg-white text-[#2A211C] border-[#E5D2BC]/30 hover:border-[#2A211C]'
                            }`}
                            id={`size-filter-btn-${sz}`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Fits selection */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('fit')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Fits</span>
                    {expandedFilters.fit ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.fit && (
                    <div className="space-y-2 pl-1">
                      {['Slim', 'Regular', 'Relaxed'].map(f => (
                        <label key={f} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeFits.includes(f)}
                            onChange={() => toggleFilterValue('fit', f, activeFits)}
                            className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                          />
                          <span className="font-medium">{f} Fit</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Pattern */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('pattern')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Patterns</span>
                    {expandedFilters.pattern ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.pattern && (
                    <div className="space-y-2 pl-1">
                      {['Solid', 'Striped', 'Printed', 'Checked'].map(pat => (
                        <label key={pat} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activePatterns.includes(pat)}
                            onChange={() => toggleFilterValue('pattern', pat, activePatterns)}
                            className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                          />
                          <span className="font-medium">{pat}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7. Sleeve (Shirts only) */}
                {(currentCategory.isShirts) && (
                  <div className="border-b border-[#E5D2BC]/20 pb-4">
                    <button
                      onClick={() => toggleAccordion('sleeve')}
                      className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                    >
                      <span>Sleeves</span>
                      {expandedFilters.sleeve ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                    </button>
                    {expandedFilters.sleeve && (
                      <div className="space-y-2 pl-1">
                        {['Full Sleeve', 'Half Sleeve'].map(sl => (
                          <label key={sl} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeSleeves.includes(sl)}
                              onChange={() => toggleFilterValue('sleeve', sl, activeSleeves)}
                              className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                            />
                            <span className="font-medium">{sl}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Collar (Shirts only) */}
                {(currentCategory.isShirts) && (
                  <div className="border-b border-[#E5D2BC]/20 pb-4">
                    <button
                      onClick={() => toggleAccordion('collar')}
                      className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                    >
                      <span>Collars</span>
                      {expandedFilters.collar ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                    </button>
                    {expandedFilters.collar && (
                      <div className="space-y-2 pl-1">
                        {['Spread', 'Cutaway', 'Mandarin'].map(cl => (
                          <label key={cl} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeCollars.includes(cl)}
                              onChange={() => toggleFilterValue('collar', cl, activeCollars)}
                              className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                            />
                            <span className="font-medium">{cl}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 9. Fabric blend */}
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <button
                    onClick={() => toggleAccordion('fabric')}
                    className="w-full flex justify-between items-center font-sans text-xs font-bold uppercase tracking-widest mb-3"
                  >
                    <span>Fabrics</span>
                    {expandedFilters.fabric ? <ChevronUp className="w-3.5 h-3.5 text-[#E5D2BC]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#E5D2BC]" />}
                  </button>
                  {expandedFilters.fabric && (
                    <div className="space-y-2 pl-1">
                      {fabricOptions.map(fb => (
                        <label key={fb} className="flex items-center gap-2.5 text-xs font-sans cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeFabrics.includes(fb)}
                            onChange={() => toggleFilterValue('fabric', fb, activeFabrics)}
                            className="rounded border-[#E5D2BC] text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                          />
                          <span className="font-medium">{fb}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Apply Drawer Action button */}
              <div className="p-4 border-t border-[#E5D2BC]/30 bg-white grid grid-cols-2 gap-3.5">
                <button
                  onClick={handleClearAll}
                  className="py-3 border border-[#E5D2BC] text-[#2A211C] rounded text-xs font-sans font-bold uppercase tracking-widest hover:bg-[#2A211C]/5"
                  id="drawer-clear-all-btn"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="py-3 bg-[#2A211C] text-[#FBF6EE] hover:bg-[#B08D57] transition-colors rounded text-xs font-sans font-bold uppercase tracking-widest"
                  id="drawer-apply-filters-btn"
                >
                  Apply Filters ({filteredProducts.length})
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};
