import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, ShieldCheck } from 'lucide-react';
import { SaAndShaLogo } from './SaAndShaLogo';

export const Footer: React.FC = () => {
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
    setEmailInput('');
  };

  return (
    <footer id="global-footer" className="bg-[#2A211C] text-[#FBF6EE] pt-16 pb-8 border-t border-[#E5D2BC]/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Top footer row: columns & newsletters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-6 pb-12 border-b border-[#E5D2BC]/10">
          
          {/* Column 1: Brand Info */}
          <div className="space-y-4 sm:col-span-2 md:col-span-3 lg:col-span-1">
            <div className="pb-1">
              <SaAndShaLogo variant="horizontal" size="md" light={true} />
            </div>
            <p className="font-sans text-xs text-[#FBF6EE]/70 leading-relaxed max-w-sm">
              Sa and Sha is a ladies apparel brand designing dresses, tops, co-ord sets, and more for everyday elegance.
            </p>
            <div className="flex items-center gap-4 pt-2 text-[#FBF6EE]/60">
              <a
                href="https://www.instagram.com/_saandsha"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B08D57] transition-colors p-1 -m-1 focus:outline-none focus:text-[#B08D57]"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/saandsha"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B08D57] transition-colors p-1 -m-1 focus:outline-none focus:text-[#B08D57]"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://x.com/_saandsha"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B08D57] transition-colors p-1 -m-1 focus:outline-none focus:text-[#B08D57]"
                aria-label="X (Twitter)"
              >
                <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.pinterest.com/saandsha1"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B08D57] transition-colors p-1 -m-1 focus:outline-none focus:text-[#B08D57]"
                aria-label="Pinterest"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Categories */}
          <div>
            <h4 className="font-sans font-bold text-xs uppercase tracking-[0.15em] text-[#E5D2BC] mb-4">
              Categories
            </h4>
            <ul className="space-y-2 text-xs font-sans text-[#FBF6EE]/70">
              <li>
                <Link to="/shop/product/dresses" className="hover:text-white transition-colors">Dresses</Link>
              </li>
              <li>
                <Link to="/shop/product/tops-shirts" className="hover:text-white transition-colors">Top & Shirts</Link>
              </li>
              <li>
                <Link to="/shop/product/shorts-skirts" className="hover:text-white transition-colors">Shorts & Skirts</Link>
              </li>
              <li>
                <Link to="/shop/product/co-ord-sets" className="hover:text-white transition-colors">Co-Ord Sets</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: More Categories */}
          <div>
            <h4 className="font-sans font-bold text-xs uppercase tracking-[0.15em] text-[#E5D2BC] mb-4">
              More
            </h4>
            <ul className="space-y-2 text-xs font-sans text-[#FBF6EE]/70">
              <li>
                <Link to="/shop/product/trousers" className="hover:text-white transition-colors">Trousers</Link>
              </li>
              <li>
                <Link to="/shop/product/jackets" className="hover:text-white transition-colors">Jackets</Link>
              </li>
              <li>
                <Link to="/shop/product/bags-pouches" className="hover:text-white transition-colors">Bags & Pouches</Link>
              </li>
              <li>
                <Link to="/shop/new-arrivals" className="hover:text-white transition-colors">New Arrivals</Link>
              </li>
              <li>
                <Link to="/shop/bestsellers" className="hover:text-white transition-colors">Bestsellers</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Help Menu */}
          <div>
            <h4 className="font-sans font-bold text-xs uppercase tracking-[0.15em] text-[#E5D2BC] mb-4">
              Help & Info
            </h4>
            <ul className="space-y-2 text-xs font-sans text-[#FBF6EE]/70">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">About Sa and Sha</Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">FAQs & Care Guide</Link>
              </li>
              <li>
                <Link to="/shipping-delivery" className="hover:text-white transition-colors">Shipping & Delivery</Link>
              </li>
              <li>
                <Link to="/returns-exchanges" className="hover:text-white transition-colors">Returns & Exchanges</Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-white transition-colors text-[#E5D2BC] font-semibold">Customer Portal</Link>
              </li>
              <li>
                <Link to="/create-account" className="hover:text-white transition-colors font-medium">Create Account</Link>
              </li>
              <li>
                <Link to="/track-order" className="hover:text-white transition-colors">Track Order</Link>
              </li>
              <li>
                <Link to="/contact-support" className="hover:text-white transition-colors">Contact Support</Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="hover:text-white transition-colors">Terms & Conditions</Link>
              </li>
              <li className="pt-2 border-t border-white/5">
                <Link to="/admin" className="hover:text-white transition-colors opacity-60 hover:opacity-100 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-[#E5D2BC]">
                  <span>Admin Portal</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter Subscription */}
          <div className="space-y-4">
            <h4 className="font-sans font-bold text-xs uppercase tracking-[0.15em] text-[#E5D2BC]">
              Stay in Touch
            </h4>
            <p className="font-sans text-xs text-[#FBF6EE]/70 leading-normal">
              Subscribe for new arrivals, styling edits, and an automatic 10% off your first order.
            </p>
            {!subscribed ? (
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 w-4 h-4 text-[#FBF6EE]/40" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    className="w-full bg-[#FBF6EE]/10 text-xs text-[#FBF6EE] pl-9 pr-3 py-2.5 rounded border border-[#E5D2BC]/30 focus:outline-none focus:border-[#E5D2BC] placeholder-white/30"
                    id="newsletter-email"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-sans font-bold text-xs uppercase tracking-widest py-2.5 px-4 rounded transition-colors"
                  id="newsletter-subscribe-btn"
                >
                  Subscribe
                </button>
              </form>
            ) : (
              <div className="bg-[#C98A82]/10 p-3 rounded border border-[#C98A82]/30 flex items-center gap-2 text-xs text-[#8C9C8F] font-sans">
                <ShieldCheck className="w-5 h-5 text-[#C98A82]" />
                <span>Thank you! You're subscribed. Check your inbox for 10% off.</span>
              </div>
            )}
          </div>

        </div>

        {/* Bottom row: copyright and payment modes */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-sans text-[#FBF6EE]/50">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>&copy; {new Date().getFullYear()} Sa and Sha. All rights reserved.</span>
            <div className="flex items-center gap-3 text-[10px] text-[#E5D2BC]/80">
              <Link to="/privacy-policy" className="hover:text-white transition-colors underline underline-offset-2">Privacy Policy</Link>
              <span>•</span>
              <Link to="/terms-and-conditions" className="hover:text-white transition-colors underline underline-offset-2">Terms & Conditions</Link>
            </div>
          </div>
          
          {/* Payment Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-[#FBF6EE]/10 border border-white/5 font-semibold text-[9px] tracking-widest uppercase">VISA</span>
            <span className="px-2 py-1 rounded bg-[#FBF6EE]/10 border border-white/5 font-semibold text-[9px] tracking-widest uppercase">MASTERCARD</span>
            <span className="px-2 py-1 rounded bg-[#FBF6EE]/10 border border-white/5 font-semibold text-[9px] tracking-widest uppercase">AMEX</span>
            <span className="px-2 py-1 rounded bg-[#FBF6EE]/10 border border-white/5 font-semibold text-[9px] tracking-widest uppercase">UPI</span>
            <span className="px-2 py-1 rounded bg-[#FBF6EE]/10 border border-white/5 font-semibold text-[9px] tracking-widest uppercase">COD</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
