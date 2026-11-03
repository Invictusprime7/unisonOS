/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));

const Sliders = __LucideIcons['Sliders'] || __LucideFallback;

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  title: string;
  subtitle: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Legacy Interface (Before)',
  afterLabel = 'DREAM Architecture (After)',
  title,
  subtitle,
}) => {
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div data-ut-variant="before-after:case-study" className="w-full" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:24:5" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:25:7" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
        <div data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:26:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-2" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:27:11" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
            <Sliders className="w-4 h-4" />
            <span data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:29:13" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ac838d5247d5dc7e" data-ut-source-hash="91ae172cd2385b30">Interactive Craft Proof</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:31:11" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#d590663ccaf7ed80" data-ut-source-hash="91ae172cd2385b30">
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:35:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#d8dabaa64f6d8a92" data-ut-source-hash="91ae172cd2385b30">
          {subtitle}
        </p>
      </div>

      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-lg overflow-hidden border border-border bg-card shadow-2xl select-none group" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:40:7" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
        {/* After Image (Background) */}
        <img
          src={afterImage}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover object-left"
         data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:42:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#9b0ba449cc3c7335" data-ut-source-hash="91ae172cd2385b30"/>
        <div className="absolute top-4 right-4 bg-primary text-primary-foreground font-mono text-[10px] sm:text-xs font-bold px-3 py-1 rounded shadow-md uppercase tracking-wider z-10" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:47:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
          {afterLabel}
        </div>

        {/* Before Image (Clipped Overlay) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
         data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:52:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
          <img
            src={beforeImage}
            alt={beforeLabel}
            className="absolute inset-0 w-full h-full object-cover object-left max-w-none"
            style={{ width: '100%', height: '100%' }}
           data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:56:11" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#9b0ba449cc3c7335" data-ut-source-hash="91ae172cd2385b30"/>
          <div className="absolute top-4 left-4 bg-muted/90 text-muted-foreground border border-border font-mono text-[10px] sm:text-xs font-bold px-3 py-1 rounded shadow-md uppercase tracking-wider z-10" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:62:11" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
            {beforeLabel}
          </div>
        </div>

        {/* Divider Bar */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize z-20"
          style={{ left: `${sliderPos}%` }}
         data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:68:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center shadow-lg" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:72:11" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
            <Sliders className="w-4 h-4" />
          </div>
        </div>

        {/* Native Range Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
          aria-label="Drag to compare before and after interface designs"
         data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:78:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#241e3c9676fa0d02" data-ut-source-hash="91ae172cd2385b30"/>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-mono" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:89:7" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ee9741254872b591" data-ut-source-hash="91ae172cd2385b30">
        <span data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:90:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ac838d5247d5dc7e" data-ut-source-hash="91ae172cd2385b30">◀ Drag handle to compare product transformation</span>
        <span className="text-primary font-bold" data-ut-source-locator="/src/project-components/about/BeforeAfterSlider.tsx:91:9" data-ut-source-ast="/src/project-components/about/BeforeAfterSlider.tsx#ac838d5247d5dc7e" data-ut-source-hash="91ae172cd2385b30">100% Bespoke Design Systems</span>
      </div>
    </div>
  );
};
export default BeforeAfterSlider;
