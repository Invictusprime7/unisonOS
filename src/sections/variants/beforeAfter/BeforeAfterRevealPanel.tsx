import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { BeforeAfterFrame, normalizePairs } from './BeforeAfterFrame';
/** Original implementation of the reveal-panel concept in 21st:24683; native range replaces motion globals. */
export const BeforeAfterRevealPanel: React.FC<BaseSectionProps<'before-after'>> = ({section,theme}) => {
 const pairs=normalizePairs(section.props.items); const [position,setPosition]=React.useState(50); const [active,setActive]=React.useState(0); const pair=pairs[Math.min(active,Math.max(0,pairs.length-1))];
 return <BeforeAfterFrame variantId="before-after:reveal-panel" theme={theme} headline={section.props.headline} subheadline={section.props.subheadline}>
 {pair && <figure className="m-0"><div className="relative aspect-video overflow-hidden" style={{borderRadius:theme.radius,background:hsl(theme.colors.muted)}}>
 <img src={pair.before || pair.after} alt={(pair.label || 'Result')+' before'} className="absolute inset-0 h-full w-full object-cover" loading="lazy"/>
 <img src={pair.after || pair.before} alt={(pair.label || 'Result')+' after'} className="absolute inset-0 h-full w-full object-cover" loading="lazy" style={{clipPath:'inset(0 '+(100-position)+'% 0 0)'}}/>
 <div aria-hidden="true" className="absolute inset-y-0 w-1" style={{left:position+'%',background:hsl(theme.colors.background)}}/>
 </div><label className="mt-5 block text-sm" style={{color:hsl(theme.colors.foreground)}}>Compare before and after<input className="mt-3 block w-full" style={{accentColor:hsl(theme.colors.primary)}} type="range" min={0} max={100} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>
 {pair.label && <figcaption data-ut-slot={`before-after.label`} className="mt-4 text-center">{pair.label}</figcaption>}{pair.description && <p data-ut-slot={`before-after.description`} className="mt-2 text-center">{pair.description}</p>}
 {pairs.length>1 && <div className="mt-5 flex flex-wrap justify-center gap-3">{pairs.map((item,i)=><button key={i} type="button" aria-pressed={i===active} onClick={()=>{setActive(i);setPosition(50);}} className="border px-4 py-2" style={{borderRadius:theme.radius,borderColor:hsl(theme.colors.border),color:hsl(theme.colors.foreground)}}>{item.label || 'Result '+(i+1)}</button>)}</div>}
 </figure>}</BeforeAfterFrame>;
};
