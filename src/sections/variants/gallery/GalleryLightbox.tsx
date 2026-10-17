/**
 * Gallery Lightbox
 *
 * Shared accessible overlay used by every gallery variant.
 * Keyboard: Escape closes, ArrowLeft/ArrowRight navigate.
 * Honors prefers-reduced-motion by skipping transitions.
 */

import React, { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ThemeTokens } from '../../types';
import { hsl, hsla } from '../../themeUtils';
import { GalleryImage } from './GalleryImage';

export interface LightboxItem {
  src: string;
  alt?: string;
  caption?: string;
  category?: string;
}

interface GalleryLightboxProps {
  items: LightboxItem[];
  index: number | null;
  theme: ThemeTokens;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}

export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ items, index, theme, onClose, onNavigate }) => {
  const returnFocus = useRef<HTMLElement | null>(null);
  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const item = index === null ? undefined : items[index];

  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" />
        {item && <Dialog.Content
      aria-describedby={undefined}
      onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
      }}
      onKeyDown={event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        event.stopPropagation();
        onNavigate(((index ?? 0) + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length);
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: hsla(theme.colors.foreground, 0.92),
        transition: reducedMotion ? 'none' : 'opacity 200ms ease',
      }}
    >
      <Dialog.Title className="sr-only">{item.alt || item.caption || 'Gallery image'}</Dialog.Title>
      <Dialog.Close asChild><button
        type="button"
        aria-label="Close gallery"
        className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }}
      >
        <X aria-hidden="true" size={20} />
      </button></Dialog.Close>
      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onNavigate(((index ?? 0) - 1 + items.length) % items.length)}
            className="absolute left-4 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }}
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => onNavigate(((index ?? 0) + 1) % items.length)}
            className="absolute right-4 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }}
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </>
      )}
      <figure className="m-0 max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <GalleryImage
          src={item.src}
          alt={item.alt || item.caption || ''}
          theme={theme}
          className="max-h-[var(--ut-overlay-block)] w-auto object-contain"
          style={{ borderRadius: theme.radius }}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {`Image ${(index ?? 0) + 1} of ${items.length}: ${item.alt || item.caption || 'Gallery image'}`}
        </p>
        {item.category && (
          <p
            className="mt-3 text-center text-xs uppercase tracking-widest"
            style={{ fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.background, 0.72) }}
          >
            {item.category}
          </p>
        )}
        {item.caption && (
          <figcaption
            className="mt-3 text-center text-sm"
            style={{ fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.background) }}
          >
            {item.caption}
          </figcaption>
        )}
      </figure>
        </Dialog.Content>}
      </Dialog.Portal>
    </Dialog.Root>
  );
};
