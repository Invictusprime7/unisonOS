/**
 * Priority-aware packing for Composer context. The request schema caps
 * runtimeContext, and tail-slicing silently cut design-source modules, form
 * placement rules and intent bindings. Blocks keep their order; whole
 * lowest-priority blocks are dropped first, never the design vocabulary.
 */

export const COMPOSER_CONTEXT_LIMIT = 12_000;

export interface ContextBlock {
  text: string;
  /** 1 = required for a correct page; larger numbers are dropped first. */
  priority: number;
}

export interface PackedContext {
  text: string;
  dropped: number;
}

export function packContextBlocks(blocks: readonly ContextBlock[], budget = COMPOSER_CONTEXT_LIMIT): PackedContext {
  const live = blocks.filter((block) => block.text.trim().length > 0).map((block) => ({ ...block }));
  const size = () => live.reduce((total, block, index) => total + block.text.length + (index ? 1 : 0), 0);
  let dropped = 0;
  while (size() > budget && live.length > 1) {
    const worst = Math.max(...live.map((block) => block.priority));
    if (worst <= 1) break;
    // Drop the last block of the lowest priority so earlier context survives.
    let index = -1;
    for (let i = live.length - 1; i >= 0; i -= 1) if (live[i].priority === worst) { index = i; break; }
    live.splice(index, 1);
    dropped += 1;
  }
  const text = live.map((block) => block.text).join('\n');
  // Required blocks alone exceeding the budget is a contract defect; trim the tail as a last resort.
  return { text: text.length > budget ? text.slice(0, budget) : text, dropped };
}
