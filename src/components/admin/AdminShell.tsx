import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu, RefreshCw, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

interface AdminShellProps {
  brandName: string;
  accentColor: string;
  navSections: AdminNavSection[];
  activeTab: string;
  onTabChange: (key: string) => void;
  pageLabel: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onLogout: () => void;
  children: ReactNode;
}

// The shared admin layout shell — sidebar nav + top bar — used identically
// (down to the class names) by sa-and-sha.com and koralinen.com's admin
// panels, so the two feel like one system despite being separate
// codebases. Only the brand name/accent color/nav copy differ per site;
// everything inside a tab's content is untouched by this redesign.
export function AdminShell({
  brandName,
  accentColor,
  navSections,
  activeTab,
  onTabChange,
  pageLabel,
  onRefresh,
  isRefreshing,
  onLogout,
  children
}: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-stone-100">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-serif font-bold text-sm"
          style={{ backgroundColor: accentColor }}
        >
          {brandName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-sm font-bold text-stone-800 leading-tight truncate">{brandName}</p>
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-sans">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 font-sans">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onTabChange(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide font-sans transition-colors cursor-pointer ${
                      isActive ? 'text-white' : 'text-stone-600 hover:bg-stone-50'
                    }`}
                    style={isActive ? { backgroundColor: accentColor } : undefined}
                    id={`admin-tab-${item.key}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-100 p-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide font-sans text-stone-500 hover:bg-stone-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 flex" id="admin-root-container">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-stone-200 bg-white">{sidebarContent}</aside>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative w-72 bg-white shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 -ml-2 text-stone-500 cursor-pointer"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-stone-400 text-[10px] tracking-wider uppercase font-sans font-bold">
                <span>Admin Console</span>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
                <span style={{ color: accentColor }}>Live Session</span>
              </div>
              <h1 className="font-serif text-lg sm:text-xl font-bold text-stone-800 truncate">{pageLabel}</h1>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="shrink-0 p-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        <main className="flex-1 overflow-x-hidden px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
