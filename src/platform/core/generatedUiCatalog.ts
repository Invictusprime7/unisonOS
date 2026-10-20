/**
 * Generated UI Catalog (shadcn parity layer).
 *
 * `DESIGNS/design.json` records every component installed in this workspace.
 * Generated sites previously reached only a subset of them: the composition
 * vocabulary (Button/Card/layout/content/surface), the form controls and the
 * raw Radix facades. Everything else — alert, breadcrumb, calendar, carousel,
 * chart, command, drawer, input-otp, pagination, resizable, sheet, skeleton,
 * table, sonner — existed in the workspace but had no canonical import path a
 * generated page could legally use.
 *
 * This module closes that gap. It emits one token-styled facade per missing
 * component under `/src/unison/ui/catalog/<id>.tsx` and publishes a crosswalk
 * that maps EVERY installed component to the canonical path a generated page
 * must import it from. The crosswalk is what prompts, validation and the
 * coverage tests read, so "installed" and "reachable" can never drift again.
 */

export interface GeneratedUiCatalogEntry {
  /** Component id exactly as recorded in `DESIGNS/design.json`. */
  id: string;
  /** Canonical import path a generated page must use. */
  importPath: string;
  /** Public runtime exports available from that path. */
  exports: readonly string[];
  /** npm packages the facade depends on (already pinned for Sandpack). */
  runtimePackages?: readonly string[];
}

export const GENERATED_UI_CATALOG_ROOT = '@/unison/ui/catalog';

/** Components emitted by this module (no prior canonical route existed). */
export const GENERATED_UI_CATALOG_ENTRIES: readonly GeneratedUiCatalogEntry[] = [
  { id: 'alert', importPath: `${GENERATED_UI_CATALOG_ROOT}/alert`, exports: ['Alert', 'AlertTitle', 'AlertDescription'] },
  {
    id: 'breadcrumb',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/breadcrumb`,
    exports: ['Breadcrumb', 'BreadcrumbList', 'BreadcrumbItem', 'BreadcrumbLink', 'BreadcrumbPage', 'BreadcrumbSeparator'],
  },
  {
    id: 'calendar',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/calendar`,
    exports: ['Calendar'],
    runtimePackages: ['react-day-picker'],
  },
  {
    id: 'carousel',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/carousel`,
    exports: ['Carousel', 'CarouselContent', 'CarouselItem', 'CarouselPrevious', 'CarouselNext'],
    runtimePackages: ['embla-carousel-react'],
  },
  {
    id: 'chart',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/chart`,
    exports: ['ChartContainer', 'ChartTooltipContent', 'CHART_SERIES_COLORS'],
    runtimePackages: ['recharts'],
  },
  {
    id: 'command',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/command`,
    exports: ['Command', 'CommandInput', 'CommandList', 'CommandEmpty', 'CommandGroup', 'CommandItem', 'CommandSeparator'],
    runtimePackages: ['cmdk'],
  },
  {
    id: 'drawer',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/drawer`,
    exports: ['Drawer', 'DrawerTrigger', 'DrawerClose', 'DrawerContent', 'DrawerHeader', 'DrawerFooter', 'DrawerTitle', 'DrawerDescription'],
    runtimePackages: ['vaul'],
  },
  {
    id: 'input-otp',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/input-otp`,
    exports: ['InputOTP', 'InputOTPGroup', 'InputOTPSlot', 'InputOTPSeparator'],
    runtimePackages: ['input-otp'],
  },
  {
    id: 'pagination',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/pagination`,
    exports: ['Pagination', 'PaginationContent', 'PaginationItem', 'PaginationLink', 'PaginationPrevious', 'PaginationNext', 'PaginationEllipsis'],
  },
  {
    id: 'resizable',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/resizable`,
    exports: ['ResizablePanelGroup', 'ResizablePanel', 'ResizableHandle'],
    runtimePackages: ['react-resizable-panels'],
  },
  {
    id: 'sheet',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/sheet`,
    exports: ['Sheet', 'SheetTrigger', 'SheetClose', 'SheetContent', 'SheetHeader', 'SheetFooter', 'SheetTitle', 'SheetDescription'],
  },
  { id: 'skeleton', importPath: `${GENERATED_UI_CATALOG_ROOT}/skeleton`, exports: ['Skeleton'] },
  {
    id: 'table',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/table`,
    exports: ['Table', 'TableHeader', 'TableBody', 'TableFooter', 'TableRow', 'TableHead', 'TableCell', 'TableCaption'],
  },
  {
    id: 'sonner',
    importPath: `${GENERATED_UI_CATALOG_ROOT}/sonner`,
    exports: ['Toaster', 'toast'],
    runtimePackages: ['sonner'],
  },
] as const;

/**
 * Components that already had a canonical home before this layer existed.
 * Keeping them in the crosswalk is what makes "every installed component is
 * reachable" a testable statement rather than a claim.
 */
export const GENERATED_UI_EXISTING_ROUTES: readonly GeneratedUiCatalogEntry[] = [
  { id: 'button', importPath: '@/unison/ui/button', exports: ['Button', 'IconButton'] },
  { id: 'card', importPath: '@/unison/ui/card', exports: ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter'] },
  { id: 'badge', importPath: '@/unison/ui/content', exports: ['Badge'] },
  { id: 'form', importPath: '@/unison/ui/form-fields', exports: ['Form', 'FormField', 'FormItem', 'FormControl', 'FormDescription', 'FormMessage'] },
  { id: 'input', importPath: '@/unison/ui/form-fields', exports: ['Input'] },
  { id: 'textarea', importPath: '@/unison/ui/form-fields', exports: ['Textarea'] },
  { id: 'label', importPath: '@/unison/ui/form-fields', exports: ['FieldLabel', 'Label'] },
  { id: 'checkbox', importPath: '@/unison/ui/form-fields', exports: ['Checkbox'] },
  { id: 'select', importPath: '@/unison/ui/form-fields', exports: ['Select'] },
  { id: 'toast', importPath: '@/unison/ui/radix/toast', exports: ['Provider', 'Root', 'Title', 'Description', 'Action', 'Close', 'Viewport'] },
  { id: 'toaster', importPath: `${GENERATED_UI_CATALOG_ROOT}/sonner`, exports: ['Toaster'] },
  { id: 'use-toast', importPath: `${GENERATED_UI_CATALOG_ROOT}/sonner`, exports: ['toast'] },
  { id: 'InteractiveIcon', importPath: '@/unison/ui/icon', exports: ['Icon'] },
  { id: 'sidebar', importPath: `${GENERATED_UI_CATALOG_ROOT}/sheet`, exports: ['Sheet', 'SheetContent'] },
  { id: 'chart-legend', importPath: `${GENERATED_UI_CATALOG_ROOT}/chart`, exports: ['ChartContainer'] },
] as const;

/** Radix-backed installed components resolve through their generated facade. */
export function radixRouteFor(id: string): GeneratedUiCatalogEntry {
  return { id, importPath: `@/unison/ui/radix/${id}`, exports: ['*'] };
}

export const GENERATED_UI_CATALOG_IMPORTS: readonly string[] = [
  GENERATED_UI_CATALOG_ROOT,
  ...GENERATED_UI_CATALOG_ENTRIES.map((entry) => entry.importPath),
];

export const GENERATED_UI_CATALOG_PATHS: readonly string[] = [
  '/src/unison/ui/catalog/index.ts',
  ...GENERATED_UI_CATALOG_ENTRIES.map((entry) => `/src/unison/ui/catalog/${entry.id}.tsx`),
];

export const GENERATED_UI_CATALOG_RUNTIME_PACKAGES: readonly string[] = [
  ...new Set(GENERATED_UI_CATALOG_ENTRIES.flatMap((entry) => entry.runtimePackages ?? [])),
];

/** Prompt lines describing the catalog to both AI lanes. */
export const GENERATED_UI_CATALOG_PROMPT_LINES: readonly string[] = [
  `Component catalog — "${GENERATED_UI_CATALOG_ROOT}/<component>" (every installed shadcn component that is not part of the composition vocabulary):`,
  ...GENERATED_UI_CATALOG_ENTRIES.map(
    (entry) => `  - "${entry.importPath}": ${entry.exports.join(', ')}`,
  ),
  '  Catalog modules are token-styled and reduced-motion safe. Never reimplement one inline and never import their npm packages directly.',
];

function moduleSource(marker: string, id: string): string {
  switch (id) {
    case 'alert':
      return `${marker}
import * as React from 'react';
import { cn } from '../cn';

type Tone = 'default' | 'muted' | 'primary' | 'destructive';

const tones: Record<Tone, string> = {
  default: 'border-border bg-card text-card-foreground',
  muted: 'border-border bg-muted text-foreground',
  primary: 'border-primary/40 bg-primary/10 text-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
};

export function Alert({ tone = 'default', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div role="status" className={cn('w-full rounded-[var(--radius)] border p-4', tones[tone], className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
`;
    case 'breadcrumb':
      return `${marker}
import * as React from 'react';
import { cn } from '../cn';
import { ChevronRight } from '../icons';

export function Breadcrumb({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label="Breadcrumb" className={cn('w-full', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentPropsWithoutRef<'ol'>) {
  return <ol className={cn('flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return <a className={cn('transition-colors hover:text-foreground', className)} {...props} />;
}

export function BreadcrumbPage({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return <span aria-current="page" className={cn('font-medium text-foreground', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, children, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return (
    <li aria-hidden className={cn('[&>svg]:size-3.5', className)} {...props}>
      {children ?? <ChevronRight />}
    </li>
  );
}
`;
    case 'calendar':
      return `${marker}
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '../cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rounded-[var(--radius)] border border-border bg-card p-3 text-card-foreground', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month_caption: 'flex items-center justify-center py-2 font-semibold',
        weekday: 'text-xs font-medium text-muted-foreground',
        day_button: 'size-9 rounded-[var(--ut-control-radius)] text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected: 'bg-primary text-primary-foreground',
        today: 'font-semibold text-primary',
        outside: 'text-muted-foreground/60',
        disabled: 'opacity-40',
        ...classNames,
      }}
      {...props}
    />
  );
}
`;
    case 'carousel':
      return `${marker}
import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '../cn';
import { ChevronLeft, ChevronRight } from '../icons';

type EmblaApi = ReturnType<typeof useEmblaCarousel>[1];

const CarouselContext = React.createContext<{ api: EmblaApi } | null>(null);

export function Carousel({ className, children, loop = true, ...props }: React.HTMLAttributes<HTMLDivElement> & { loop?: boolean }) {
  const [ref, api] = useEmblaCarousel({ loop, align: 'start' });
  return (
    <CarouselContext.Provider value={{ api }}>
      <div className={cn('relative', className)} role="region" aria-roledescription="carousel" {...props}>
        <div ref={ref} className="overflow-hidden">{children}</div>
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex gap-[var(--ut-stack-gap)]', className)} {...props} />;
}

export function CarouselItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" aria-roledescription="slide" className={cn('min-w-0 shrink-0 grow-0 basis-full sm:basis-1/2 lg:basis-1/3', className)} {...props} />;
}

function NavButton({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn('absolute top-1/2 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {children}
    </button>
  );
}

export function CarouselPrevious({ className }: { className?: string }) {
  const context = React.useContext(CarouselContext);
  return <NavButton label="Previous slide" className={cn('left-2', className)} onClick={() => context?.api?.scrollPrev()}><ChevronLeft /></NavButton>;
}

export function CarouselNext({ className }: { className?: string }) {
  const context = React.useContext(CarouselContext);
  return <NavButton label="Next slide" className={cn('right-2', className)} onClick={() => context?.api?.scrollNext()}><ChevronRight /></NavButton>;
}
`;
    case 'chart':
      return `${marker}
import * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '../cn';

export * from 'recharts';

/** Chart series read theme tokens; charts never carry literal colors. */
export const CHART_SERIES_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export function ChartContainer({ className, children, label }: { className?: string; children: React.ReactElement; label?: string }) {
  return (
    <figure aria-label={label} className={cn('h-[var(--ut-media-block)] w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </figure>
  );
}

export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm">
      {label ? <div className="mb-1 font-semibold">{label}</div> : null}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
`;
    case 'command':
      return `${marker}
import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '../cn';

export function Command({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card text-card-foreground', className)} {...props} />;
}

export function CommandInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return <CommandPrimitive.Input className={cn('h-11 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground', className)} {...props} />;
}

export function CommandList({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-[var(--ut-overlay-block)] overflow-y-auto p-2', className)} {...props} />;
}

export function CommandEmpty(props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="px-4 py-6 text-center text-sm text-muted-foreground" {...props} />;
}

export function CommandGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group className={cn('[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground', className)} {...props} />;
}

export function CommandItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item className={cn('flex cursor-pointer items-center gap-2 rounded-[var(--ut-control-radius)] px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground', className)} {...props} />;
}

export function CommandSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />;
}
`;
    case 'drawer':
      return `${marker}
import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '../cn';

export function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root shouldScaleBackground {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay data-ut-radix="overlay" className="fixed inset-0 z-50 bg-foreground/40" />
      <DrawerPrimitive.Content
        data-ut-radix="content"
        className={cn('fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[var(--radius)] border border-border bg-card text-card-foreground', className)}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col gap-2 p-5', className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('font-heading text-lg font-semibold', className)} {...props} />;
}

export function DrawerDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
`;
    case 'input-otp':
      return `${marker}
import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cn } from '../cn';

export function InputOTP({ className, containerClassName, ...props }: React.ComponentPropsWithoutRef<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      containerClassName={cn('flex items-center gap-2', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

export function InputOTPGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />;
}

export function InputOTPSlot({ index, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots?.[index];
  return (
    <div
      className={cn('flex size-10 items-center justify-center rounded-[var(--ut-control-radius)] border border-border bg-background text-sm', slot?.isActive && 'ring-2 ring-ring', className)}
      {...props}
    >
      {slot?.char ?? ''}
    </div>
  );
}

export function InputOTPSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" aria-hidden className="h-px w-3 bg-border" {...props} />;
}
`;
    case 'pagination':
      return `${marker}
import * as React from 'react';
import { cn } from '../cn';
import { ChevronLeft, ChevronRight, MoreHorizontal } from '../icons';

export function Pagination({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label="Pagination" className={cn('mx-auto flex w-full justify-center', className)} {...props} />;
}

export function PaginationContent({ className, ...props }: React.ComponentPropsWithoutRef<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}

export function PaginationItem(props: React.ComponentPropsWithoutRef<'li'>) {
  return <li {...props} />;
}

export function PaginationLink({ className, isActive, ...props }: React.ComponentPropsWithoutRef<'a'> & { isActive?: boolean }) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={cn('inline-flex size-9 items-center justify-center rounded-[var(--ut-control-radius)] border border-transparent text-sm transition-colors hover:bg-accent hover:text-accent-foreground', isActive && 'border-border bg-card font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a aria-label="Previous page" className={cn('inline-flex h-9 items-center gap-1 rounded-[var(--ut-control-radius)] px-3 text-sm hover:bg-accent hover:text-accent-foreground', className)} {...props}>
      <ChevronLeft /> <span>Previous</span>
    </a>
  );
}

export function PaginationNext({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a aria-label="Next page" className={cn('inline-flex h-9 items-center gap-1 rounded-[var(--ut-control-radius)] px-3 text-sm hover:bg-accent hover:text-accent-foreground', className)} {...props}>
      <span>Next</span> <ChevronRight />
    </a>
  );
}

export function PaginationEllipsis({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span aria-hidden className={cn('inline-flex size-9 items-center justify-center text-muted-foreground', className)} {...props}>
      <MoreHorizontal />
    </span>
  );
}
`;
    case 'resizable':
      return `${marker}
import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '../cn';

export function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof PanelGroup>) {
  return <PanelGroup className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof PanelResizeHandle>) {
  return <PanelResizeHandle className={cn('relative w-px bg-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full', className)} {...props} />;
}
`;
    case 'sheet':
      return `${marker}
import * as React from 'react';
import * as Dialog from '../radix/dialog';
import { cn } from '../cn';
import { X } from '../icons';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

type Side = 'top' | 'right' | 'bottom' | 'left';

const sides: Record<Side, string> = {
  top: 'inset-x-0 top-0 border-b',
  right: 'inset-y-0 right-0 h-full w-full max-w-sm border-l',
  bottom: 'inset-x-0 bottom-0 border-t',
  left: 'inset-y-0 left-0 h-full w-full max-w-sm border-r',
};

export function SheetContent({ side = 'right', className, children, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: Side }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay data-ut-radix="overlay" className="fixed inset-0 z-50 bg-foreground/40 motion-safe:transition-opacity" />
      <Dialog.Content
        data-ut-radix="content"
        className={cn('fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-card p-6 text-card-foreground', sides[side], className)}
        {...props}
      >
        {children}
        <Dialog.Close aria-label="Close" className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-[var(--ut-control-radius)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col gap-2', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return <Dialog.Title className={cn('font-heading text-lg font-semibold', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Description>) {
  return <Dialog.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
`;
    case 'skeleton':
      return `${marker}
import * as React from 'react';
import { cn } from '../cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('rounded-[var(--radius)] bg-muted motion-safe:animate-pulse', className)} {...props} />;
}
`;
    case 'table':
      return `${marker}
import * as React from 'react';
import { cn } from '../cn';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('border-t border-border bg-muted/50 font-medium', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border transition-colors hover:bg-muted/40', className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-3 text-sm text-muted-foreground', className)} {...props} />;
}
`;
    case 'sonner':
      return `${marker}
import * as React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export { toast };

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'rounded-[var(--radius)] border border-border bg-card text-card-foreground',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
        },
      }}
      {...props}
    />
  );
}
`;
    default:
      throw new Error(`[generatedUiCatalog] no source for catalog component "${id}".`);
  }
}

/** Emits every catalog facade plus its barrel. */
export function buildGeneratedUiCatalogFiles(marker: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of GENERATED_UI_CATALOG_ENTRIES) {
    files[`/src/unison/ui/catalog/${entry.id}.tsx`] = moduleSource(marker, entry.id);
  }
  files['/src/unison/ui/catalog/index.ts'] = `${marker}
${GENERATED_UI_CATALOG_ENTRIES
  .map((entry) => `export { ${entry.exports.join(', ')} } from './${entry.id}';`)
  .join('\n')}
`;
  return files;
}
