import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';

import { WritingCard } from '@/components/literary/WritingCard';
import { postItTone } from './postItTones';
import type { Writing } from './writings';

function FlutteringNote({ children, index }: { children: ReactNode; index: number }) {
  const noteRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const direction = index % 2 === 0 ? 1 : -1;
  const { scrollYProgress } = useScroll({
    target: noteRef,
    offset: ['start end', 'end start'],
  });
  const flutterProgress = useSpring(scrollYProgress, {
    stiffness: 105,
    damping: 24,
    mass: 0.35,
  });
  const rotateX = useTransform(flutterProgress, [0, 0.28, 0.54, 0.8, 1], [0, -4, 2.2, -2.6, 0]);
  const rotateZ = useTransform(
    flutterProgress,
    [0, 0.28, 0.54, 0.8, 1],
    [0, 0.8 * direction, -0.55 * direction, 0.35 * direction, 0],
  );
  const y = useTransform(flutterProgress, [0, 0.28, 0.54, 0.8, 1], [0, 5, -2, 3, 0]);

  return (
    <div className="commons-note" ref={noteRef}>
      <motion.div
        className="commons-note-flutter"
        style={reduceMotion ? undefined : { rotateX, rotateZ, y }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function FeedGrid({
  writings,
  onRead,
  loading = false,
  ariaLabel = 'Recent writing',
  hrefForWriting = (writing) => `/piece/${encodeURIComponent(writing.id)}`,
}: {
  writings: Writing[];
  onRead: (writing: Writing) => void;
  loading?: boolean;
  ariaLabel?: string;
  hrefForWriting?: (writing: Writing) => string;
}) {
  return (
    <section aria-label={ariaLabel} className="saved-writing-grid commons-wall" aria-busy={loading}>
      {writings.map((writing, index) => (
        <FlutteringNote index={index} key={writing.id}>
          <WritingCard
            writing={{ ...writing, tone: postItTone(index) }}
            onRead={onRead}
            pieceHref={hrefForWriting(writing)}
          />
        </FlutteringNote>
      ))}
    </section>
  );
}
