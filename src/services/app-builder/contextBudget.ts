/**
 * Priority-aware packing for Composer context. The request schema caps
 * runtimeContext, and tail-slicing silently cut design-source modules, form
 * placement rules and intent bindings. Blocks keep their order; whole
 * lowest-priority blocks leave first. Nothing is discarded: every block that
 * does not fit is returned as `overflow`, which callers carry in the (much
 * larger) page brief so the author still receives it.
 */

export const COMPOSER_CONTEXT_LIMIT = 12_000;
export const COMPOSER_PAGE_BRIEF_LIMIT = 52_000;

export interface ContextBlock {
  text: string;
  /** 1 = required for a correct page; larger numbers leave the runtime channel first. */
  priority: number;
  /** Line-oriented lists may lose trailing lines instead of the whole block. */
  trimmable?: boolean;
}

export interface PackedContext {
  text: string;
  /** Blocks (or trailing lines) moved out of `text`. */
  dropped: number;
  /** Everything that did not fit, in original order; never silently lost. */
  overflow: string;
}

export function packContextBlocks(blocks: readonly ContextBlock[], budget = COMPOSER_CONTEXT_LIMIT): PackedContext {
  const live = blocks
    .filter((block) => block.text.trim().length > 0)
    .map((block, order) => ({ ...block, order }));
  const moved: Array<{ text: string; order: number; part: number }> = [];
  const size = () => live.reduce((total, block, index) => total + block.text.length + (index ? 1 : 0), 0);
  let dropped = 0;
  while (size() > budget && live.length > 0) {
    const worst = Math.max(...live.map((block) => block.priority));
    // Lowest priority leaves first; among required blocks the trailing one
    // continues in overflow instead of being tail-cut mid-rule.
    let index = -1;
    for (let i = live.length - 1; i >= 0; i -= 1) if (live[i].priority === worst) { index = i; break; }
    const overflowSize = size() - budget;
    const block = live[index];
    if (worst > 1 && block.trimmable && block.text.length - overflowSize > 200) {
      const lines = block.text.split('\n');
      const tail: string[] = [];
      while (lines.length > 1 && lines.join('\n').length > block.text.length - overflowSize) tail.unshift(lines.pop()!);
      if (lines.length > 1) {
        moved.push({ text: tail.join('\n'), order: block.order, part: 1 });
        block.text = lines.join('\n');
        block.priority = 1;
        dropped += 1;
        continue;
      }
    }
    live.splice(index, 1);
    moved.push({ text: block.text, order: block.order, part: 0 });
    dropped += 1;
  }
  const overflow = moved
    .sort((a, b) => a.order - b.order || a.part - b.part)
    .map((entry) => entry.text)
    .join('\n');
  return { text: live.map((block) => block.text).join('\n'), dropped, overflow };
}
