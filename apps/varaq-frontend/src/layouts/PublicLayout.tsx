import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { FloatingDock } from '../components/navigation/SiteHeader';
import { CollectionsProvider } from '../features/collections/CollectionsContext';
import { PersonaGate } from '@/auth/PersonaSetup';

export function PublicLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <PersonaGate>
      <CollectionsProvider>
        <div className="varaq-shell">
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
    </PersonaGate>
  );
}
