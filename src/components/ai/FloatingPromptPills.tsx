import { motion, useReducedMotion } from "framer-motion";
import type { QuickAction } from "./AIAssistantCore";

interface FloatingPromptPillsProps {
  actions: QuickAction[];
  onSelect: (action: QuickAction) => void;
}

/**
 * Affinity starting prompts that rise into the chat space and keep drifting
 * gently upward. Motion is decorative only: every pill is a real button and
 * stays still for visitors who prefer reduced motion.
 */
export function FloatingPromptPills({ actions, onSelect }: FloatingPromptPillsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="py-2" aria-label="Starting ideas" role="group">
      <p className="mb-3 text-center text-sm text-cyan-100/70">
        Tell Affinity what you have in mind, or start from an idea.
      </p>
      <ul className="mx-auto flex max-w-2xl flex-wrap justify-center gap-1.5 sm:gap-2">
        {actions.map((action, index) => (
          <motion.li
            key={action.id}
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index, duration: 0.5, ease: "easeOut" }}
          >
            <motion.button
              type="button"
              onClick={() => onSelect(action)}
              title={action.prompt}
              animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
              transition={reduceMotion ? undefined : {
                duration: 3.2 + (index % 4) * 0.6,
                delay: 0.6 + (index % 5) * 0.35,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              whileHover={reduceMotion ? undefined : { y: -7 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-white/5 px-3 text-xs text-white/75 shadow-[0_6px_18px_rgba(8,145,178,0.18)] transition-colors hover:border-cyan-300/60 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              {action.icon}
              {action.label}
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
