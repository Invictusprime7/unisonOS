import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import type { CTAButton, NavLink } from '../../types';

interface MobileNavbarNavigationProps {
  brand: string;
  links: NavLink[];
  cta?: CTAButton;
  tone?: 'light' | 'dark';
}

export function MobileNavbarNavigation({ brand, links, cta, tone = 'light' }: MobileNavbarNavigationProps) {
  const [open, setOpen] = useState(false);
  const isDark = tone === 'dark';
  const shellClass = isDark ? 'bg-foreground text-background' : 'bg-background text-foreground';
  const buttonClass = isDark
    ? 'border-background/30 bg-foreground text-background'
    : 'border-border bg-background text-foreground';

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [open]);

  return (
    <div data-ut-mobile-navigation="radix" className={`flex min-h-[var(--ut-nav-block)] items-center gap-4 px-6 lg:hidden ${shellClass}`}>
      <a data-ut-intent="nav.goto" href="#/" className="min-w-0 flex-1 overflow-wrap-anywhere font-serif text-xl font-[number:var(--ut-weight-display)] no-underline">{brand}</a>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button type="button" aria-label="Open navigation" className={`inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border ${buttonClass}`}><Menu aria-hidden="true" size={20} /></button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-foreground/45" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-[101] w-full max-w-sm overflow-y-auto bg-background p-6 text-foreground">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Dialog.Title className="min-w-0 overflow-wrap-anywhere font-serif text-2xl font-[number:var(--ut-weight-display)]">Navigation</Dialog.Title>
              <Dialog.Close asChild><button type="button" aria-label="Close navigation" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border bg-background text-foreground"><X aria-hidden="true" size={20} /></button></Dialog.Close>
            </div>
            <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
              {links.map((link, index) => <Dialog.Close asChild key={index}><a href={link.href || '#'} data-ut-intent={link.intent ?? 'nav.goto'} className="min-h-11 rounded-[var(--radius)] px-3 py-3 font-sans text-foreground no-underline hover:bg-muted">{link.label}</a></Dialog.Close>)}
              {cta && <Dialog.Close asChild><a href={cta.href || '#'} data-ut-intent={cta.intent ?? 'nav.goto'} data-ut-cta="cta.nav" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-primary px-4 py-2 font-sans font-semibold text-primary-foreground no-underline">{cta.label}</a></Dialog.Close>}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}