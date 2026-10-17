// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import viteConfig from '../../vite.config';

describe('Builder Babel browser initialization', () => {
  for (const command of ['serve', 'build'] as const) {
    it(`initializes AST helpers without a Node process in ${command}`, async () => {
      const environment = { command, mode: command === 'serve' ? 'development' : 'production' };
      const config = typeof viteConfig === 'function' ? await viteConfig(environment) : await viteConfig;
      expect(config.define?.['process.env.BABEL_TYPES_8_BREAKING']).toBe('undefined');
      const result = await build({
        stdin: {
          contents: "import * as t from '@babel/types'; export const node = t.jsxIdentifier('Heading'); export const valid = t.isJSXIdentifier(node);",
          resolveDir: process.cwd(),
        },
        bundle: true,
        platform: 'browser',
        format: 'iife',
        globalName: 'EditorAst',
        write: false,
        define: config.define,
      });
      const output = result.outputFiles?.[0];
      if (!output) throw new Error('Browser bundle was not produced');
      const sandbox: { EditorAst?: { node: { name: string }; valid: boolean } } = {};
      runInNewContext(output.text, sandbox);
      expect(sandbox.EditorAst?.node.name).toBe('Heading');
      expect(sandbox.EditorAst?.valid).toBe(true);
      expect('process' in sandbox).toBe(false);
    });
  }
});