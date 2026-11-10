import type { IndustryVerticalPack } from './types';

export const ECOMMERCE: IndustryVerticalPack = {
  id: 'ecommerce',
  label: 'Online stores & retail',
  keywords: ['online store', 'online shop', 'ecommerce', 'e-commerce', 'shop', 'store', 'webshop', 'retail', 'clothing brand', 'fashion brand', 'fashion label', 'apparel', 'streetwear', 'jewellery', 'jewelry', 'skincare brand', 'cosmetics brand', 'candles', 'handmade', 'homeware', 'furniture store', 'sneakers', 'bookshop', 'bookstore', 'florist', 'flower shop', 'pet store', 'gift shop', 'boutique', 'dtc brand', 'direct to consumer'],
  hostIndustry: 'ecommerce',
  vocabulary: ['collections', 'new arrivals', 'bestsellers', 'sizes', 'shipping', 'returns', 'restock', 'bundles'],
  contentObjects: [
    { id: 'product', label: 'Product', fields: ['name', 'price (owner catalog only)', 'variants', 'images', 'description', 'materials'], sample: 'Kente tote · natural (sample product)' },
    { id: 'collection', label: 'Collection', fields: ['title', 'story', 'cover image', 'products'], sample: 'Harmattan drop' },
    { id: 'policy', label: 'Shipping & returns policy', fields: ['title', 'detail'], sample: 'Free returns within 14 days (owner policy only)' },
    { id: 'review', label: 'Product review', fields: ['author', 'rating', 'text', 'product'], sample: 'Owner-supplied or connected reviews only' },
  ],
  proofMechanisms: ['product reviews (connected or owner-supplied)', 'press and stockists (owner-supplied)', 'user photos', 'materials and craft story'],
  interactions: [
    { id: 'product-grid', label: 'product grid with filters', keywords: ['product grid', 'shop by category', 'filter products', 'product catalog', 'product catalogue'], brief: 'Products from the connected catalog with category and size filters; samples are visibly labelled.', certifiedFamilies: ['services', 'gallery'], originalComponent: 'ProductGrid', sampleDataRequired: true },
    { id: 'quick-add', label: 'add to bag', keywords: ['add to cart', 'add to bag', 'shopping cart', 'cart', 'checkout'], brief: 'Add-to-bag through the canonical commerce adapter with a persistent count; checkout stays server-priced and provider-gated.', certifiedFamilies: ['services'], originalComponent: 'AddToBag' },
    { id: 'collection-story', label: 'collection story', keywords: ['lookbook', 'collection story', 'new collection', 'campaign'], brief: 'An editorial campaign moment that leads into the collection.', certifiedFamilies: ['gallery', 'about'], originalComponent: 'CollectionStory' },
    { id: 'size-guide', label: 'size guide', keywords: ['size guide', 'size chart', 'fit guide'], brief: 'A clear size table with fit notes from the owner.', certifiedFamilies: ['faq', 'features'], originalComponent: 'SizeGuide' },
    { id: 'shipping-info', label: 'shipping & returns', keywords: ['shipping and returns', 'delivery information', 'returns policy', 'free shipping'], brief: 'Delivery zones, times and returns exactly as the owner states them.', certifiedFamilies: ['faq', 'features'], originalComponent: 'ShippingReturns' },
    { id: 'drop-signup', label: 'drop / restock alerts', keywords: ['restock alert', 'drop alert', 'join the list', 'early access', 'launch list'], brief: 'Email signup for drops through the registered newsletter form.', certifiedFamilies: ['cta', 'contact'], originalComponent: 'DropSignup' },
  ],
  // General store leads: it is the fallback when the owner names no product type.
  variants: [
    { id: 'general-store', label: 'General online store', keywords: ['general store', 'retail', 'bookshop', 'bookstore', 'pet store', 'electronics store'], vocabulary: ['categories', 'bestsellers', 'deals'], signatureInteractions: ['product-grid', 'quick-add', 'drop-signup'],
      pages: [{ title: 'Shop', route: '/shop', role: 'shop', purpose: 'Browse categories.' }, { title: 'About', route: '/about', role: 'about', purpose: 'Who we are.' }, { title: 'Contact', route: '/contact', role: 'contact', purpose: 'Order help.' }],
      primaryAction: 'shop now', proof: ['reviews', 'delivery promise (owner-stated)'] },
    { id: 'fashion', label: 'Fashion & accessories', keywords: ['clothing brand', 'fashion brand', 'fashion label', 'apparel', 'streetwear', 'jewellery', 'jewelry', 'sneakers', 'boutique'], vocabulary: ['drops', 'lookbook', 'fit', 'fabric'], signatureInteractions: ['collection-story', 'product-grid', 'size-guide'],
      pages: [{ title: 'Shop', route: '/shop', role: 'shop', purpose: 'All products.' }, { title: 'Lookbook', route: '/lookbook', role: 'gallery', purpose: 'The collection in context.' }, { title: 'About', route: '/about', role: 'about', purpose: 'Brand story.' }, { title: 'Help', route: '/help', role: 'faq', purpose: 'Sizing, shipping, returns.' }],
      primaryAction: 'shop the collection', proof: ['reviews', 'press'] },
    { id: 'beauty-home', label: 'Beauty, home & lifestyle goods', keywords: ['skincare brand', 'cosmetics brand', 'candles', 'homeware', 'furniture store', 'handmade', 'gift shop', 'florist', 'flower shop'], vocabulary: ['ingredients', 'rituals', 'materials', 'gift sets'], signatureInteractions: ['product-grid', 'quick-add', 'shipping-info'],
      pages: [{ title: 'Shop', route: '/shop', role: 'shop', purpose: 'Products.' }, { title: 'Our Story', route: '/our-story', role: 'about', purpose: 'How it is made.' }, { title: 'FAQ', route: '/faq', role: 'faq', purpose: 'Orders and delivery.' }],
      primaryAction: 'add to bag', proof: ['reviews', 'ingredients or materials'] },
  ],
  imagery: ['clean product photography on considered backgrounds', 'products in use', 'campaign imagery'],
  motion: ['image swap on product cards', 'smooth bag count update'],
  designTerms: ['product-led', 'clean', 'editorial', 'grid', 'bold', 'campaign'],
  honesty: ['Prices, stock and shipping come from the connected catalog or owner; samples are labelled.', 'Never accept payment without a connected checkout; reviews only when real.'],
  roleProfiles: {
    home: {
      narrativeGoals: ['show the products immediately', 'tell the brand story in one moment', 'move visitors into the shop'],
      requiredCapabilities: [], domainVocabulary: ['new arrivals', 'collections', 'bestsellers'],
      character: { density: 'medium', mediaDominance: 0.85, informationDensity: 0.6, conversionPressure: 0.75 },
      preferredFamilies: ['hero', 'services', 'gallery', 'about', 'testimonials', 'cta'],
      sectionOrderCandidates: [['hero', 'services', 'gallery', 'testimonials', 'cta'], ['hero', 'gallery', 'services', 'about', 'cta'], ['hero', 'services', 'features', 'cta']],
      heroCandidates: ['immersive-media', 'split-media'], geometryCandidates: ['full-bleed', 'grid', 'asymmetric'],
      preferredCompositionPatterns: ['featured products in the first scroll', 'campaign image break'],
      discouragedCompositionPatterns: ['long text-only intro', 'team-first story'], noveltyBudget: 0.55,
    },
  },
};
