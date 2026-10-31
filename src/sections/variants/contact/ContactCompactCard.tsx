import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
/** Unison original, inspired by the 21st.dev listing "Contact Card — Shaban Haider" (layout idea only; no third-party code). */
export const ContactCompactCard: React.FC<BaseSectionProps<'contact'>> = ({section,theme}) => {
  const p = section.props; const fields = p.fields?.length ? p.fields : [{name:'email',type:'email',placeholder:'Email',required:true}];
  const input = {borderRadius:theme.radius,border:`1px solid ${hsl(theme.colors.border)}`,background:hsl(theme.colors.background),color:hsl(theme.colors.foreground)};
  return <section data-ut-variant="contact:compact-card" style={{padding:theme.sectionPadding,background:hsl(theme.colors.muted)}}>
    <div className="mx-auto px-5 sm:px-6 lg:px-8" style={{maxWidth:theme.containerWidth}}><div className="mx-auto grid max-w-4xl overflow-hidden md:grid-cols-2" style={{borderRadius:theme.radius,background:hsl(theme.colors.card),border:`1px solid ${hsl(theme.colors.border)}`}}>
      <div className="p-8" style={{background:hsl(theme.colors.primary),color:hsl(theme.colors.primaryForeground)}}>
        {p.headline && <h2 data-ut-slot="contact.headline" className="text-3xl" style={{fontFamily:theme.typography.headingFont}}>{p.headline}</h2>}
        {p.description && <p data-ut-slot="contact.description" className="mt-3 text-sm opacity-80">{p.description}</p>}
        <dl className="mt-8 space-y-3 text-sm">{p.email && <div><dt className="opacity-70">Email</dt><dd data-ut-slot="contact.email">{p.email}</dd></div>}{p.phone && <div><dt className="opacity-70">Phone</dt><dd data-ut-slot="contact.phone">{p.phone}</dd></div>}{p.address && <div><dt className="opacity-70">Address</dt><dd data-ut-slot="contact.address">{p.address}</dd></div>}</dl>
      </div>
      <form data-demo-form="true" data-ut-intent={p.submitIntent||'contact.submit'} className="flex flex-col gap-4 p-8">
        {fields.map((f)=><label key={f.name} className="flex flex-col gap-1 text-sm" style={{color:hsl(theme.colors.foreground)}}><span>{f.label || f.name.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</span>{f.type==='textarea'?<textarea name={f.name} required={f.required} placeholder={f.placeholder} rows={4} className="p-3" style={input} />:<input name={f.name} type={f.type} required={f.required} placeholder={f.placeholder} className="min-h-11 px-3" style={input} />}</label>)}
        <button type="submit" data-ut-intent={p.submitIntent||'contact.submit'} className="min-h-11 px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{borderRadius:theme.radius,background:hsl(theme.colors.primary),color:hsl(theme.colors.primaryForeground)}}>{p.submitLabel||'Send'}</button>
      </form></div></div></section>;
};
