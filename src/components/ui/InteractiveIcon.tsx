/**
 * InteractiveIcon — Runtime component that wires icons to their intended behavior.
 *
 * Resolves an icon's intent from the Icon Intent Registry and renders
 * the appropriate interactive UI (inline search field, cart drawer,
 * user dropdown, etc.) based on placement context.
 *
 * Usage in generated components:
 * ```tsx
 * <InteractiveIcon iconKey="search" placement="navbar" />
 * <InteractiveIcon iconKey="cart" placement="navbar" badgeCount={cartCount} />
 * <InteractiveIcon iconKey="user" placement="navbar" />
 * ```
 *
 * The icon renders its Lucide icon and manages its own interactive state
 * (expanded, collapsed, etc.) — components don't need to implement behavior.
 */

import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { TemplateRuntimeContext } from '@/runtime/TemplateRuntimeProvider';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type IconPlacement,
  type IconUIBehavior,
  resolveIconBinding,
  getIconDefinition,
} from '@/platform/core/iconIntentRegistry';

// ============================================================================
// Props
// ============================================================================

export interface InteractiveIconProps {
  /** Icon key from the registry (e.g., 'search', 'cart', 'user') */
  iconKey: string;
  /** Where the icon is placed — determines inline vs overlay behavior */
  placement?: IconPlacement;
  /** Page role for slot key generation */
  pageRole?: string;
  /** Section for slot key generation */
  section?: string;
  /** Badge count (e.g., cart items, notifications) */
  badgeCount?: number;
  /** Icon size */
  size?: number;
  /** Additional class names */
  className?: string;
  /** Custom onClick override (bypasses default behavior) */
  onClick?: () => void;
  /** Nav items for mobile menu */
  navItems?: Array<{ label: string; href: string }>;
  /** User state for account menu */
  user?: { name?: string; email?: string } | null;
  /** Callback for auth actions */
  onAuthAction?: (action: 'login' | 'signup' | 'logout') => void;
  /** Callback for search */
  onSearch?: (query: string) => void;
  /** Callback for filter changes */
  onFilter?: (filters: Record<string, unknown>) => void;
  /** Callback for sort changes */
  onSort?: (sortKey: string) => void;
  /** Callback for theme toggle */
  onThemeToggle?: () => void;
  /** Callback for favorite toggle */
  onFavoriteToggle?: (isFavorite: boolean) => void;
  /** Current theme for theme toggle */
  currentTheme?: 'light' | 'dark';
}

// ============================================================================
// Component
// ============================================================================

export function InteractiveIcon({
  iconKey,
  placement = 'navbar',
  pageRole = 'home',
  section = 'navbar',
  size = 20,
  className,
  badgeCount,
  onClick,
  navItems,
  user,
  onAuthAction,
  onSearch,
  onFilter,
  onSort,
  onThemeToggle,
  onFavoriteToggle,
  currentTheme,
}: InteractiveIconProps) {
  const runtime = useContext(TemplateRuntimeContext);
  const count = badgeCount ?? (iconKey === 'cart' ? runtime?.cartItemCount : 0) ?? 0;
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isFavorited, setIsFavorited] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const binding = resolveIconBinding(pageRole, section, iconKey, placement);
  const def = getIconDefinition(iconKey);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && iconKey === 'search' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, iconKey]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    if (iconKey === 'cart' && runtime) {
      void runtime.executeIntent('cart.view');
      return;
    }

    // State-toggle icons don't need open/close
    if (binding?.uiBehavior === 'state-toggle') {
      if (iconKey === 'theme') {
        onThemeToggle?.();
      } else if (iconKey === 'favorite') {
        const next = !isFavorited;
        setIsFavorited(next);
        onFavoriteToggle?.(next);
      } else if (iconKey === 'copy') {
        // Copy handled by parent
      }
      return;
    }

    setIsOpen(prev => !prev);
  }, [onClick, binding, iconKey, isFavorited, onThemeToggle, onFavoriteToggle, runtime]);

  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchValue.trim()) {
      onSearch?.(searchValue.trim());
    }
  }, [searchValue, onSearch]);

  if (!def || !binding) return null;

  // Resolve Lucide icon component
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<LucideIcons.LucideProps>>)[def.lucideIcon];
  if (!IconComponent) return null;

  // For theme toggle, swap icon based on current theme
  const ThemeIcon = iconKey === 'theme' && currentTheme === 'dark'
    ? (LucideIcons as unknown as Record<string, React.ComponentType<LucideIcons.LucideProps>>)['Moon']
    : IconComponent;
  const ActualIcon = iconKey === 'theme' ? (ThemeIcon || IconComponent) : IconComponent;

  // For favorite, swap to filled heart
  const FavIcon = iconKey === 'favorite' && isFavorited
    ? IconComponent
    : IconComponent;

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      {...binding.dataAttributes}
    >
      {/* Icon Button */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={def.ariaLabel}
        aria-expanded={isOpen}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md p-2',
          'text-foreground/70 hover:text-foreground hover:bg-accent/50',
          'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isOpen && 'text-foreground bg-accent/50',
          className,
        )}
      >
        {iconKey === 'favorite' ? (
          <FavIcon
            size={size}
            fill={isFavorited ? 'currentColor' : 'none'}
            className={cn(isFavorited && 'text-destructive')}
          />
        ) : (
          <ActualIcon size={size} />
        )}

        {/* Badge */}
        {def.hasBadge && count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Interactive UI — rendered based on behavior + component type */}
      {/* eslint-disable-next-line react-hooks/refs -- inputRef is only forwarded to a ref={} prop, never read here */}
      {isOpen && renderInteractiveUI({
        iconKey,
        behavior: binding.uiBehavior,
        component: binding.interactiveComponent,
        searchValue,
        setSearchValue,
        onSearchSubmit: handleSearchSubmit,
        inputRef,
        navItems,
        user,
        onAuthAction,
        onFilter,
        onSort,
        onClose: () => setIsOpen(false),
      })}
    </div>
  );
}

// ============================================================================
// Interactive UI Renderer
// ============================================================================

interface InteractiveUIProps {
  iconKey: string;
  behavior: IconUIBehavior;
  component: string;
  searchValue: string;
  setSearchValue: (v: string) => void;
  onSearchSubmit: (e?: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  navItems?: Array<{ label: string; href: string }>;
  user?: { name?: string; email?: string } | null;
  onAuthAction?: (action: 'login' | 'signup' | 'logout') => void;
  onFilter?: (filters: Record<string, unknown>) => void;
  onSort?: (sortKey: string) => void;
  onClose: () => void;
}

function renderInteractiveUI(props: InteractiveUIProps): React.ReactNode {
  const { iconKey, behavior, component } = props;

  // Inline-expand renders next to the icon
  if (behavior === 'inline-expand') {
    return renderInlineUI(props);
  }

  // Dropdown renders below the icon
  if (behavior === 'dropdown') {
    return renderDropdownUI(props);
  }

  // Overlay renders as a panel/drawer
  if (behavior === 'overlay') {
    return renderOverlayUI(props);
  }

  return null;
}

function renderInlineUI(props: InteractiveUIProps): React.ReactNode {
  if (props.component === 'search-field') {
    return (
      <form
        onSubmit={props.onSearchSubmit}
        className="absolute right-full mr-2 top-1/2 -translate-y-1/2 flex items-center animate-in slide-in-from-right-4 fade-in duration-200"
      >
        <div className="flex items-center rounded-full border border-border bg-background shadow-lg">
          <input
            ref={props.inputRef}
            type="text"
            value={props.searchValue}
            onChange={(e) => props.setSearchValue(e.target.value)}
            placeholder="Search..."
            className="w-48 rounded-l-full bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-r-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LucideIcons.ArrowRight size={16} />
          </button>
        </div>
      </form>
    );
  }

  if (props.component === 'filter-panel') {
    return (
      <div className="absolute top-full left-0 mt-2 w-64 rounded-lg border border-border bg-background p-4 shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Filters</span>
          <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground">
            <LucideIcons.X size={14} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <select className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
              <option>All</option>
              <option>Featured</option>
              <option>New</option>
              <option>Sale</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price Range</label>
            <select className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
              <option>Any</option>
              <option>Under $25</option>
              <option>$25 - $50</option>
              <option>$50 - $100</option>
              <option>$100+</option>
            </select>
          </div>
          <button
            onClick={() => { props.onFilter?.({}); props.onClose(); }}
            className="w-full rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function renderDropdownUI(props: InteractiveUIProps): React.ReactNode {
  if (props.component === 'user-menu') {
    return (
      <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50">
        {props.user ? (
          <div className="py-1">
            <div className="px-4 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">{props.user.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{props.user.email}</p>
            </div>
            <button
              onClick={() => { props.onAuthAction?.('logout'); props.onClose(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              <LucideIcons.LogOut size={14} />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="py-1">
            <button
              onClick={() => { props.onAuthAction?.('login'); props.onClose(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              <LucideIcons.LogIn size={14} />
              Sign In
            </button>
            <button
              onClick={() => { props.onAuthAction?.('signup'); props.onClose(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              <LucideIcons.UserPlus size={14} />
              Create Account
            </button>
          </div>
        )}
      </div>
    );
  }

  if (props.component === 'sort-dropdown') {
    const sortOptions = [
      { key: 'featured', label: 'Featured' },
      { key: 'price-asc', label: 'Price: Low to High' },
      { key: 'price-desc', label: 'Price: High to Low' },
      { key: 'newest', label: 'Newest' },
      { key: 'name-asc', label: 'Name: A-Z' },
    ];
    return (
      <div className="absolute top-full right-0 mt-2 w-44 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50 py-1">
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => { props.onSort?.(opt.key); props.onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (props.component === 'notification-panel') {
    return (
      <div className="absolute top-full right-0 mt-2 w-72 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50">
        <div className="p-4 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
        </div>
        <div className="p-8 text-center">
          <LucideIcons.Bell size={24} className="mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No new notifications</p>
        </div>
      </div>
    );
  }

  if (props.component === 'settings-menu') {
    return (
      <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50 py-1">
        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors">
          <LucideIcons.User size={14} /> Profile
        </button>
        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors">
          <LucideIcons.Settings size={14} /> Preferences
        </button>
        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors">
          <LucideIcons.HelpCircle size={14} /> Help
        </button>
      </div>
    );
  }

  if (props.component === 'language-picker') {
    const languages = [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
      { code: 'de', label: 'Deutsch' },
    ];
    return (
      <div className="absolute top-full right-0 mt-2 w-36 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50 py-1">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={props.onClose}
            className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
          >
            {lang.label}
          </button>
        ))}
      </div>
    );
  }

  return null;
}

function renderOverlayUI(props: InteractiveUIProps): React.ReactNode {
  if (props.component === 'mobile-menu') {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={props.onClose}
        />
        {/* Drawer */}
        <div className="fixed top-0 right-0 bottom-0 w-72 bg-background border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Menu</span>
            <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground p-1">
              <LucideIcons.X size={18} />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {(props.navItems ?? [
              { label: 'Home', href: '/' },
              { label: 'About', href: '/about' },
              { label: 'Services', href: '/services' },
              { label: 'Contact', href: '/contact' },
            ]).map(item => (
              <a
                key={item.href}
                href={`#${item.href}`}
                onClick={props.onClose}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </>
    );
  }

  if (props.component === 'cart-drawer') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={props.onClose}
        />
        <div className="fixed top-0 right-0 bottom-0 w-80 bg-background border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Shopping Cart</span>
            <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground p-1">
              <LucideIcons.X size={18} />
            </button>
          </div>
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
            <LucideIcons.ShoppingCart size={32} className="text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Your cart is empty</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add items to get started</p>
          </div>
          <div className="p-4 border-t border-border">
            <button
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled
            >
              Checkout
            </button>
          </div>
        </div>
      </>
    );
  }

  if (props.component === 'search-field') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={props.onClose}
        />
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-in slide-in-from-top-4 fade-in duration-200">
          <form
            onSubmit={props.onSearchSubmit}
            className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
          >
            <div className="flex items-center px-4">
              <LucideIcons.Search size={18} className="text-muted-foreground" />
              <input
                ref={props.inputRef}
                type="text"
                value={props.searchValue}
                onChange={(e) => props.setSearchValue(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent px-3 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={props.onClose}
                className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5"
              >
                ESC
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  if (props.component === 'share-sheet') {
    const shareOptions = [
      { icon: LucideIcons.Copy, label: 'Copy Link' },
      { icon: LucideIcons.Twitter, label: 'Twitter' },
      { icon: LucideIcons.Facebook, label: 'Facebook' },
      { icon: LucideIcons.Linkedin, label: 'LinkedIn' },
      { icon: LucideIcons.Mail, label: 'Email' },
    ];
    return (
      <div className="absolute top-full right-0 mt-2 w-44 rounded-lg border border-border bg-background shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 z-50 py-1">
        {shareOptions.map(opt => (
          <button
            key={opt.label}
            onClick={props.onClose}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
          >
            <opt.icon size={14} />
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (props.component === 'chat-widget') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={props.onClose}
        />
        <div className="fixed bottom-4 right-4 w-80 h-96 rounded-xl border border-border bg-background shadow-2xl z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Chat with us</span>
            <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground p-1">
              <LucideIcons.X size={16} />
            </button>
          </div>
          <div className="flex-1 p-4 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Send us a message and we'll get back to you shortly.
            </p>
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 transition-colors">
              <LucideIcons.Send size={14} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}

export default InteractiveIcon;
