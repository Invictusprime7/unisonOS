import type React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Gallery from '../components/Gallery';
import Services from '../components/Services';
import About from '../components/About';
import Pricing from '../components/Pricing';
import Testimonials from '../components/Testimonials';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

export const SECTION_MAP: Record<string, React.ComponentType<{ props: any }>> = {
  "navbar": Navbar,
  "hero": Hero,
  "gallery": Gallery,
  "services": Services,
  "about": About,
  "pricing": Pricing,
  "testimonials": Testimonials,
  "cta": CTA,
  "footer": Footer
};
