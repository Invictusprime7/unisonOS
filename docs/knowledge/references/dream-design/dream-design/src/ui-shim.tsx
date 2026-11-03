
import React from 'react';

// Utility
function cn(...inputs) { return inputs.filter(Boolean).join(' '); }

// Button
export function Button({ children, className, variant, size, asChild, ...props }) {
  return React.createElement('button', { className: cn('inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2', className), ...props }, children);
}

// Card
export function Card({ children, className, ...props }) { return React.createElement('div', { className: cn('rounded-lg border bg-card text-card-foreground shadow-sm', className), ...props }, children); }
export function CardHeader({ children, className, ...props }) { return React.createElement('div', { className: cn('flex flex-col space-y-1.5 p-6', className), ...props }, children); }
export function CardTitle({ children, className, ...props }) { return React.createElement('h3', { className: cn('text-2xl font-semibold leading-none tracking-tight', className), ...props }, children); }
export function CardDescription({ children, className, ...props }) { return React.createElement('p', { className: cn('text-sm text-muted-foreground', className), ...props }, children); }
export function CardContent({ children, className, ...props }) { return React.createElement('div', { className: cn('p-6 pt-0', className), ...props }, children); }
export function CardFooter({ children, className, ...props }) { return React.createElement('div', { className: cn('flex items-center p-6 pt-0', className), ...props }, children); }

// Input
export function Input({ className, type = 'text', ...props }) { return React.createElement('input', { type, className: cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }); }

// Label
export function Label({ children, className, ...props }) { return React.createElement('label', { className: cn('text-sm font-medium leading-none', className), ...props }, children); }

// Badge
export function Badge({ children, className, variant, ...props }) { return React.createElement('span', { className: cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', className), ...props }, children); }

// Separator
export function Separator({ className, orientation = 'horizontal', ...props }) { return React.createElement('div', { className: cn(orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]', 'shrink-0 bg-border', className), ...props }); }

// Textarea
export function Textarea({ className, ...props }) { return React.createElement('textarea', { className: cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }); }

// Avatar
export function Avatar({ children, className, ...props }) { return React.createElement('span', { className: cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className), ...props }, children); }
export function AvatarImage({ src, alt, className, ...props }) { return React.createElement('img', { src, alt, className: cn('aspect-square h-full w-full', className), ...props }); }
export function AvatarFallback({ children, className, ...props }) { return React.createElement('span', { className: cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className), ...props }, children); }

// ScrollArea
export function ScrollArea({ children, className, ...props }) { return React.createElement('div', { className: cn('overflow-auto', className), ...props }, children); }

// Tabs
export function Tabs({ children, className, defaultValue, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function TabsList({ children, className, ...props }) { return React.createElement('div', { className: cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1', className), ...props }, children); }
export function TabsTrigger({ children, className, value, ...props }) { return React.createElement('button', { className: cn('inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium', className), ...props }, children); }
export function TabsContent({ children, className, value, ...props }) { return React.createElement('div', { className, ...props }, children); }

// Dialog
export function Dialog({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DialogTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DialogContent({ children, className, ...props }) { return React.createElement('div', { className: cn('fixed inset-0 z-50 flex items-center justify-center', className), ...props }, children); }
export function DialogHeader({ children, className, ...props }) { return React.createElement('div', { className: cn('flex flex-col space-y-1.5 text-center sm:text-left', className), ...props }, children); }
export function DialogTitle({ children, className, ...props }) { return React.createElement('h2', { className: cn('text-lg font-semibold', className), ...props }, children); }
export function DialogDescription({ children, className, ...props }) { return React.createElement('p', { className: cn('text-sm text-muted-foreground', className), ...props }, children); }

// Sheet
export function Sheet({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function SheetTrigger({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function SheetContent({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }

// Select  
export function Select({ children, ...props }) { return React.createElement('div', null, children); }
export function SelectTrigger({ children, className, ...props }) { return React.createElement('button', { className: cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }, children); }
export function SelectValue({ placeholder, ...props }) { return React.createElement('span', props, placeholder); }
export function SelectContent({ children, ...props }) { return React.createElement('div', props, children); }
export function SelectItem({ children, value, ...props }) { return React.createElement('div', props, children); }

// Switch
export function Switch({ className, ...props }) { return React.createElement('button', { className: cn('peer inline-flex h-[24px] w-[44px] rounded-full border-2', className), role: 'switch', ...props }); }

// Accordion
export function Accordion({ children, ...props }) { return React.createElement('div', props, children); }
export function AccordionItem({ children, value, ...props }) { return React.createElement('div', props, children); }
export function AccordionTrigger({ children, ...props }) { return React.createElement('button', props, children); }
export function AccordionContent({ children, ...props }) { return React.createElement('div', props, children); }

// Progress
export function Progress({ value = 0, className, ...props }) { return React.createElement('div', { className: cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className), ...props }, React.createElement('div', { style: { width: value + '%' }, className: 'h-full bg-primary transition-all' })); }

// Tooltip
export function Tooltip({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function TooltipTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function TooltipContent({ children, ...props }) { return null; }
export function TooltipProvider({ children, ...props }) { return React.createElement(React.Fragment, null, children); }

// Skeleton
export function Skeleton({ className, ...props }) { return React.createElement('div', { className: cn('animate-pulse rounded-md bg-muted', className), ...props }); }

// Checkbox
export function Checkbox({ className, ...props }) { return React.createElement('input', { type: 'checkbox', className, ...props }); }

// RadioGroup
export function RadioGroup({ children, ...props }) { return React.createElement('div', props, children); }
export function RadioGroupItem({ value, ...props }) { return React.createElement('input', { type: 'radio', value, ...props }); }

// Sonner toast
export function Toaster(props) { return null; }
export function toast(message) { console.log('[Toast]', message); }

// Form
export function Form({ children, ...props }) { return React.createElement('form', props, children); }
export function FormField({ render, name, control, ...props }) { return render ? render({ field: { name, value: '', onChange: () => {}, onBlur: () => {} } }) : null; }
export function FormItem({ children, ...props }) { return React.createElement('div', { className: 'space-y-2', ...props }, children); }
export function FormLabel({ children, ...props }) { return React.createElement('label', props, children); }
export function FormControl({ children, ...props }) { return React.createElement('div', props, children); }
export function FormMessage({ ...props }) { return null; }

// DropdownMenu
export function DropdownMenu({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DropdownMenuTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DropdownMenuContent({ children, ...props }) { return null; }
export function DropdownMenuItem({ children, ...props }) { return React.createElement('div', props, children); }

// Popover
export function Popover({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function PopoverTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function PopoverContent({ children, ...props }) { return null; }

// Collapsible
export function Collapsible({ children, ...props }) { return React.createElement('div', props, children); }
export function CollapsibleTrigger({ children, ...props }) { return React.createElement('div', props, children); }
export function CollapsibleContent({ children, ...props }) { return React.createElement('div', props, children); }

// NavigationMenu
export function NavigationMenu({ children, className, ...props }) { return React.createElement('nav', { className, ...props }, children); }
export function NavigationMenuList({ children, ...props }) { return React.createElement('ul', props, children); }
export function NavigationMenuItem({ children, ...props }) { return React.createElement('li', props, children); }
export function NavigationMenuTrigger({ children, ...props }) { return React.createElement('button', props, children); }
export function NavigationMenuContent({ children, ...props }) { return React.createElement('div', props, children); }
export function NavigationMenuLink({ children, ...props }) { return React.createElement('a', props, children); }

// Breadcrumb
export function Breadcrumb({ children, ...props }) { return React.createElement('nav', props, children); }
export function BreadcrumbList({ children, ...props }) { return React.createElement('ol', { className: 'flex items-center gap-1.5', ...props }, children); }
export function BreadcrumbItem({ children, ...props }) { return React.createElement('li', props, children); }
export function BreadcrumbLink({ children, ...props }) { return React.createElement('a', props, children); }
export function BreadcrumbSeparator({ ...props }) { return React.createElement('span', props, '/'); }

// Table
export function Table({ children, className, ...props }) { return React.createElement('table', { className: cn('w-full caption-bottom text-sm', className), ...props }, children); }
export function TableHeader({ children, ...props }) { return React.createElement('thead', props, children); }
export function TableBody({ children, ...props }) { return React.createElement('tbody', props, children); }
export function TableRow({ children, className, ...props }) { return React.createElement('tr', { className: cn('border-b', className), ...props }, children); }
export function TableHead({ children, className, ...props }) { return React.createElement('th', { className: cn('h-12 px-4 text-left align-middle font-medium', className), ...props }, children); }
export function TableCell({ children, className, ...props }) { return React.createElement('td', { className: cn('p-4 align-middle', className), ...props }, children); }

// Carousel
export function Carousel({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function CarouselContent({ children, ...props }) { return React.createElement('div', { className: 'flex', ...props }, children); }
export function CarouselItem({ children, ...props }) { return React.createElement('div', { className: 'min-w-0 flex-shrink-0 flex-grow-0 basis-full', ...props }, children); }
export function CarouselPrevious({ ...props }) { return React.createElement('button', props, '<'); }
export function CarouselNext({ ...props }) { return React.createElement('button', props, '>'); }

// AspectRatio
export function AspectRatio({ children, ratio = 1, className, ...props }) { return React.createElement('div', { style: { position: 'relative', paddingBottom: (1 / ratio * 100) + '%' }, className, ...props }, React.createElement('div', { style: { position: 'absolute', inset: 0 } }, children)); }

// HoverCard
export function HoverCard({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function HoverCardTrigger({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function HoverCardContent({ children, ...props }) { return null; }

// Command
export function Command({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function CommandInput({ ...props }) { return React.createElement('input', { type: 'text', ...props }); }
export function CommandList({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandEmpty({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandGroup({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandItem({ children, ...props }) { return React.createElement('div', props, children); }

// Calendar
export function Calendar({ ...props }) { return React.createElement('div', { className: 'p-3 text-center text-sm text-muted-foreground' }, 'Calendar'); }

export default {};
