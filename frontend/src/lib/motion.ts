import type { Variants } from "framer-motion";

/**
 * Shared motion tokens. Every animated surface in AcadIQ pulls its easing and
 * duration from here so the whole product moves with one rhythm, and exits stay
 * shorter than entrances (~65%) to keep the UI feeling responsive.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

export const DURATION = {
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  exit: 0.18,
} as const;

/** Section / card entrance. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Parent for lists and grids — children reveal in a 60ms wave. */
export const stagger = (each = 0.06, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: each, delayChildren: delay } },
});

/** Standard scroll-reveal props: fires once, slightly before the section lands. */
export const inView = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-80px" },
} as const;

/** Press feedback for cards and tiles that act as buttons. */
export const pressable = {
  whileHover: { y: -3 },
  whileTap: { scale: 0.985 },
  transition: { duration: DURATION.fast, ease: EASE_OUT },
} as const;
