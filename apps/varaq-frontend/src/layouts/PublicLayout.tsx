import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { FloatingDock } from '../components/navigation/SiteHeader';
import { CollectionsProvider } from '../features/collections/CollectionsContext';

function LiteraryMargins() {
  return (
    <div className="literary-margins" aria-hidden="true">
      <aside className="literary-margin literary-margin--left">
        <span className="margin-art margin-art--orbit" />
        <p>
          Leave a piece
          <br />
          of yourself
          <br />
          behind.
        </p>
        <svg className="margin-mehendi" viewBox="0 0 120 150" aria-hidden="true">
          <path d="M60 145c-3-29 4-50 22-67 14-13 18-28 13-45" />
          <path d="M60 116c-14-3-24-13-29-28 16-1 27 8 31 23" />
          <path d="M72 91c-1-16 7-29 22-36 4 15-2 28-18 38" />
          <path d="M49 129c-13-1-23-8-29-20 13-3 24 3 31 16" />
          <circle cx="96" cy="27" r="10" />
          <circle cx="96" cy="27" r="3" />
          <path d="M96 17c-9-14-20-8-15 3-14-5-19 8-6 13-11 8-2 19 9 11 1 14 15 14 18 1 10 8 20-3 10-12 13-9 8-22-5-21 5-11-6-20-16-13Z" />
          <path d="M57 66c-12-15-28-10-29 5-1 13 12 23 28 18-12-3-18-14-13-22 4-7 11-8 14-1Z" />
          <path d="M35 48c7-9 16-12 27-9M30 40c8-7 17-9 27-5" />
          <circle cx="25" cy="36" r="3" />
          <circle cx="17" cy="29" r="2" />
        </svg>
        <span className="margin-signature">— varaq</span>
      </aside>
      <aside className="literary-margin literary-margin--right">
        <span className="margin-art margin-art--stem" />
        <p>
          Somewhere,
          <br />
          someone may find
          <br />
          the words they needed.
        </p>
        <span className="margin-flourish">ورق</span>
      </aside>
    </div>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <CollectionsProvider>
      <div className={`varaq-shell${location.pathname === '/' ? ' is-commons-route' : ''}`}>
        <LiteraryMargins />
        <FloatingDock />
        <main className="main-shell">
          <div className="route-transition-stack">
            <AnimatePresence initial={false}>
              <motion.div
                className="route-transition"
                key={location.pathname}
                initial={reduceMotion ? false : { opacity: 0.08, filter: 'blur(5px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={
                  reduceMotion
                    ? { opacity: 1, filter: 'blur(0px)' }
                    : { opacity: 0, filter: 'blur(3px)' }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </CollectionsProvider>
  );
}
