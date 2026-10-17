import { parse } from '@babel/parser';
import valueParser from 'postcss-value-parser';

/** Validate static class values before acceptance; never rewrite saved source in preview. */
export function invalidArbitraryClasses(source: string): string[] {
  const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
  const failures = new Set<string>();
  const check = (classes: string) => {
    // Spaces inside an arbitrary value split a Tailwind candidate; underscores are required instead.
    for (const candidate of classes.split(/\s+/)) {
      if (!candidate.includes('[') || candidate.startsWith('[')) continue; // arbitrary selectors are not CSS values
      const start = candidate.indexOf('[');
      const end = candidate.lastIndexOf(']');
      const raw = candidate.slice(start + 1, end);
      let invalid = end < start || !raw || /\$\{|\b(?:undefined|NaN)\b/.test(raw);
      if (!invalid) {
        const parsed = valueParser(raw.replace(/(?<!\\)_/g, ' '));
        parsed.walk(node => {
          if ('unclosed' in node && node.unclosed) invalid = true;
          if (node.type === 'function' && node.value === 'var' && !valueParser.stringify(node.nodes).trim().startsWith('--')) invalid = true;
        });
        if (/[;{}]/.test(raw)) invalid = true;
      }
      if (invalid) failures.add(`Invalid Tailwind arbitrary value: ${candidate}. Use a complete token-backed value; use underscores for spaces.`);
    }
  };
  const strings = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'StringLiteral') check(node.value);
    if (node.type === 'TemplateLiteral') {
      // Static portions can span expressions; dynamic classes cannot be compiled by Tailwind.
      const text = node.quasis.map((q: any) => q.value.cooked ?? q.value.raw).join('${dynamic}');
      check(text);
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(strings);
      else if (value && typeof value === 'object') strings(value);
    }
  };
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXAttribute' && ['className', 'class'].includes(node.name?.name)) strings(node.value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  return [...failures];
}