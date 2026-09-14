import { motion } from "framer-motion";
import { ReactNode } from "react";
import { DURATION, EASE_OUT } from "../../lib/motion";

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: DURATION.exit, ease: EASE_OUT } }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
