/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Key = __LucideIcons['Key'] || __LucideFallback;

const X = __LucideIcons['X'] || __LucideFallback;
const Sparkles = __LucideIcons['Sparkles'] || __LucideFallback;
const TrendingUp = __LucideIcons['TrendingUp'] || __LucideIcons['Trendingup'] || __LucideFallback;
const Layers = __LucideIcons['Layers'] || __LucideFallback;
const CheckCircle2 = __LucideIcons['CheckCircle2'] || __LucideIcons['Checkcircle2'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;

export interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  client: string;
  year: string;
  impactMetric: string;
  impactLabel: string;
  problem: string;
  solution: string;
  treatmentDetails: string[];
  results: string[];
}

interface CaseStudyModalProps {
  project: ProjectData | null;
  onClose: () => void;
  onRequestAvailability: (projectName: string) => void;
}

export const CaseStudyModal: React.FC<CaseStudyModalProps> = ({
  project,
  onClose,
  onRequestAvailability,
}) => {
  if (!project) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-study-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-lg animate-fade-in-up"
     data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:33:5" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
      <div className="relative w-full max-w-4xl bg-card border border-border p-6 sm:p-10 shadow-2xl rounded-lg text-foreground max-h-[92vh] overflow-y-auto" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:39:7" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close case study breakdown"
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
         data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:40:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#3a259926ea326d92" data-ut-source-hash="78ea64f1f19a0005">
          <X className="w-5 h-5" />
        </button>

        {/* Header Metadata */}
        <div className="space-y-4 border-b border-border/60 pb-6" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:50:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <div className="flex flex-wrap items-center gap-3" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:51:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <span className="bg-primary/10 border border-primary/30 text-primary px-3 py-1 rounded text-xs font-mono uppercase tracking-widest font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:52:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">
              {project.category}
            </span>
            <span className="text-xs font-mono text-muted-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:55:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">
              Client: <strong className="text-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:56:23" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#21a98bb943ab5325" data-ut-source-hash="78ea64f1f19a0005">{project.client}</strong> ({project.year})
            </span>
          </div>

          <h2 id="case-study-title" className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:60:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#ba67dcc57b359e21" data-ut-source-hash="78ea64f1f19a0005">
            {project.title}
          </h2>
          <p className="text-lg text-muted-foreground font-body leading-relaxed max-w-2xl" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:63:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#6dc6fe12941b4a06" data-ut-source-hash="78ea64f1f19a0005">
            {project.subtitle}
          </p>
        </div>

        {/* Hero Impact Band */}
        <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-4" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:69:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <div className="bg-muted/40 border border-border p-4 rounded space-y-1" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:70:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-primary font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:71:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
              <TrendingUp className="w-4 h-4" />
              <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:73:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">Proven Impact</span>
            </div>
            <div className="text-3xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:75:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
              {project.impactMetric}
            </div>
            <div className="text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:78:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">{project.impactLabel}</div>
          </div>

          <div className="md:col-span-2 bg-gradient-to-br from-card to-muted/60 border border-border p-4 rounded flex items-center justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:81:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <div className="space-y-1" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:82:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:83:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                Treatment Execution
              </div>
              <div className="text-sm font-semibold text-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:86:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                Cinematic Design Architecture & Modular Interface Engineering
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestAvailability(project.title);
              }}
              data-ut-cta="cta.card"
              data-ut-intent="lead.capture"
              className="btn-primary py-2.5 px-4 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shrink-0"
             data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:90:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#3a259926ea326d92" data-ut-source-hash="78ea64f1f19a0005">
              <Sparkles className="w-3.5 h-3.5" />
              <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:101:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">Request Availability</span>
            </button>
          </div>
        </div>

        {/* Token-styled UI Frame */}
        <div className="my-8 aspect-[16/9] bg-muted border border-border rounded overflow-hidden relative group" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:107:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <div className="absolute inset-0 bg-gradient-to-tr from-card via-muted to-primary/10 opacity-90"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:108:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005"/>
          <div className="absolute inset-0 p-8 flex flex-col justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:109:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <div className="flex items-center justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:110:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
              <div className="flex gap-2" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:111:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                <div className="w-3 h-3 rounded-full bg-primary/40"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:112:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005"/>
                <div className="w-3 h-3 rounded-full bg-border"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:113:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005"/>
                <div className="w-3 h-3 rounded-full bg-border"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:114:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005"/>
              </div>
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase bg-card/80 border border-border px-3 py-1 rounded" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:116:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                Eman Amanni Design Token Inspect
              </div>
            </div>
            <div className="space-y-3" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:120:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
              <div className="inline-block bg-primary text-primary-foreground font-mono text-xs px-3 py-1 font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:121:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                SYSTEM INTERFACE PREVIEW
              </div>
              <div className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:124:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                {project.title} Interface Protocol
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:127:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                <div className="h-12 bg-card/80 border border-border rounded p-2 text-[10px] font-mono text-muted-foreground flex flex-col justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:128:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                  <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:129:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">COMPONENT STATE</span>
                  <span className="text-primary font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:130:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">ACTIVE / FOCUSED</span>
                </div>
                <div className="h-12 bg-card/80 border border-border rounded p-2 text-[10px] font-mono text-muted-foreground flex flex-col justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:132:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                  <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:133:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">ACCESSIBILITY LEVEL</span>
                  <span className="text-foreground font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:134:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">WCAG AAA PASS</span>
                </div>
                <div className="h-12 bg-card/80 border border-border rounded p-2 text-[10px] font-mono text-muted-foreground flex flex-col justify-between" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:136:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                  <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:137:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">CONVERSION PATH</span>
                  <span className="text-primary font-bold" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:138:19" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">OPTIMIZED</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Problem vs Solution Narrative */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:146:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <div className="space-y-3 bg-muted/20 border border-border/80 p-5 rounded" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:147:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-[number:var(--ut-weight-display)] flex items-center gap-2" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:148:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#ac60f40bc4a88ebf" data-ut-source-hash="78ea64f1f19a0005">
              <span className="w-2 h-2 rounded-full bg-primary"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:149:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005"/>
              The UX Challenge
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:152:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#6dc6fe12941b4a06" data-ut-source-hash="78ea64f1f19a0005">
              {project.problem}
            </p>
          </div>

          <div className="space-y-3 bg-primary/5 border border-primary/30 p-5 rounded" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:157:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-[number:var(--ut-weight-display)] flex items-center gap-2" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:158:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#ac60f40bc4a88ebf" data-ut-source-hash="78ea64f1f19a0005">
              <span className="w-2 h-2 rounded-full bg-primary"  data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:159:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005"/>
              Eman Amanni Solution
            </h3>
            <p className="text-sm text-foreground leading-relaxed" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:162:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#6dc6fe12941b4a06" data-ut-source-hash="78ea64f1f19a0005">
              {project.solution}
            </p>
          </div>
        </div>

        {/* Key Treatment Pillars */}
        <div className="space-y-4 my-8" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:169:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <h3 className="text-xs font-heading uppercase tracking-widest text-foreground font-[number:var(--ut-weight-display)] flex items-center gap-2" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:170:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#ac60f40bc4a88ebf" data-ut-source-hash="78ea64f1f19a0005">
            <Layers className="w-4 h-4 text-primary" />
            <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:172:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">Deep Treatment Architecture</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:174:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
            {project.treatmentDetails.map((detail, idx) => (
              <div key={idx} className="bg-card border border-border p-3.5 rounded text-xs flex items-start gap-2.5" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:176:15" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-normal" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:178:17" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:185:9" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#5548e5e1548a4855" data-ut-source-hash="78ea64f1f19a0005">
          <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:186:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#6dc6fe12941b4a06" data-ut-source-hash="78ea64f1f19a0005">
            Want a similar transformation for your technology platform?
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestAvailability(project.title);
            }}
            data-ut-cta="cta.card"
            data-ut-intent="lead.capture"
            className="btn-primary w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
           data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:189:11" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#3a259926ea326d92" data-ut-source-hash="78ea64f1f19a0005">
            <span data-ut-source-locator="/src/project-components/work/CaseStudyModal.tsx:199:13" data-ut-source-ast="/src/project-components/work/CaseStudyModal.tsx#745f952e91e29d62" data-ut-source-hash="78ea64f1f19a0005">Request Availability</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default CaseStudyModal;
