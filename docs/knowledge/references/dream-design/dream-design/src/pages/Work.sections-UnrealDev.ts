import type React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Gallery from '../components/Gallery';
import CTA from '../components/CTA';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';

export const SECTION_MAP: Record<string, React.ComponentType<{ props: any }>> = {
  "navbar": Navbar,
  "hero": Hero,
  "gallery": Gallery,
  "cta": CTA,
  "testimonials": Testimonials,
  "footer": Footer
};
