import { buildEditAssistantPrompt, buildGeneralBuilderPrompt } from './builderPrompts.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseOpts = {
  basePrompt: 'BASE',
  memoryBlock: '',
  compactedFilesBlock: '',
  surgicalReinforcement: '',
  researchContext: '',
  designContext: '',
  blueprintContext: '',
  elementsLibrary: '',
  thinkingInstruction: '',
};

Deno.test('edit prompt carries the Affinity reasoning flow contract', () => {
  const prompt = buildEditAssistantPrompt(baseOpts);
  assert(prompt.includes('AFFINITY'), 'prompt must name Affinity');
  assert(prompt.includes('**Understanding**'), 'reasoning flow must require an Understanding paragraph');
  assert(prompt.includes('**Plan**'), 'reasoning flow must require a Plan paragraph');
  assert(prompt.includes('**Result**'), 'reasoning flow must require a Result paragraph');
  assert(prompt.includes('**Next step**'), 'reasoning flow must require a Next step paragraph');
});

Deno.test('edit prompt is language- and length-agnostic', () => {
  const prompt = buildEditAssistantPrompt(baseOpts);
  assert(prompt.includes('any language'), 'prompt must accept any language');
  assert(prompt.includes('MEANING, never keywords') || prompt.includes('Interpret MEANING'), 'prompt must interpret meaning, not keywords');
  assert(!prompt.includes('English only'), 'prompt must not restrict language');
});

Deno.test('edit prompt requires honest out-of-scope explanations with a patch', () => {
  const prompt = buildEditAssistantPrompt(baseOpts);
  assert(prompt.includes('OUT-OF-SCOPE HONESTY'), 'prompt must carry the out-of-scope contract');
  assert(prompt.includes('exactly WHY it is outside'), 'explanation must name why');
  assert(prompt.includes('concrete patch'), 'explanation must name the unlocking patch');
  assert(prompt.includes('NO file changes for the unfulfillable part'), 'out-of-scope parts must not emit files');
});

Deno.test('general builder prompt carries the same conversational contract', () => {
  const prompt = buildGeneralBuilderPrompt({
    ...baseOpts,
    industryPageContext: '',
    imageContext: '',
  });
  assert(prompt.includes('AFFINITY'), 'general prompt must name Affinity');
  assert(prompt.includes('OUT-OF-SCOPE HONESTY'), 'general prompt must carry the out-of-scope contract');
});
