/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, Sparkles } from '../../unison/ui/icons';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const User = __LucideIcons['User'] || __LucideFallback;
const Filter = __LucideIcons['Filter'] || __LucideFallback;
const Grid = __LucideIcons['Grid'] || __LucideFallback;
const Archive = __LucideIcons['Archive'] || __LucideFallback;

interface Project {
  id: string;
  title: string;
  category: string;
  description: string;
  stats: string;
  tags: string[];
}

const PROJECTS: Project[] = [
  {
    id: 'aura-os',
    title: 'AURA OS — Spatial FinTech Interface',
    category: 'UI/UX Systems',
    description: 'A dark-mode spatial dashboard for algorithmic asset management, featuring real-time telemetry and modular widgets.',
    stats: '+320% User Retention',
    tags: ['Design System', 'FinTech', 'Data Visualization'],
  },
  {
    id: 'neo-monolith',
    title: 'NEO MONOLITH — Architectural E-Commerce',
    category: 'Brand Platforms',
    description: 'Minimalist e-commerce experience for luxury architectural materials with 3D product previews and instant spec downloads.',
    stats: '$4.2M Launch Sales',
    tags: ['E-Commerce', 'Brand System', 'Web3'],
  },
  {
    id: 'velocity-health',
    title: 'VELOCITY — Telehealth Companion App',
    category: 'Mobile Apps',
    description: 'Mobile health monitoring app paired with AI diagnostic insights and frictionless doctor appointment booking.',
    stats: '4.9★ App Store Rating',
    tags: ['Mobile iOS/Android', 'Healthcare', 'AI UX'],
  },
  {
    id: 'kinetic-motion',
    title: 'KINETIC — High Performance Automotive',
    category: 'Brand Platforms',
    description: 'Interactive web platform showcasing electric supercars with custom vehicle configurators and sound soundscapes.',
    stats: '1.2M Unique Visitors',
    tags: ['Interactive UX', '3D Configurator', 'Motion'],
  },
];

export const HomeGallery: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeProjectModal, setActiveProjectModal] = useState<Project | null>(null);

  const categories = ['All', 'UI/UX Systems', 'Mobile Apps', 'Brand Platforms'];

  const filteredProjects = selectedCategory === 'All'
    ? PROJECTS
    : PROJECTS.filter((p) => p.category === selectedCategory);

  return (
    <section
      data-ut-variant="gallery:cinematic-grid"
      className="py-24 bg-background border-y border-border text-foreground relative"
     data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:60:5" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#dfca316a7276a066" data-ut-source-hash="988beaaacad08696">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:64:7" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:66:9" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
          <div className="space-y-3" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:67:11" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:68:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
              <Sparkles className="w-3.5 h-3.5" />
              <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:70:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Curated Portfolio</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:72:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#23e41555b5eb54d9" data-ut-source-hash="988beaaacad08696">
              Selected Case Studies
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:75:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#23b9452d70a7a291" data-ut-source-hash="988beaaacad08696">
              Architecting high-converting digital products, mobile ecosystems, and scalable design systems for visionary clients.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:81:11" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground font-bold shadow-md'
                    : 'bg-black border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
               data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:83:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#e1c153cff440e653" data-ut-source-hash="988beaaacad08696">
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Project Cards Grid - Pure Black Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:100:9" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="ut-foundation-card bg-black border border-border p-6 rounded-lg flex flex-col justify-between group hover:border-primary/50 transition-all duration-300 shadow-xl"
             data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:102:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
              <div className="space-y-4" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:106:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                {/* Photo Media Frame */}
                <div className="h-60 rounded bg-black border border-border/80 overflow-hidden relative group-hover:scale-[1.01] transition-transform" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:108:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                  <img
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                    alt={project.title}
                    className="w-full h-full object-cover bg-black"
                   data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:109:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#1f70c1eed92d6782" data-ut-source-hash="988beaaacad08696"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90"  data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:114:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696"/>
                  
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:116:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                    <span className="px-2.5 py-1 rounded bg-black/90 backdrop-blur-sm border border-border text-[10px] font-mono text-primary uppercase font-bold" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:117:21" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">
                      {project.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-primary-foreground bg-primary/90 px-2 py-0.5 rounded border border-border/40" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:120:21" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">
                      {project.stats}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-muted-foreground z-10" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:125:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                    <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:126:21" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">STUDIO VERIFIED</span>
                    <button
                      type="button"
                      onClick={() => setActiveProjectModal(project)}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                     data-ut-intent="nav.goto" data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-path="/work" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Inspect Case Study" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:127:21" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#e1c153cff440e653" data-ut-source-hash="988beaaacad08696">
                      <Eye className="w-3.5 h-3.5" />
                      <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:133:23" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Inspect Case Study</span>
                    </button>
                  </div>
                </div>

                <div data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:138:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                  <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground group-hover:text-primary transition-colors" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:139:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#33e38c7206b6942e" data-ut-source-hash="988beaaacad08696">
                    {project.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:142:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#23b9452d70a7a291" data-ut-source-hash="988beaaacad08696">
                    {project.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:147:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-muted-foreground border border-border/60"
                     data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:149:21" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-border/60 flex items-center justify-between" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:159:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                <button
                  type="button"
                  onClick={() => setActiveProjectModal(project)}
                  className="text-xs font-bold uppercase tracking-wider text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                 data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:160:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#e1c153cff440e653" data-ut-source-hash="988beaaacad08696">
                  <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:165:19" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Read Breakdown</span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* View All Projects Footer CTA */}
        <div className="mt-16 text-center" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:174:9" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
          <Link
            to="/work"
            data-ut-intent="nav.goto"
            data-ut-path="/work"
            className="btn-secondary py-3 px-8 text-xs font-extrabold uppercase tracking-widest inline-flex items-center gap-2"
            data-intent="nav.goto"
            data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
            data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
            data-ut-target-type="page"
            data-ut-ui-action="navigate"
            data-ut-preflight="1"
            data-ut-label="Explore Complete Work Archive"
          >
            <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:188:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Explore Complete Work Archive</span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </Link>
        </div>
      </div>

      {/* Lightbox / Inspection Modal */}
      {activeProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in-up" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:196:9" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
          <div className="bg-black border border-border p-6 sm:p-8 rounded-lg max-w-2xl w-full text-foreground space-y-6 relative shadow-2xl" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:197:11" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
            <button
              type="button"
              onClick={() => setActiveProjectModal(null)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
             data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:198:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#e1c153cff440e653" data-ut-source-hash="988beaaacad08696">
              ✕
            </button>

            <div className="space-y-2" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:206:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:207:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">
                {activeProjectModal.category}
              </span>
              <h3 className="text-2xl font-heading font-[number:var(--ut-weight-display)] uppercase" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:210:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#33e38c7206b6942e" data-ut-source-hash="988beaaacad08696">
                {activeProjectModal.title}
              </h3>
            </div>

            <div className="p-4 bg-black border border-border rounded text-xs space-y-2 font-mono" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:215:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
              <div className="flex justify-between border-b border-border/60 pb-2" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:216:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                <span className="text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:217:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Impact Metric:</span>
                <span className="text-primary font-bold" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:218:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">{activeProjectModal.stats}</span>
              </div>
              <div className="flex justify-between" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:220:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
                <span className="text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:221:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Lead Designer:</span>
                <span className="text-foreground" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:222:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">Eman Amanni</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:226:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#23b9452d70a7a291" data-ut-source-hash="988beaaacad08696">
              {activeProjectModal.description} This project included comprehensive user journey mapping, design system creation, motion language definition, and final developer implementation specs.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-border" data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:230:13" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#a8611d7a593715ae" data-ut-source-hash="988beaaacad08696">
              <button
                type="button"
                onClick={() => setActiveProjectModal(null)}
                className="btn-secondary py-2 px-4 text-xs uppercase"
               data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:231:15" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#e1c153cff440e653" data-ut-source-hash="988beaaacad08696">
                Close Preview
              </button>
              <Link
                to="/work"
                onClick={() => setActiveProjectModal(null)}
                data-ut-intent="nav.goto"
                data-ut-path="/work"
                className="btn-primary py-2 px-5 text-xs font-bold uppercase"
                data-intent="nav.goto"
                data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
                data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
                data-ut-target-type="page"
                data-ut-ui-action="navigate"
                data-ut-preflight="1"
                data-ut-label="View Full Case Study"
              >
                <span data-ut-source-locator="/src/project-components/home/HomeGallery.tsx:252:17" data-ut-source-ast="/src/project-components/home/HomeGallery.tsx#90d7ae6bc42371f7" data-ut-source-hash="988beaaacad08696">View Full Case Study</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
export default HomeGallery;