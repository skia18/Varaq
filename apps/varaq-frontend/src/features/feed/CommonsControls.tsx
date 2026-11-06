import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';

import { TrailPathIcon } from '@/components/icons/TrailPathIcon';
import { feedCategories, type FeedCategoryId } from './categories';

const controlSpring = { type: 'spring', stiffness: 210, damping: 28, mass: 0.9 } as const;
const unfoldTransition = { duration: 0.52, ease: [0.22, 1, 0.36, 1] } as const;
const labelTransition = { duration: 0.38, ease: [0.22, 1, 0.36, 1] } as const;
const hoverIntentDelay = 160;

export function CommonsControls({
  selectedCategory,
  filtersOpen,
  trailsActive,
  onCategoryChange,
  onFiltersOpenChange,
  onTrailsActiveChange,
}: {
  selectedCategory: FeedCategoryId;
  filtersOpen: boolean;
  trailsActive: boolean;
  onCategoryChange: (category: FeedCategoryId) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onTrailsActiveChange: (active: boolean) => void;
}) {
  const [revealedCategory, setRevealedCategory] = useState<FeedCategoryId | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const [mobileFilters, setMobileFilters] = useState(false);
  const layoutTransition = reduceMotion ? { duration: 0 } : controlSpring;

  function clearHoverTimer() {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  function revealCategoryAfterDelay(category: FeedCategoryId) {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      setRevealedCategory(category);
      hoverTimer.current = null;
    }, hoverIntentDelay);
  }

  function hideRevealedCategory() {
    clearHoverTimer();
    setRevealedCategory(null);
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 680px)');
    const update = () => setMobileFilters(query.matches);
    update();
    query.addEventListener('change', update);
    return () => {
      clearHoverTimer();
      query.removeEventListener('change', update);
    };
  }, []);

  function toggleFilters() {
    const nextOpen = !filtersOpen;
    if (!nextOpen) hideRevealedCategory();
    if (nextOpen && trailsActive) onTrailsActiveChange(false);
    onFiltersOpenChange(nextOpen);
  }

  function toggleTrails() {
    const nextActive = !trailsActive;
    if (nextActive) onFiltersOpenChange(false);
    onTrailsActiveChange(nextActive);
  }

  return (
    <LayoutGroup id="commons-controls">
      <div className="commons-controls" aria-label="Browse the commons">
        <motion.div className={`filter-control${mobileFilters ? ' is-mobile' : ''}`}>
          <motion.button
            layout="position"
            type="button"
            className={`browse-mode-button${filtersOpen ? ' is-active' : ''}`}
            aria-expanded={filtersOpen}
            aria-controls="commons-category-filters"
            onClick={toggleFilters}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={layoutTransition}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>Filters</span>
          </motion.button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                id="commons-category-filters"
                className="category-filter-list"
                aria-label="Filter pages by category"
                initial={
                  reduceMotion
                    ? false
                    : mobileFilters
                      ? { height: 0, y: -8, opacity: 0 }
                      : { width: 0, opacity: 0 }
                }
                animate={
                  mobileFilters
                    ? { height: 'auto', y: 0, opacity: 1 }
                    : { width: 'auto', opacity: 1 }
                }
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : mobileFilters
                      ? { height: 0, y: -8, opacity: 0 }
                      : { width: 0, opacity: 0 }
                }
                transition={reduceMotion ? { duration: 0 } : unfoldTransition}
              >
                {feedCategories.map(({ id, label, icon: Icon }, index) => {
                  const selected = selectedCategory === id;
                  const revealLabel = mobileFilters || selected || revealedCategory === id;
                  return (
                    <motion.button
                      layout="position"
                      type="button"
                      key={id}
                      className={`category-filter${selected ? ' is-selected' : ''}`}
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      onClick={() => onCategoryChange(id)}
                      onMouseEnter={() => revealCategoryAfterDelay(id)}
                      onMouseLeave={hideRevealedCategory}
                      onFocus={() => setRevealedCategory(id)}
                      onBlur={hideRevealedCategory}
                      initial={mobileFilters && !reduceMotion ? { y: -6, opacity: 0 } : false}
                      animate={{ y: 0, opacity: 1 }}
                      exit={mobileFilters && !reduceMotion ? { y: -4, opacity: 0 } : undefined}
                      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                      transition={
                        mobileFilters && !reduceMotion
                          ? { ...unfoldTransition, delay: index * 0.035 }
                          : layoutTransition
                      }
                    >
                      <Icon aria-hidden="true" />
                      <AnimatePresence initial={false}>
                        {revealLabel && (
                          <motion.span
                            key="label"
                            initial={reduceMotion ? false : { width: 0, opacity: 0, marginLeft: 0 }}
                            animate={{ width: 'auto', opacity: 1, marginLeft: 7 }}
                            exit={
                              reduceMotion
                                ? { opacity: 0 }
                                : { width: 0, opacity: 0, marginLeft: 0 }
                            }
                            transition={reduceMotion ? { duration: 0 } : labelTransition}
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.button
          layout="position"
          type="button"
          className={`browse-mode-button trails-mode-button${trailsActive ? ' is-active' : ''}`}
          aria-pressed={trailsActive}
          onClick={toggleTrails}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={layoutTransition}
        >
          <TrailPathIcon aria-hidden="true" />
          <span>Trails</span>
          {trailsActive && (
            <motion.span
              className="trails-active-dot"
              layoutId="trails-active-dot"
              aria-hidden="true"
              transition={layoutTransition}
            />
          )}
        </motion.button>
      </div>
    </LayoutGroup>
  );
}
