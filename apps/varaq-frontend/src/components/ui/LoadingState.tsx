import { Feather } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type LoadingStateProps = {
  label: string;
  detail?: string;
  variant?: 'page' | 'section' | 'compact';
  className?: string;
};

const slips = [-1, 0, 1] as const;

export function LoadingState({ label, detail, variant = 'section', className }: LoadingStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('varaq-loader', `varaq-loader--${variant}`, className)}
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="varaq-loader-mark" aria-hidden="true">
        {slips.map((position) => (
          <motion.span
            className="varaq-loader-slip"
            key={position}
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [0, position === 0 ? -7 : -4, 0],
                    rotate: [position * 7, position * 4, position * 7],
                    opacity: [0.55, 1, 0.55],
                  }
            }
            transition={{
              duration: 1.7,
              delay: (position + 1) * 0.16,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
        ))}
        <motion.span
          className="varaq-loader-feather"
          animate={
            reduceMotion ? undefined : { x: [-2, 3, -2], y: [1, -2, 1], rotate: [-8, 5, -8] }
          }
          transition={{ duration: 2.1, ease: 'easeInOut', repeat: Infinity }}
        >
          <Feather />
        </motion.span>
      </span>
      <span className="varaq-loader-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </motion.div>
  );
}

export function LoadingLabel({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className="varaq-loading-label">
      <span>{children}</span>
      <span className="varaq-loading-dots" aria-hidden="true">
        {slips.map((position) => (
          <motion.span
            key={position}
            animate={reduceMotion ? undefined : { y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
            transition={{
              duration: 0.9,
              delay: (position + 1) * 0.12,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
        ))}
      </span>
    </span>
  );
}
