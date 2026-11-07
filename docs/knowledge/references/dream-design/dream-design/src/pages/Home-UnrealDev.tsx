/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// @unison-ai-authored role=home design=e37f99de
import React, { useState, useEffect } from 'react';
import { ProjectData } from '../project-components/ProjectData';
import { SiteNav } from '../project-components/site/SiteNav';
import { SiteFooter } from '../project-components/site/SiteFooter';
import { HomeHero } from '../project-components/home/HomeHero';

import { HomeServices } from '../project-components/home/HomeServices';
import { HomeTestimonials } from '../project-components/home/HomeTestimonials';
import { HomeAboutTeaser } from '../project-components/home/HomeAboutTeaser';
import { HomeCTA } from '../project-components/home/HomeCTA';
import { BeforeAfterSlider } from '../project-components/about/BeforeAfterSlider'; // Reusing from about page
import { ConsultationModal } from '../project-components/home/ConsultationModal';

import { ArrowRight, TrendingUp, Eye, ArrowUpRight } from '../unison/ui/icons';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Home = __LucideIcons['Home'] || __LucideFallback;
const Grid = __LucideIcons['Grid'] || __LucideFallback;

export default function WorkPage() {
  const [isOpen, setIsOpen] = React.useState(false);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeModalProject, setActiveModalProject] = useState<ProjectData | null>(null);
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [preselectedProjectName, setPreselectedProjectName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false); // State for form submission feedback

  const projects: ProjectData[] = [
    {
      id: 'nova-fintech',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
      category: 'Fintech & Banking',
      title: 'Nova Fintech Onboarding Flow',
      description: 'Streamlined user acquisition and enhanced security for a leading digital bank, increasing conversion by 30%.',
      tags: ['UX Design', 'Fintech', 'Mobile App'],
    },
    {
      id: 'aura-clinical',
      image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80',
      category: 'Healthcare & SaaS',
      title: 'Aura Clinical Dashboard',
      description: 'Designed an intuitive data visualization platform for clinicians, improving diagnostic accuracy and efficiency.',
      tags: ['SaaS', 'Healthcare', 'Data Visualization'],
    },
    {
      id: 'devpulse-suite',
      image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
      category: 'Developer Tools',
      title: 'DevPulse IDE Suite',
      description: 'Crafted a powerful, minimalist interface for developer tools, boosting productivity for engineering teams globally.',
      tags: ['Developer Tools', 'UI/UX', 'Productivity'],
    },
    {
      id: 'enterprise-analytics',
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
      category: 'Enterprise SaaS',
      title: 'Enterprise Analytics Platform',
      description: 'Reimagined complex enterprise data into actionable insights with a clean, modular design system.',
      tags: ['Enterprise SaaS', 'Dashboard', 'Data Analytics'],
    },
    {
      id: 'travel-companion',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
      category: 'Consumer Mobile',
      title: 'Travel Companion App',
      description: 'Created a delightful mobile travel planner that simplifies trip organization and enriches user experience.',
      tags: ['Mobile UX', 'Travel', 'Consumer App'],
    },
    {
      id: 'luxury-marketplace',
      image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80',
      category: 'E-Commerce & Luxury',
      title: 'Luxury Retail Marketplace',
      description: 'Developed an exclusive e-commerce platform blending high-end aesthetics with seamless shopping functionality.',
      tags: ['E-Commerce', 'Luxury', 'UI Design'],
    },
  ];

  const filteredProjects = selectedCategory === 'all'
    ? projects
    : projects.filter(project => project.category === selectedCategory);

  const handleConsultationSubmit = (formData: any) => {
    console.log("Consultation form submitted:", formData);
    setIsSubmitted(true);
    setPreselectedProjectName('');
  };

  const openConsultationWithProject = (projectName: string) => {
    setPreselectedProjectName(projectName);
    setIsConsultationOpen(true);
  };

  return (
    <div data-ut-page-role="home" className="min-h-screen bg-background text-foreground flex flex-col" data-ut-source-locator="/src/pages/Home.tsx:93:5" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
      <SiteNav onOpenConsultation={() => setIsConsultationOpen(true)} />

      <main className="flex-1 pt-24" data-ut-source-locator="/src/pages/Home.tsx:96:7" data-ut-source-ast="/src/pages/Home.tsx#4521f30093fb8864" data-ut-source-hash="9d0b1aafdfb0525b">
        {/* HERO SECTION */}
        <HomeHero onStartProject={() => setIsConsultationOpen(true)} />

        {/* ABOUT TEASER SECTION */}
        <HomeAboutTeaser />

        {/* SERVICES SECTION */}
        <HomeServices />

        {/* TESTIMONIALS SECTION */}
        <HomeTestimonials />

        {/* CASE STUDIES SECTION */}
        <section id="case-studies" className="relative py-16 lg:py-24" data-ut-source-locator="/src/pages/Home.tsx:110:9" data-ut-source-ast="/src/pages/Home.tsx#ff526208cf6fd984" data-ut-source-hash="9d0b1aafdfb0525b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/pages/Home.tsx:111:11" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
            <div className="text-center mb-12 max-w-3xl mx-auto" data-ut-source-locator="/src/pages/Home.tsx:112:13" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
              <img src="http://localhost:8080/__supabase/storage/v1/object/sign/user-files/2074c132-a431-4e1c-8a71-3aba70f630b1/site-uploads/c96b42ba-8cce-43cb-9be7-0a63ccdd8b6c/69cd25bc-3904-4380-9194-2315b93413bc-unison-logo.png?token=eyJraWQiOiIwMzkwZWZjZC1mYzU3LTQzMDAtODIwOS0zYTFmOTc0MWMyMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzLzIwNzRjMTMyLWE0MzEtNGUxYy04YTcxLTNhYmE3MGY2MzBiMS9zaXRlLXVwbG9hZHMvYzk2YjQyYmEtOGNjZS00M2NiLTliZTctMGE2M2NjZGQ4YjZjLzY5Y2QyNWJjLTM5MDQtNDM4MC05MTk0LTIzMTViOTM0MTNiYy11bmlzb24tbG9nby5wbmciLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzkyNjQxMTc0LCJleHAiOjIxMDgwMDExNzR9.ZVkViqXbj1rid9vvxj4_O_DslSqIaAAmZ2A5Vm4p3n4" alt="" loading="lazy" className="w-full aspect-video object-cover"  data-ut-source-locator="/src/pages/Home.tsx:113:15" data-ut-source-ast="/src/pages/Home.tsx#354b861c816f4fb8" data-ut-source-hash="9d0b1aafdfb0525b"/>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest mb-4" data-ut-source-locator="/src/pages/Home.tsx:114:15" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                <Eye className="w-3.5 h-3.5" />
                <span data-ut-source-locator="/src/pages/Home.tsx:116:17" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">Real Results</span>
              </div>
              <h1 className="ut-display text-3xl sm:text-5xl font-heading tracking-tight uppercase leading-[1.05] mb-4" data-ut-source-locator="/src/pages/Home.tsx:118:15" data-ut-source-ast="/src/pages/Home.tsx#9492f502b43e6bb6" data-ut-source-hash="9d0b1aafdfb0525b">
                Our Success Stories
              </h1>
              <p className="ut-lead text-muted-foreground" data-ut-source-locator="/src/pages/Home.tsx:121:15" data-ut-source-ast="/src/pages/Home.tsx#b956992f35aca9db" data-ut-source-hash="9d0b1aafdfb0525b">
                Explore how our strategic design transforms businesses and drives significant growth.
              </p>
              <div className="mt-8" data-ut-source-locator="/src/pages/Home.tsx:124:15" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                <a
                  href="#case-studies"
                  data-ut-intent="nav.goto"
                  className="btn-secondary py-3.5 px-6 text-sm font-bold uppercase tracking-wider group"
                  data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-path="/work" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Explore All Work" data-ut-source-locator="/src/pages/Home.tsx:125:17" data-ut-source-ast="/src/pages/Home.tsx#b18aebe46ad34818" data-ut-source-hash="9d0b1aafdfb0525b">
                  <span data-ut-source-locator="/src/pages/Home.tsx:130:19" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">Explore All Work</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* Project Categories */}
            <div className="flex flex-wrap gap-2 mb-12 justify-center" data-ut-source-locator="/src/pages/Home.tsx:137:13" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
                data-ut-intent="nav.goto" data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-path="/work" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="All Work" data-ut-source-locator="/src/pages/Home.tsx:138:15" data-ut-source-ast="/src/pages/Home.tsx#9ebbb1c1823b809d" data-ut-source-hash="9d0b1aafdfb0525b">
                All Work
              </button>
              {Array.from(new Set(projects.map(p => p.category))).map(category => (
                <button
                  type="button"
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                 data-ut-source-locator="/src/pages/Home.tsx:150:17" data-ut-source-ast="/src/pages/Home.tsx#9ebbb1c1823b809d" data-ut-source-hash="9d0b1aafdfb0525b">
                  {category}
                </button>
              ))}
            </div>

            {/* Project Grid - Black Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-ut-source-locator="/src/pages/Home.tsx:166:13" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-background border border-border rounded-lg overflow-hidden shadow-lg group hover-lift transition-transform duration-300"
                 data-ut-source-locator="/src/pages/Home.tsx:168:17" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                  <div className="relative aspect-video overflow-hidden" data-ut-source-locator="/src/pages/Home.tsx:172:19" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     data-ut-source-locator="/src/pages/Home.tsx:173:21" data-ut-source-ast="/src/pages/Home.tsx#354b861c816f4fb8" data-ut-source-hash="9d0b1aafdfb0525b"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"  data-ut-source-locator="/src/pages/Home.tsx:178:21" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b"/>
                    <div className="absolute bottom-4 left-4 right-4" data-ut-source-locator="/src/pages/Home.tsx:179:21" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                      <span className="text-xs text-primary font-mono uppercase tracking-widest font-bold block mb-1" data-ut-source-locator="/src/pages/Home.tsx:180:23" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">
                        {project.category}
                      </span>
                      <h3 className="text-xl font-heading text-foreground leading-tight" data-ut-source-locator="/src/pages/Home.tsx:183:23" data-ut-source-ast="/src/pages/Home.tsx#c3d88fc4a7dccd88" data-ut-source-hash="9d0b1aafdfb0525b">
                        {project.title}
                      </h3>
                    </div>
                  </div>
                  <div className="p-6" data-ut-source-locator="/src/pages/Home.tsx:188:19" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                    <p className="text-sm text-muted-foreground mb-4" data-ut-source-locator="/src/pages/Home.tsx:189:21" data-ut-source-ast="/src/pages/Home.tsx#b956992f35aca9db" data-ut-source-hash="9d0b1aafdfb0525b">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4" data-ut-source-locator="/src/pages/Home.tsx:192:21" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
                      {project.tags.map(tag => (
                        <span key={tag} className="badge badge-primary" data-ut-source-locator="/src/pages/Home.tsx:194:25" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openConsultationWithProject(project.title)}
                      data-ut-intent="lead.capture"
                      className="text-xs font-mono uppercase tracking-wider text-primary hover:underline inline-flex items-center gap-1.5"
                     data-ut-source-locator="/src/pages/Home.tsx:199:21" data-ut-source-ast="/src/pages/Home.tsx#9ebbb1c1823b809d" data-ut-source-hash="9d0b1aafdfb0525b">
                      <span data-ut-source-locator="/src/pages/Home.tsx:205:23" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">Request Availability</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BEFORE & AFTER ARCHITECTURE COMPARISON */}
        <section className="py-16 lg:py-24 border-b border-border" data-ut-source-locator="/src/pages/Home.tsx:216:9" data-ut-source-ast="/src/pages/Home.tsx#3e0443d4c3044038" data-ut-source-hash="9d0b1aafdfb0525b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/pages/Home.tsx:217:11" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
            <BeforeAfterSlider
              title="Before & After: See the Transformation"
              subtitle="Drag the slider to see how we turn complex systems into beautifully simple experiences, boosting user satisfaction."
              beforeImage="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80"
              afterImage="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80"
              beforeLabel="Cluttered Old Interface"
              afterLabel="Clean New Design"
            />
          </div>
        </section>

        {/* HOW WE TRANSFORM SECTION */}
        <section className="py-16 lg:py-24 border-b border-border" data-ut-source-locator="/src/pages/Home.tsx:230:9" data-ut-source-ast="/src/pages/Home.tsx#3e0443d4c3044038" data-ut-source-hash="9d0b1aafdfb0525b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center" data-ut-source-locator="/src/pages/Home.tsx:231:11" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest mb-4" data-ut-source-locator="/src/pages/Home.tsx:232:13" data-ut-source-ast="/src/pages/Home.tsx#984f0170da908a3c" data-ut-source-hash="9d0b1aafdfb0525b">
              <TrendingUp className="w-3.5 h-3.5" />
              <span data-ut-source-locator="/src/pages/Home.tsx:234:15" data-ut-source-ast="/src/pages/Home.tsx#d4bcc0e1a30c4185" data-ut-source-hash="9d0b1aafdfb0525b">Our Approach</span>
            </div>
            <h2 className="ut-display text-3xl sm:text-5xl font-heading tracking-tight uppercase leading-[1.05] mx-auto max-w-3xl" data-ut-source-locator="/src/pages/Home.tsx:236:13" data-ut-source-ast="/src/pages/Home.tsx#66da387f975faf1b" data-ut-source-hash="9d0b1aafdfb0525b">
              Turning Good Products into Great Experiences
            </h2>
            <p className="ut-lead text-muted-foreground mx-auto max-w-2xl mt-4" data-ut-source-locator="/src/pages/Home.tsx:239:13" data-ut-source-ast="/src/pages/Home.tsx#b956992f35aca9db" data-ut-source-hash="9d0b1aafdfb0525b">
              Our expert design process focuses on transforming your digital products into intuitive, high-performing tools that users love and businesses rely on.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-28 relative" data-ut-source-locator="/src/pages/Home.tsx:246:9" data-ut-source-ast="/src/pages/Home.tsx#3e0443d4c3044038" data-ut-source-hash="9d0b1aafdfb0525b">
          <HomeCTA onStartProject={() => setIsConsultationOpen(true)} />
        </section>
      </main>

      <SiteFooter />

      <ConsultationModal
        isOpen={isConsultationOpen}
        onClose={() => setIsConsultationOpen(false)}
        onSubmit={handleConsultationSubmit}
        preselectedProjectName={preselectedProjectName}
        isSubmitted={isSubmitted}
        onReset={() => setIsSubmitted(false)}
      />
    </div>
  );
}