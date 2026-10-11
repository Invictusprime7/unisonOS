/**
 * Public canonical implementations — the ONLY components consumers may import.
 * Promotion adds an entry here (scripts/unison-promote.ts); retirement removes it.
 */
import type { ComponentType } from 'react';
import type { BaseSectionProps } from '../types';
import { ContactCompactCard } from './contact/ContactCompactCard';
import { FooterMultiColumn } from './footer/FooterMultiColumn';
import { AuthSignIn } from './auth/AuthSignIn';
import { DataTable } from './dataTable/DataTable';
import { AuthSignUp } from './auth/AuthSignUp';
import { DashboardOverview } from './dataTable/DashboardOverview';
import { CTAEditorial } from './cta/CTAEditorial';
import { FeaturesBentoMosaic } from './features/FeaturesBentoMosaic';
import { FeaturesIntegrations } from './features/FeaturesIntegrations';
import { TeamEditorial } from './team/TeamEditorial';
import { StatsBold } from './stats/StatsBold';
import { PricingCreative } from './pricing/PricingCreative';
import { PricingComparisonTable } from './pricing/PricingComparisonTable';
import { LogoCloudStaticGrid } from './logoCloud/LogoCloudStaticGrid';
import { LogoCloudCinematic } from './logoCloud/LogoCloudCinematic';
import { TestimonialsVoice } from './testimonials/TestimonialsVoice';
import { TestimonialsVerticalMarquee } from './testimonials/TestimonialsVerticalMarquee';
import { TestimonialsEditorial } from './testimonials/TestimonialsEditorial';
import { HeroUnderline } from './hero/HeroUnderline';
import { HeroVariableType } from './hero/HeroVariableType';
import { HeroImageFan } from './hero/HeroImageFan';
import { BeforeAfterCaseStudy } from './beforeAfter/BeforeAfterCaseStudy';
import { BeforeAfterGrid } from './beforeAfter/BeforeAfterGrid';
import { BeforeAfterSlider } from './beforeAfter/BeforeAfterSlider';
import { BlogPreviewHorizontalRail } from './blogPreview/BlogPreviewHorizontalRail';
import { BlogPreviewFeaturedGrid } from './blogPreview/BlogPreviewFeaturedGrid';
import { BlogPreviewEditorial } from './blogPreview/BlogPreviewEditorial';
import { LogoCloudWordmarkRow } from './logoCloud/LogoCloudWordmarkRow';
import { LogoCloudBrandLockup } from './logoCloud/LogoCloudBrandLockup';
import { LogoCloudMarquee } from './logoCloud/LogoCloudMarquee';
import { LogoCloudGrid } from './logoCloud/LogoCloudGrid';
import { TeamLeadSpotlight } from './team/TeamLeadSpotlight';
import { TeamRosterRail } from './team/TeamRosterRail';
import { TeamPortraitGrid } from './team/TeamPortraitGrid';
import { StatsHighlight } from './stats/StatsHighlight';
import { StatsBandedGrid } from './stats/StatsBandedGrid';
import { StatsRow } from './stats/StatsRow';
import { FAQCards } from './faq/FAQCards';
import { FAQTwoColumn } from './faq/FAQTwoColumn';
import { FAQAccordion } from './faq/FAQAccordion';
import { AboutStoryPanel } from './about/AboutStoryPanel';
import { AboutStatement } from './about/AboutStatement';
import { AboutEditorialSplit } from './about/AboutEditorialSplit';
import { FooterDarkBand } from './footer/FooterDarkBand';
import { FooterCenteredMinimal } from './footer/FooterCenteredMinimal';
import { FooterColumns } from './footer/FooterColumns';
import { ContactMinimalInline } from './contact/ContactMinimalInline';
import { ContactSplitCard } from './contact/ContactSplitCard';
import { ContactCentered } from './contact/ContactCentered';
import { ServicesCompactList } from './services/ServicesCompactList';
import { ServicesAlternating } from './services/ServicesAlternating';
import { ServicesCardGrid } from './services/ServicesCardGrid';
import { FeaturesBentoGrid } from './features/FeaturesBentoGrid';
import { FeaturesMinimalCentered } from './features/FeaturesMinimalCentered';
import { FeaturesIconLeft } from './features/FeaturesIconLeft';
import { FeaturesGrid } from './features/FeaturesGrid';
import { GalleryCollectionTiles } from './gallery/GalleryCollectionTiles';
import { GalleryHorizontalReel } from './gallery/GalleryHorizontalReel';
import { GalleryFeatureSplit } from './gallery/GalleryFeatureSplit';
import { GalleryLightboxGrid } from './gallery/GalleryLightboxGrid';
import { GalleryCinematicGrid } from './gallery/GalleryCinematicGrid';
import { GalleryMasonry } from './gallery/GalleryMasonry';
import { GalleryEditorialMosaic } from './gallery/GalleryEditorialMosaic';
import { PricingAccordion } from './pricing/PricingAccordion';
import { PricingComparison } from './pricing/PricingComparison';
import { PricingTiers } from './pricing/PricingTiers';
import { TestimonialsSpotlight } from './testimonials/TestimonialsSpotlight';
import { TestimonialsRail } from './testimonials/TestimonialsRail';
import { CTASplitCard } from './cta/CTASplitCard';
import { CTAGradientBanner } from './cta/CTAGradientBanner';
import { CTACentered } from './cta/CTACentered';
import { HeroShowcasePanel } from './hero/HeroShowcasePanel';
import { HeroCommerceGradient } from './hero/HeroCommerceGradient';
import { TestimonialsGrid } from './testimonials/TestimonialsGrid';
import { TestimonialsColumns } from './testimonials/TestimonialsColumns';
import { TestimonialsMarquee } from './testimonials/TestimonialsMarquee';
import { PricingSpotlight } from './pricing/PricingSpotlight';
import { PricingFeatureTable } from './pricing/PricingFeatureTable';
import { PricingBillingToggle } from './pricing/PricingBillingToggle';
import { GalleryCaseStudy } from './gallery/GalleryCaseStudy';
import { HeroImageStream } from './hero/HeroImageStream';
import { HeroLaunchShowcase } from './hero/HeroLaunchShowcase';
import { HeroPrismaCinematic } from './hero/HeroPrismaCinematic';
import { HeroTunnelImmersive } from './hero/HeroTunnelImmersive';
import { HeroSpatialDepth } from './hero/HeroSpatialDepth';
import { HeroCentered } from './hero/HeroCentered';
import { HeroSplitImage } from './hero/HeroSplitImage';
import { HeroFullBleed } from './hero/HeroFullBleed';
import { HeroPageTitle } from './hero/HeroPageIntro';
import { HeroEditorialBanner } from './hero/HeroPageIntro';
import { CTAInsetPanel } from './cta/CTAInsetPanel';
import { CTASignalBanner } from './cta/CTASignalBanner';
import { NavbarCatalogBar } from './navbar/NavbarCatalogBar';
import { NavbarFloatingPill } from './navbar/NavbarFloatingPill';
import { NavbarStandard } from './navbar/NavbarStandard';
import { NavbarCenteredLogo } from './navbar/NavbarCenteredLogo';
import { NavbarMinimalDark } from './navbar/NavbarMinimalDark';
import { FeaturesSpotlightCards } from './features/FeaturesSpotlightCards';
import { ServicesExpandable } from './services/ServicesExpandable';
import { ServicesEditorialRows } from './services/ServicesEditorialRows';
import { ServicesBentoSpotlight } from './services/ServicesBentoSpotlight';
import { ServicesProductCards } from './services/ServicesProductCards';
import { ContactCheckoutPanel } from './contact/ContactCheckoutPanel';
import { ContactMapStudio } from './contact/ContactMapStudio';
import { ContactEditorialForm } from './contact/ContactEditorialForm';
import { FooterBrandSocial } from './footer/FooterBrandSocial';
import { AboutImageStory } from './about/AboutImageStory';
import { FAQSearchable } from './faq/FAQSearchable';
import { FAQEditorial } from './faq/FAQEditorial';
import { StatsProofGrid } from './stats/StatsProofGrid';
import { StatsMetricCards } from './stats/StatsMetricCards';
import { TeamProfileCards } from './team/TeamProfileCards';
import { LogoCloudRevealTiles } from './logoCloud/LogoCloudRevealTiles';
import { BlogPreviewFourColumns } from './blogPreview/BlogPreviewFourColumns';
import { BeforeAfterRevealPanel } from './beforeAfter/BeforeAfterRevealPanel';

export const PUBLIC_IMPLEMENTATIONS: Readonly<Record<string, ComponentType<BaseSectionProps<any>>>> = {
  'testimonials:columns': TestimonialsColumns,
  'testimonials:marquee': TestimonialsMarquee,
  'pricing:spotlight': PricingSpotlight,
  'pricing:feature-table': PricingFeatureTable,
  'pricing:billing-toggle': PricingBillingToggle,
  'gallery:case-study': GalleryCaseStudy,
  'hero:image-stream': HeroImageStream,
  'hero:launch-showcase': HeroLaunchShowcase,
  'hero:prisma-cinematic': HeroPrismaCinematic,
  'hero:tunnel-immersive': HeroTunnelImmersive,
  'hero:spatial-depth': HeroSpatialDepth,
  'hero:centered': HeroCentered,
  'hero:split-image': HeroSplitImage,
  'hero:full-bleed': HeroFullBleed,
  'hero:page-title': HeroPageTitle,
  'hero:editorial-banner': HeroEditorialBanner,
  'cta:inset-panel': CTAInsetPanel,
  'cta:signal-banner': CTASignalBanner,
  'navbar:catalog-bar': NavbarCatalogBar,
  'navbar:floating-pill': NavbarFloatingPill,
  'navbar:standard': NavbarStandard,
  'navbar:centered-logo': NavbarCenteredLogo,
  'navbar:minimal-dark': NavbarMinimalDark,
  'features:spotlight-cards': FeaturesSpotlightCards,
  'services:expandable': ServicesExpandable,
  'services:editorial-rows': ServicesEditorialRows,
  'services:bento-spotlight': ServicesBentoSpotlight,
  'services:product-cards': ServicesProductCards,
  'contact:checkout-panel': ContactCheckoutPanel,
  'contact:map-studio': ContactMapStudio,
  'contact:editorial-form': ContactEditorialForm,
  'footer:brand-social': FooterBrandSocial,
  'about:image-story': AboutImageStory,
  'faq:searchable': FAQSearchable,
  'faq:editorial': FAQEditorial,
  'stats:proof-grid': StatsProofGrid,
  'stats:metric-cards': StatsMetricCards,
  'team:profile-cards': TeamProfileCards,
  'logo-cloud:reveal-tiles': LogoCloudRevealTiles,
  'blog-preview:four-columns': BlogPreviewFourColumns,
  'before-after:reveal-panel': BeforeAfterRevealPanel,
  'testimonials:grid': TestimonialsGrid,
  'hero:commerce-gradient': HeroCommerceGradient,
  'hero:showcase-panel': HeroShowcasePanel,
  'cta:centered': CTACentered,
  'cta:gradient-banner': CTAGradientBanner,
  'cta:split-card': CTASplitCard,
  'testimonials:rail': TestimonialsRail,
  'testimonials:spotlight': TestimonialsSpotlight,
  'pricing:tiers': PricingTiers,
  'pricing:comparison': PricingComparison,
  'pricing:accordion': PricingAccordion,
  'gallery:editorial-mosaic': GalleryEditorialMosaic,
  'gallery:masonry': GalleryMasonry,
  'gallery:cinematic-grid': GalleryCinematicGrid,
  'gallery:lightbox-grid': GalleryLightboxGrid,
  'gallery:feature-split': GalleryFeatureSplit,
  'gallery:horizontal-reel': GalleryHorizontalReel,
  'gallery:collection-tiles': GalleryCollectionTiles,
  'features:grid': FeaturesGrid,
  'features:icon-left': FeaturesIconLeft,
  'features:minimal-centered': FeaturesMinimalCentered,
  'features:bento-grid': FeaturesBentoGrid,
  'services:card-grid': ServicesCardGrid,
  'services:alternating': ServicesAlternating,
  'services:compact-list': ServicesCompactList,
  'contact:centered': ContactCentered,
  'contact:split-card': ContactSplitCard,
  'contact:minimal-inline': ContactMinimalInline,
  'footer:columns': FooterColumns,
  'footer:centered-minimal': FooterCenteredMinimal,
  'footer:dark-band': FooterDarkBand,
  'about:editorial-split': AboutEditorialSplit,
  'about:statement': AboutStatement,
  'about:story-panel': AboutStoryPanel,
  'faq:accordion': FAQAccordion,
  'faq:two-column': FAQTwoColumn,
  'faq:cards': FAQCards,
  'stats:row': StatsRow,
  'stats:banded-grid': StatsBandedGrid,
  'stats:highlight': StatsHighlight,
  'team:portrait-grid': TeamPortraitGrid,
  'team:roster-rail': TeamRosterRail,
  'team:lead-spotlight': TeamLeadSpotlight,
  'logo-cloud:grid': LogoCloudGrid,
  'logo-cloud:marquee': LogoCloudMarquee,
  'logo-cloud:brand-lockup': LogoCloudBrandLockup,
  'logo-cloud:wordmark-row': LogoCloudWordmarkRow,
  'blog-preview:editorial': BlogPreviewEditorial,
  'blog-preview:featured-grid': BlogPreviewFeaturedGrid,
  'blog-preview:horizontal-rail': BlogPreviewHorizontalRail,
  'before-after:slider': BeforeAfterSlider,
  'before-after:grid': BeforeAfterGrid,
  'before-after:case-study': BeforeAfterCaseStudy,
  'hero:image-fan': HeroImageFan,
  'hero:variable-type': HeroVariableType,
  'hero:underline': HeroUnderline,
  'testimonials:editorial': TestimonialsEditorial,
  'testimonials:vertical-marquee': TestimonialsVerticalMarquee,
  'testimonials:voice': TestimonialsVoice,
  'logo-cloud:cinematic': LogoCloudCinematic,
  'logo-cloud:static-grid': LogoCloudStaticGrid,
  'pricing:comparison-table': PricingComparisonTable,
  'pricing:creative': PricingCreative,
  'stats:bold': StatsBold,
  'team:editorial': TeamEditorial,
  'features:integrations': FeaturesIntegrations,
  'features:bento-mosaic': FeaturesBentoMosaic,
  'cta:editorial': CTAEditorial,
  'footer:multi-column': FooterMultiColumn,
  'contact:compact-card': ContactCompactCard,
  'auth-form:split-panel': AuthSignIn,
  'data-table:striped-rows': DataTable,
  'auth-form:sign-up-card': AuthSignUp,
  'data-table:dashboard-overview': DashboardOverview,
};

export {
  AuthSignIn,
  DataTable,
  ContactCompactCard,
  FooterMultiColumn,
  CTAEditorial,
  FeaturesBentoMosaic,
  FeaturesIntegrations,
  TeamEditorial,
  StatsBold,
  PricingCreative,
  PricingComparisonTable,
  LogoCloudStaticGrid,
  LogoCloudCinematic,
  TestimonialsVoice,
  TestimonialsVerticalMarquee,
  TestimonialsEditorial,
  HeroUnderline,
  HeroVariableType,
  HeroImageFan,
  BeforeAfterCaseStudy,
  BeforeAfterGrid,
  BeforeAfterSlider,
  BlogPreviewHorizontalRail,
  BlogPreviewFeaturedGrid,
  BlogPreviewEditorial,
  LogoCloudWordmarkRow,
  LogoCloudBrandLockup,
  LogoCloudMarquee,
  LogoCloudGrid,
  TeamLeadSpotlight,
  TeamRosterRail,
  TeamPortraitGrid,
  StatsHighlight,
  StatsBandedGrid,
  StatsRow,
  FAQCards,
  FAQTwoColumn,
  FAQAccordion,
  AboutStoryPanel,
  AboutStatement,
  AboutEditorialSplit,
  FooterDarkBand,
  FooterCenteredMinimal,
  FooterColumns,
  ContactMinimalInline,
  ContactSplitCard,
  ContactCentered,
  ServicesCompactList,
  ServicesAlternating,
  ServicesCardGrid,
  FeaturesBentoGrid,
  FeaturesMinimalCentered,
  FeaturesIconLeft,
  FeaturesGrid,
  GalleryCollectionTiles,
  GalleryHorizontalReel,
  GalleryFeatureSplit,
  GalleryLightboxGrid,
  GalleryCinematicGrid,
  GalleryMasonry,
  GalleryEditorialMosaic,
  PricingAccordion,
  PricingComparison,
  PricingTiers,
  TestimonialsSpotlight,
  TestimonialsRail,
  CTASplitCard,
  CTAGradientBanner,
  CTACentered,
  HeroShowcasePanel,
  HeroCommerceGradient,
  TestimonialsGrid,
  TestimonialsColumns,
  TestimonialsMarquee,
  PricingSpotlight,
  PricingFeatureTable,
  PricingBillingToggle,
  GalleryCaseStudy,
  HeroImageStream,
  HeroLaunchShowcase,
  HeroPrismaCinematic,
  HeroTunnelImmersive,
  HeroSpatialDepth,
  HeroCentered,
  HeroSplitImage,
  HeroFullBleed,
  HeroPageTitle,
  HeroEditorialBanner,
  CTAInsetPanel,
  CTASignalBanner,
  NavbarCatalogBar,
  NavbarFloatingPill,
  NavbarStandard,
  NavbarCenteredLogo,
  NavbarMinimalDark,
  FeaturesSpotlightCards,
  ServicesExpandable,
  ServicesEditorialRows,
  ServicesBentoSpotlight,
  ServicesProductCards,
  ContactCheckoutPanel,
  ContactMapStudio,
  ContactEditorialForm,
  FooterBrandSocial,
  AboutImageStory,
  FAQSearchable,
  FAQEditorial,
  StatsProofGrid,
  StatsMetricCards,
  TeamProfileCards,
  LogoCloudRevealTiles,
  BlogPreviewFourColumns,
  BeforeAfterRevealPanel,
};
