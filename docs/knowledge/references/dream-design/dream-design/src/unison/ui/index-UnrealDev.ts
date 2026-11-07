import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Grid = __LucideIcons['Grid'] || __LucideFallback;
// UNISON GENERATED UI FOUNDATION v1.12
// Root barrel: MUST re-export the full public surface of every foundation
// module. A partial barrel resolves to `undefined` at runtime and surfaces as
// "Element type is invalid" in the preview.
export { Button, IconButton, type ButtonProps, type IconButtonProps } from './button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { cn } from './cn';
export { Section, Container, Stack, Grid, Split, Bleed, Divider, type SectionProps, type SectionTone, type ContainerWidth, type StackProps, type StackGap, type GridProps, type SplitProps } from './layout';
export { Eyebrow, Heading, Lead, Body, Paragraph, Badge, Stat, Quote, CTAGroup, SectionHeader, type HeadingProps, type HeadingLevel, type HeadingSize, type StatProps, type QuoteProps, type SectionHeaderProps } from './content';
export { Panel, MediaFrame, FeaturePanel, type PanelProps, type PanelTone, type MediaFrameProps, type FeaturePanelProps } from './surface';
export { FieldLabel, Label, FormLabel, Input, TextInput, Textarea, TextArea, Select, Checkbox, FormField, FormFields, FormGrid, FormHint, FormError, Form, FormItem, FormControl, FormDescription, FormMessage } from './form-fields';
export { useForm, useFormContext, useFieldArray, Controller, zodResolver, z } from './forms';
export { Icon } from './icon';
export { Image, ImageLightbox, type ImageProps, type ImageSource, type StaticImageData } from './media';
export { Reveal, RevealGroup, StaggerGroup, Stagger, StaggerItem, type MotionRecipe } from './motion';
export { FloatingNavbar, type NavigationLink } from './navigation';
export { OrbitalBackdrop, GlowField, AnimatedGrid, NoiseField, GradientOrbs, MediaCanvas, type BackdropProps, type MediaCanvasProps } from './backgrounds';
export { BentoFeatureGrid, FeatureCard } from './recipes';
export { colorStyles, componentStyles, motionStyles, styles, typography } from './styles';
export { Slot, Slottable } from './radix/slot';
// Compatibility surface for generated pages that import Lucide components
// from the UI root instead of the dedicated /icons facade.
export * from './icons';
