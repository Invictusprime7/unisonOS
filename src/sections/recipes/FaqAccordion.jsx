import React from 'react';
import * as stylex from '@stylexjs/stylex';
import * as Accordion from '@/unison/ui/radix/accordion';
import { ChevronDown } from '@/unison/ui/icons';

const styles = stylex.create({
  section: {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    paddingBlock: 'var(--ut-section-space, 4rem)',
    paddingInline: '1.25rem',
  },
  container: { maxWidth: 'min(var(--ut-content-width, 72rem), 54rem)', marginInline: 'auto', minWidth: 0 },
  intro: { marginBottom: '2.5rem', maxWidth: '42rem' },
  heading: { fontFamily: 'var(--font-heading)', fontSize: '2rem', lineHeight: 1.2, letterSpacing: 0, overflowWrap: 'anywhere', margin: 0 },
  lead: { fontFamily: 'var(--font-body)', lineHeight: 1.6, color: 'hsl(var(--muted-foreground))', marginTop: '1rem' },
  item: { borderBottom: '1px solid hsl(var(--border))' },
  itemHeading: { margin: 0 },
  grid: {
    display: 'grid', gap: '2rem',
    gridTemplateColumns: { default: 'minmax(0, 1fr)', '@media (min-width: 48rem)': 'repeat(2, minmax(0, 1fr))' },
  },
  openItem: { minWidth: 0, paddingBlock: '1.5rem', borderTop: '1px solid hsl(var(--border))' },
  card: { padding: '1.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'min(var(--radius, 4px), 8px)', backgroundColor: 'hsl(var(--card))' },
  openQuestion: { marginTop: 0, marginBottom: '1rem', fontFamily: 'var(--font-heading)', fontSize: '1.125rem', lineHeight: 1.5, overflowWrap: 'anywhere' },
  trigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    width: '100%', minHeight: '3.5rem', paddingBlock: '1.25rem', paddingInline: '0.25rem',
    borderWidth: 0, backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'start',
    fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.5,
    color: { default: 'hsl(var(--foreground))', ':hover': 'hsl(var(--primary))' },
    outline: { default: 'none', ':focus-visible': '2px solid hsl(var(--ring))' },
    outlineOffset: '4px', borderRadius: 'min(var(--radius, 4px), 8px)',
  },
  question: { minWidth: 0, overflowWrap: 'anywhere' },
  icon: { flexShrink: 0, width: '1.25rem', height: '1.25rem', color: 'hsl(var(--muted-foreground))' },
  answer: {
    margin: 0, paddingBottom: '1.5rem', paddingInline: '0.25rem', maxWidth: '70ch',
    fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: 1.75,
    color: 'hsl(var(--muted-foreground))', overflowWrap: 'anywhere',
  },
});

export default function FAQ({ props, variantId }) {
  const { headline, subheadline } = props;
  const layoutVariants = { accordion: 'faq:accordion', 'two-column': 'faq:two-column', cards: 'faq:cards' };
  const selectedVariant = variantId || (Object.hasOwn(layoutVariants, props.layout) ? layoutVariants[props.layout] : 'faq:accordion');
  if (!['faq:accordion', 'faq:two-column', 'faq:cards'].includes(selectedVariant)) {
    throw new Error(`Unsupported FAQ variant: ${selectedVariant}`);
  }
  const items = (Array.isArray(props.items) ? props.items : []).flatMap((item, index) => {
    const question = String(item?.question ?? item?.title ?? '').trim();
    return question ? [{ question, answer: String(item?.answer ?? item?.body ?? item?.description ?? ''), identity: String(index) }] : [];
  });
  return (
    <section {...stylex.props(styles.section)} data-ut-variant={selectedVariant} data-ut-style-engine="stylex">
      <div {...stylex.props(styles.container)}>
        {headline && <div {...stylex.props(styles.intro)}>
          <h2 {...stylex.props(styles.heading)}>{headline}</h2>
          {subheadline && <p {...stylex.props(styles.lead)}>{subheadline}</p>}
        </div>}
        {selectedVariant !== 'faq:accordion' ? (
          <div {...stylex.props(styles.grid)}>
            {items.map(item => (
              <article key={item.identity} {...stylex.props(styles.openItem, selectedVariant === 'faq:cards' && styles.card)}>
                <h3 {...stylex.props(styles.openQuestion)}>{item.question}</h3>
                <p {...stylex.props(styles.answer)}>{item.answer}</p>
              </article>
            ))}
          </div>
        ) : <Accordion.Root type="single" collapsible>
          {items.map((item, index) => (
            <Accordion.Item key={item.id ?? index} value={String(item.id ?? index)} {...stylex.props(styles.item)}>
              <Accordion.Header {...stylex.props(styles.itemHeading)}>
                <Accordion.Trigger {...stylex.props(styles.trigger)}>
                  <span {...stylex.props(styles.question)}>{item.question}</span>
                  <ChevronDown aria-hidden="true" {...stylex.props(styles.icon)} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content data-ut-radix="accordion-content">
                <p {...stylex.props(styles.answer)}>{item.answer}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>}
      </div>
    </section>
  );
}