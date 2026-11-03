/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
  import * as Dialog from './radix/dialog';
  import { Menu, X } from './icons';
import { Button } from './button';
import { cn } from './cn';

export interface NavigationLink { label: string; href: string; intent?: string; }
const toNavigationHref = (href: string) => href.startsWith('/') ? '#' + href : href;

export function FloatingNavbar({ brand, links, ctaLabel, ctaIntent, className }: { brand: string; links: NavigationLink[]; ctaLabel?: string; ctaIntent?: string; className?: string }) {
  return <header className={cn('sticky top-3 z-40 mx-auto w-[var(--ut-shell-width)] rounded-[var(--radius)] border border-border bg-background/80 px-4 py-3 shadow-sm backdrop-blur-md', className)}><div className="flex items-center justify-between gap-4"><a href="#top" className="text-base font-bold text-foreground">{brand}</a><nav className="hidden items-center gap-5 md:flex">{links.map((link) => <a key={link.href} href={toNavigationHref(link.href)} data-ut-intent={link.intent || 'nav.anchor'} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}</a>)}</nav>{ctaLabel && <Button className="hidden md:inline-flex" data-ut-intent={ctaIntent || 'cta.primary'}>{ctaLabel}</Button>}<Dialog.Root><Dialog.Trigger asChild><button type="button" aria-label="Open navigation" className="grid size-10 place-items-center rounded-[var(--ut-control-radius)] hover:bg-accent md:hidden"><Menu className="size-5" /></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm" /><Dialog.Content className="fixed right-3 top-3 z-50 w-[var(--ut-panel-width)] rounded-[var(--radius)] border border-border bg-card p-5 shadow-xl"><div className="mb-6 flex items-center justify-between"><Dialog.Title className="font-[number:var(--ut-weight-display)]">{brand}</Dialog.Title><Dialog.Close asChild><button type="button" aria-label="Close navigation" className="grid size-9 place-items-center rounded-[var(--ut-control-radius)] hover:bg-accent"><X className="size-5" /></button></Dialog.Close></div><nav className="grid gap-2">{links.map((link) => <Dialog.Close key={link.href} asChild><a href={toNavigationHref(link.href)} data-ut-intent={link.intent || 'nav.anchor'} className="rounded-[var(--ut-control-radius)] px-3 py-3 text-foreground hover:bg-accent">{link.label}</a></Dialog.Close>)}{ctaLabel && <Button data-ut-intent={ctaIntent || 'cta.primary'}>{ctaLabel}</Button>}</nav></Dialog.Content></Dialog.Portal></Dialog.Root></div></header>;
}
