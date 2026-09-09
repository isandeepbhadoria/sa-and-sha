import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export const AboutPage: React.FC = () => {
  useSEO({
    title: 'About Sa and Sha | Ladies Apparel',
    description: 'Discover Sa and Sha and our approach to everyday elegance, quality fabrics, thoughtful design, and timeless style.',
    canonical: 'https://www.sa-and-sha.com/about',
    noindex: false,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://www.sa-and-sha.com'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'About Sa and Sha',
          'item': 'https://www.sa-and-sha.com/about'
        }
      ]
    }
  });

  return (
    <div className="bg-[#FBF6EE] text-[#2A211C] min-h-screen" id="about-page">

      {/* Container wrapper */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-16 md:space-y-24">

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs font-sans text-stone-500 flex items-center gap-2">
          <Link to="/" className="hover:text-[#B08D57] transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3 text-stone-400" />
          <span className="text-[#2A211C] font-medium">About Sa and Sha</span>
        </nav>

        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-3xl mx-auto pt-2" id="about-hero">
          <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase block">
            ABOUT SA AND SHA
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#2A211C] leading-[1.15]">
            Effortless Elegance, Everyday
          </h1>
          <p className="font-sans text-sm md:text-base text-stone-600 leading-relaxed max-w-2xl mx-auto">
            Sa and Sha is a ladies apparel label shaped by an appreciation for quality fabrics, thoughtful design and effortless dressing. We create clothing that feels considered yet uncomplicated — pieces designed to bring comfort, character and quiet confidence to everyday life.
          </p>
        </section>

        {/* Feature Editorial Image Banner */}
        <div className="relative rounded-xl overflow-hidden border border-[#E5D2BC]/30 shadow-sm aspect-[16/9] md:aspect-[21/9] bg-[#F4E6D7]">
          <img
            src="https://images.unsplash.com/photo-1495385794356-15371f348c31?w=1600&auto=format&fit=crop&q=80"
            alt="Sa and Sha editorial"
            className="w-full h-full object-cover"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end p-6 md:p-10">
            <span className="text-xs md:text-sm font-serif italic text-white/90 tracking-wide">
              Considered fits, quality fabrics & timeless style.
            </span>
          </div>
        </div>

        {/* Brand Story Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center" id="brand-story">
          <div className="md:col-span-5 space-y-3">
            <span className="text-[10px] font-sans font-bold tracking-[0.2em] text-[#C98A82] uppercase">
              PHILOSOPHY
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
              The Sa and Sha Story
            </h2>
          </div>
          <div className="md:col-span-7 space-y-4 font-sans text-xs md:text-sm text-stone-700 leading-relaxed">
            <p>
              Our approach begins with a simple idea: the clothes we live in should feel as good as they look.
            </p>
            <p>
              Sa and Sha brings together quality fabrics, relaxed sophistication and contemporary silhouettes to create apparel that moves easily between everyday moments and considered occasions.
            </p>
            <p>
              Rather than designing around passing trends, we focus on pieces with an enduring character — clothing that is comfortable to wear, easy to style and made to remain relevant beyond a single season.
            </p>
          </div>
        </section>

        <hr className="border-[#E5D2BC]/30 my-0" />

        {/* Material Philosophy: Our Fabrics */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center" id="our-fabrics">
          <div className="md:col-span-6 order-2 md:order-1 space-y-4 font-sans text-xs md:text-sm text-stone-700 leading-relaxed">
            <span className="text-[10px] font-sans font-bold tracking-[0.2em] text-[#B08D57] uppercase block">
              MATERIAL
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
              Our Fabrics
            </h2>
            <p>
              We choose fabrics for how they feel, move, and hold up — cotton, linen-cotton blends, georgette, and more, each selected for the piece it's made for.
            </p>
            <p>
              Comfort and drape are part of the appeal — polished without feeling overly formal, and comfortable without sacrificing character.
            </p>
            <p>
              At Sa and Sha, this balance between ease and refinement informs the way we think about modern apparel.
            </p>
          </div>
          <div className="md:col-span-6 order-1 md:order-2">
            <div className="rounded-xl overflow-hidden border border-[#E5D2BC]/30 aspect-[4/3] bg-[#F4E6D7]">
              <img
                src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1000&auto=format&fit=crop&q=80"
                alt="Fabric and texture detail"
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </section>

        {/* Design Philosophy: Designed with Intention */}
        <section className="bg-white/80 p-8 md:p-12 rounded-xl border border-[#E5D2BC]/30 space-y-6 text-center max-w-4xl mx-auto" id="designed-with-intention">
          <span className="text-[10px] font-sans font-bold tracking-[0.2em] text-[#2A211C]/60 uppercase block">
            CRAFTSMANSHIP
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
            Designed with Intention
          </h2>
          <div className="space-y-4 font-sans text-xs md:text-sm text-stone-700 leading-relaxed max-w-2xl mx-auto">
            <p className="font-medium text-[#2A211C]">
              We believe good design is often found in restraint.
            </p>
            <p>
              Our collections focus on considered proportions, wearable silhouettes, thoughtful details and versatile colour stories. Each piece is approached with the intention of making dressing simpler while still feeling distinctive.
            </p>
            <p>
              The result is apparel designed to work naturally within a modern wardrobe — easy to wear on its own, easy to layer and easy to make your own.
            </p>
          </div>
        </section>

        {/* Three Brand Principles */}
        <section className="space-y-8" id="brand-principles">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-sans font-bold tracking-[0.2em] text-[#B08D57] uppercase">
              FOUNDATIONAL PILLARS
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
              Our Brand Principles
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 pt-4">

            <div className="p-6 md:p-8 bg-white/60 rounded-xl border border-[#E5D2BC]/30 space-y-3">
              <span className="font-serif text-2xl font-bold text-[#B08D57] block">01</span>
              <h3 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">
                Everyday Comfort
              </h3>
              <p className="font-sans text-xs md:text-sm text-stone-600 leading-relaxed">
                Quality fabrics and relaxed silhouettes form the foundation of clothing designed for everyday ease.
              </p>
            </div>

            <div className="p-6 md:p-8 bg-white/60 rounded-xl border border-[#E5D2BC]/30 space-y-3">
              <span className="font-serif text-2xl font-bold text-[#C98A82] block">02</span>
              <h3 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">
                Considered Design
              </h3>
              <p className="font-sans text-xs md:text-sm text-stone-600 leading-relaxed">
                Clean lines, thoughtful details and balanced proportions create pieces with a quiet, contemporary character.
              </p>
            </div>

            <div className="p-6 md:p-8 bg-white/60 rounded-xl border border-[#E5D2BC]/30 space-y-3">
              <span className="font-serif text-2xl font-bold text-[#2A211C]/70 block">03</span>
              <h3 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">
                Enduring Style
              </h3>
              <p className="font-sans text-xs md:text-sm text-stone-600 leading-relaxed">
                We favour versatility and timeless appeal over short-lived trends, creating apparel intended to remain relevant season after season.
              </p>
            </div>

          </div>
        </section>

        {/* Craft / Detail Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center" id="its-in-the-details">
          <div className="md:col-span-6">
            <div className="rounded-xl overflow-hidden border border-[#E5D2BC]/30 aspect-[4/3] bg-[#F4E6D7]">
              <img
                src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=1000&auto=format&fit=crop&q=80"
                alt="Garment detail and texture"
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="md:col-span-6 space-y-4 font-sans text-xs md:text-sm text-stone-700 leading-relaxed">
            <span className="text-[10px] font-sans font-bold tracking-[0.2em] text-[#C98A82] uppercase block">
              ATTENTION TO DETAIL
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
              It's in the Details
            </h2>
            <p>
              From the feel of the fabric to the balance of a silhouette, the smallest decisions shape the way a garment is experienced.
            </p>
            <p>
              We pay attention to the details that matter in everyday wear — proportion, texture, finishing, functionality and comfort — so that each piece feels considered without feeling overdesigned.
            </p>
          </div>
        </section>

        {/* Modern Wardrobe Section & CTA */}
        <section className="bg-white/80 p-8 md:p-12 rounded-xl border border-[#E5D2BC]/30 text-center space-y-6 max-w-3xl mx-auto" id="modern-wardrobe">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
            For the Modern Wardrobe
          </h2>
          <div className="space-y-3 font-sans text-xs md:text-sm text-stone-700 leading-relaxed max-w-xl mx-auto">
            <p>
              Sa and Sha is designed for a way of dressing that values ease without giving up refinement.
            </p>
            <p>
              From dresses and co-ord sets to everyday tops and trousers, our approach is to create pieces that transition naturally through the day — uncomplicated, comfortable and distinctly considered.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/shop/all"
              className="inline-flex items-center gap-2 bg-[#2A211C] hover:bg-[#B08D57] text-white font-sans font-bold text-xs uppercase tracking-[0.2em] px-7 py-3.5 rounded transition-colors"
              id="about-explore-cta"
            >
              <span>Explore the Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Closing Brand Statement */}
        <section className="text-center space-y-6 py-8 border-t border-b border-[#E5D2BC]/30" id="brand-closing">
          <div className="font-serif text-xl sm:text-2xl md:text-3xl italic text-[#2A211C] leading-relaxed max-w-lg mx-auto space-y-1">
            <p>Less complication.</p>
            <p>More character.</p>
            <p className="text-[#B08D57] not-italic font-bold pt-1">Clothing that feels naturally yours.</p>
          </div>
          <div className="font-sans text-xs font-bold tracking-[0.3em] uppercase text-stone-500 pt-2">
            SA AND SHA
          </div>
        </section>

      </div>
    </div>
  );
};
