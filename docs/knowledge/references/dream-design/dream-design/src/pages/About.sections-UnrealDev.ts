import type React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import About from '../components/About';
import Stats from '../components/Stats';
import Team from '../components/Team';
import Testimonials from '../components/Testimonials';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

export const SECTION_MAP: Record<string, React.ComponentType<{ props: any }>> = {
  "navbar": Navbar,
  "hero": Hero,
  "about": About,
  "stats": Stats,
  "team": Team,
  "testimonials": Testimonials,
  "cta": CTA,
  "footer": Footer
};
