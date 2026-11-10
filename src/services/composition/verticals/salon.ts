import type { IndustryVerticalPack } from './types';

/** Composition profiles come from the dedicated salon registry entries. */
export const SALON: IndustryVerticalPack = {
  id: 'salon',
  label: 'Salons, beauty & wellness',
  keywords: ['salon', 'hair salon', 'beauty salon', 'nail salon', 'nail studio', 'nail bar', 'barber', 'barbers', 'barbershop', 'barber shop', 'braiding', 'braids', 'hairdresser', 'hair stylist', 'lash studio', 'lashes', 'brows', 'makeup artist', 'esthetician', 'aesthetician', 'skincare studio', 'day spa', 'wellness spa', 'med spa', 'massage', 'massage therapist', 'waxing', 'tattoo studio', 'tattoo parlour', 'beauty'],
  hostIndustry: 'salon',
  vocabulary: ['treatments', 'appointments', 'stylists', 'consultation', 'aftercare', 'patch test', 'gift cards'],
  contentObjects: [
    { id: 'treatment', label: 'Service or treatment', fields: ['name', 'duration', 'description', 'from price (owner pricing only)'], sample: 'Silk press · 90 min' },
    { id: 'stylist', label: 'Stylist or therapist', fields: ['name', 'specialism', 'portrait', 'booking link'], sample: 'Senior stylist · colour specialist' },
    { id: 'look', label: 'Look or result', fields: ['image', 'service', 'stylist'], sample: 'Balayage · by Ama' },
    { id: 'policy', label: 'Booking policy', fields: ['title', 'detail'], sample: '24-hour cancellation notice' },
  ],
  proofMechanisms: ['before/after looks', 'client reviews (owner-supplied or connected)', 'stylist credentials', 'product brands used (owner-supplied)'],
  interactions: [
    { id: 'salon-booking', label: 'appointment booking', keywords: ['book an appointment', 'online booking', 'book online', 'appointments', 'booking'], brief: 'Pick a treatment, stylist and time through the registered booking flow; confirmed only after backend acknowledgement.', certifiedFamilies: ['contact', 'services'], originalComponent: 'AppointmentPicker' },
    { id: 'treatment-menu', label: 'treatment menu', keywords: ['treatment menu', 'service menu', 'price list', 'treatments'], brief: 'Treatments grouped by category with durations; prices only from the owner.', certifiedFamilies: ['services', 'pricing'], originalComponent: 'TreatmentMenu' },
    { id: 'lookbook', label: 'lookbook', keywords: ['lookbook', 'our work', 'hair gallery', 'nail gallery', 'before and after'], brief: 'A gallery of looks, optionally before/after, credited to the stylist.', certifiedFamilies: ['gallery', 'before-after'], originalComponent: 'Lookbook' },
    { id: 'stylist-team', label: 'meet the stylists', keywords: ['meet the team', 'our stylists', 'our therapists', 'meet the stylists'], brief: 'Stylist cards with specialisms and a book-with action.', certifiedFamilies: ['team'], originalComponent: 'StylistCards' },
    { id: 'gift-cards', label: 'gift cards', keywords: ['gift card', 'gift cards', 'gift voucher', 'vouchers'], brief: 'Gift card options; purchase only with connected checkout, otherwise an enquiry.', certifiedFamilies: ['cta', 'pricing'], originalComponent: 'GiftCards' },
  ],
  variants: [
    { id: 'hair-salon', label: 'Hair salon or barber', keywords: ['hair salon', 'barber', 'barbershop', 'barber shop', 'hairdresser', 'braiding', 'braids', 'hair stylist'], vocabulary: ['cut and finish', 'colour', 'fades', 'protective styles'], signatureInteractions: ['salon-booking', 'lookbook', 'stylist-team'],
      pages: [{ title: 'Services', route: '/services', role: 'services', purpose: 'Cuts, colour and styling.' }, { title: 'Our Work', route: '/our-work', role: 'gallery', purpose: 'Recent looks.' }, { title: 'Team', route: '/team', role: 'about', purpose: 'Stylists and barbers.' }, { title: 'Book', route: '/book', role: 'booking', purpose: 'Book an appointment.' }],
      primaryAction: 'book an appointment', proof: ['lookbook', 'client reviews'] },
    { id: 'nails-lashes', label: 'Nails, lashes & brows', keywords: ['nail salon', 'nail studio', 'nail bar', 'lash studio', 'lashes', 'brows', 'makeup artist'], vocabulary: ['gel', 'extensions', 'infills', 'lamination'], signatureInteractions: ['treatment-menu', 'lookbook', 'salon-booking'],
      pages: [{ title: 'Treatments', route: '/treatments', role: 'services', purpose: 'Treatment menu.' }, { title: 'Gallery', route: '/gallery', role: 'gallery', purpose: 'Sets and looks.' }, { title: 'Book', route: '/book', role: 'booking', purpose: 'Book a treatment.' }],
      primaryAction: 'book a treatment', proof: ['gallery of sets', 'client reviews'] },
    { id: 'spa-wellness', label: 'Spa & wellness', keywords: ['day spa', 'wellness spa', 'med spa', 'massage', 'massage therapist', 'skincare studio', 'esthetician', 'aesthetician'], vocabulary: ['rituals', 'facials', 'body treatments', 'relaxation'], signatureInteractions: ['treatment-menu', 'salon-booking', 'gift-cards'],
      pages: [{ title: 'Treatments', route: '/treatments', role: 'services', purpose: 'Rituals and treatments.' }, { title: 'About', route: '/about', role: 'about', purpose: 'Our approach and therapists.' }, { title: 'Gift Cards', route: '/gift-cards', role: 'custom', purpose: 'Give a treatment.' }, { title: 'Book', route: '/book', role: 'booking', purpose: 'Reserve a treatment.' }],
      primaryAction: 'reserve a treatment', proof: ['therapist credentials', 'guest reviews'] },
  ],
  imagery: ['soft-lit treatment rooms', 'close detail of finished looks', 'stylists at work'],
  motion: ['calm fades', 'before/after reveal'],
  designTerms: ['calm', 'luxurious', 'editorial', 'soft', 'split image', 'serif'],
  honesty: ['Prices, durations and availability come from the owner.', 'Before/after images must be real client work supplied by the owner or clearly marked as illustrative.'],
  roleProfiles: {},
};
