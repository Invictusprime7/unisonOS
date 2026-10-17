import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Babel from '@babel/standalone';
import { describe, expect, it } from 'vitest';
import { getVariantById } from '@/sections/variants';
import { INTENT_REGISTRY } from '@/platform/core/intentSurfaceRegistry';
import recipes from '@/sections/recipes/stylexRecipes.generated.json';

function sources(directory: string): Array<[string, string]> {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path)
      : /\.[jt]sx?$/.test(path) ? [[path, readFileSync(path, 'utf8')] as [string, string]] : [];
  });
}

function contractIssues(name: string, source: string): string[] {
  const issues: string[] = [];
  const packages = (Babel as any).packages;
  const ast = packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const check = (key: string, value: any) => {
    if (value?.type !== 'StringLiteral') return;
    if (key === 'data-ut-variant' && !getVariantById(value.value)) {
      issues.push(`${name}: invalid variant ${value.value}`);
    }
    if (key === 'data-ut-intent' && !Object.prototype.hasOwnProperty.call(INTENT_REGISTRY, value.value)) {
      issues.push(`${name}: non-canonical intent ${value.value}`);
    }
  };
  packages.traverse.default(ast, {
    JSXAttribute(path: any) {
      const { name, value } = path.node;
      check(name.name, value?.type === 'JSXExpressionContainer' ? value.expression : value);
    },
    ObjectProperty(path: any) {
      if (!path.node.computed) check(path.node.key.value ?? path.node.key.name, path.node.value);
    },
  });
  return issues;
}

describe('component and portable recipe contract integrity', () => {
  it('uses registered section IDs and canonical intent literals in owned components', () => {
    const inputs = ['src/sections/components', 'src/sections/variants', 'src/sections/recipes']
      .flatMap(directory => sources(resolve(directory)));
    expect(inputs.flatMap(([name, source]) => contractIssues(name, source))).toEqual([]);
  });

  it('preserves registered IDs and canonical intents in compiled portable modules', () => {
    const inputs = Object.entries({ faq: recipes.faqModule, navigation: recipes.mobileNavigationModule, ...recipes.families });
    expect(inputs.flatMap(([name, source]) => contractIssues(name, source))).toEqual([]);
  });
});