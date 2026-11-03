/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Target = __LucideIcons['Target'] || __LucideFallback;

const X = __LucideIcons['X'] || __LucideFallback;
const Sparkles = __LucideIcons['Sparkles'] || __LucideFallback;
const CheckCircle2 = __LucideIcons['CheckCircle2'] || __LucideIcons['Checkcircle2'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;
const Clock = __LucideIcons['Clock'] || __LucideFallback;
const ShieldCheck = __LucideIcons['ShieldCheck'] || __LucideIcons['Shield'] || __LucideIcons['Shieldcheck'] || __LucideFallback;

interface WorkConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProject?: string;
}

export const WorkConsultationModal: React.FC<WorkConsultationModalProps> = ({
  isOpen,
  onClose,
  preselectedProject = '',
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    budget: '$15k - $30k',
    timeline: 'Within 1 month',
    details: preselectedProject ? `Inquiry regarding ${preselectedProject}` : '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const resetAndClose = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in-up"
     data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:38:5" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
      <div className="relative w-full max-w-2xl bg-card border border-border p-6 sm:p-10 shadow-2xl rounded-lg text-foreground max-h-[90vh] overflow-y-auto" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:44:7" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
        <button
          type="button"
          onClick={resetAndClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
         data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:45:9" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#ea2d734b8b020b37" data-ut-source-hash="be0106c7e97e7563">
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-6" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:55:11" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
            <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mx-auto text-primary" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:56:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:59:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
              <h3 className="text-2xl font-heading font-[number:var(--ut-weight-display)] uppercase" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:60:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#6e47cfd62df26eea" data-ut-source-hash="be0106c7e97e7563">
                Consultation Requested
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:63:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#d06413290dfa6815" data-ut-source-hash="be0106c7e97e7563">
                Thank you, <span className="text-foreground font-semibold" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:64:28" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">{formData.name}</span>. Eman Amanni will review your project requirements and respond within 24 hours with availability and next steps.
              </p>
            </div>
            <div className="bg-muted/40 border border-border p-4 rounded text-xs text-left space-y-1 font-mono" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:67:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
              <div className="flex justify-between" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:68:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <span className="text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:69:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">Scope/Project:</span>
                <span className="text-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:70:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">{formData.details || 'Design Architecture'}</span>
              </div>
              <div className="flex justify-between" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:72:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <span className="text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:73:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">Target Timeline:</span>
                <span className="text-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:74:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">{formData.timeline}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="btn-primary w-full py-3 text-xs uppercase font-bold tracking-wider"
             data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:77:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#ea2d734b8b020b37" data-ut-source-hash="be0106c7e97e7563">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-6" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:86:11" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
            <div className="space-y-2 border-b border-border/60 pb-4" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:87:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:88:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <Sparkles className="w-3.5 h-3.5" />
                <span data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:90:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">Direct Booking Path</span>
              </div>
              <h2 id="consultation-modal-title" className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:92:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#de4302bd41f46e09" data-ut-source-hash="be0106c7e97e7563">
                Schedule Design Consultation
              </h2>
              <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:95:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#d06413290dfa6815" data-ut-source-hash="be0106c7e97e7563">
                Discuss your product vision, system architecture, and availability directly with Eman Amanni.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:100:13" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#9e05e3e1d7ff4c05" data-ut-source-hash="be0106c7e97e7563">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:101:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <div className="space-y-1.5" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:102:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:103:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#41ee8bfb04c6cc3f" data-ut-source-hash="be0106c7e97e7563">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full bg-background border border-border px-3.5 py-2.5 text-sm rounded text-foreground focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:106:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#0c9b60a10fc8673d" data-ut-source-hash="be0106c7e97e7563"/>
                </div>
                <div className="space-y-1.5" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:115:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:116:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#41ee8bfb04c6cc3f" data-ut-source-hash="be0106c7e97e7563">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full bg-background border border-border px-3.5 py-2.5 text-sm rounded text-foreground focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:119:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#0c9b60a10fc8673d" data-ut-source-hash="be0106c7e97e7563"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:130:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <div className="space-y-1.5" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:131:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:132:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#41ee8bfb04c6cc3f" data-ut-source-hash="be0106c7e97e7563">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Vanguard Systems"
                    className="w-full bg-background border border-border px-3.5 py-2.5 text-sm rounded text-foreground focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:135:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#0c9b60a10fc8673d" data-ut-source-hash="be0106c7e97e7563"/>
                </div>
                <div className="space-y-1.5" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:143:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:144:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#41ee8bfb04c6cc3f" data-ut-source-hash="be0106c7e97e7563">
                    Estimated Budget Range
                  </label>
                  <select
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="w-full bg-background border border-border px-3.5 py-2.5 text-sm rounded text-foreground focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:147:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#d1478ca3acabbbcf" data-ut-source-hash="be0106c7e97e7563">
                    <option value="$10k - $15k" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:152:21" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#a22716fe4550f4d2" data-ut-source-hash="be0106c7e97e7563">$10k - $15k</option>
                    <option value="$15k - $30k" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:153:21" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#a22716fe4550f4d2" data-ut-source-hash="be0106c7e97e7563">$15k - $30k</option>
                    <option value="$30k - $50k" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:154:21" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#a22716fe4550f4d2" data-ut-source-hash="be0106c7e97e7563">$30k - $50k</option>
                    <option value="$50k+" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:155:21" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#a22716fe4550f4d2" data-ut-source-hash="be0106c7e97e7563">$50k+ Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:160:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:161:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#41ee8bfb04c6cc3f" data-ut-source-hash="be0106c7e97e7563">
                  Project Goals & Details
                </label>
                <textarea
                  rows={3}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Tell us about your product, current design challenges, or target design system..."
                  className="w-full bg-background border border-border px-3.5 py-2.5 text-sm rounded text-foreground focus:outline-none focus:border-primary"
                 data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:164:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#2b17b97570fe23b1" data-ut-source-hash="be0106c7e97e7563"/>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:173:15" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:174:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#fd9b47567239b912" data-ut-source-hash="be0106c7e97e7563">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:176:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">NDAs respected. Fast 24-hr response.</span>
                </div>
                <button
                  type="submit"
                  data-ut-cta="cta.card"
                  data-ut-intent="lead.capture"
                  className="btn-primary w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                 data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:178:17" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#ea2d734b8b020b37" data-ut-source-hash="be0106c7e97e7563">
                  <span data-ut-source-locator="/src/project-components/work/WorkConsultationModal.tsx:184:19" data-ut-source-ast="/src/project-components/work/WorkConsultationModal.tsx#4842bce7932b9bbb" data-ut-source-hash="be0106c7e97e7563">Submit Booking Request</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
export default WorkConsultationModal;

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen

// [sandpack] missing toggle state for: isOpen
