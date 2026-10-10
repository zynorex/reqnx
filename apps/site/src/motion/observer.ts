// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/motion/observer.ts
//
// Single shared IntersectionObserver for element reveals and visibility-driven pausing.
// Avoids spawning multiple observers across separate components.
// ──────────────────────────────────────────────────────────────────────────────

type VisibilityCallback = (entry: IntersectionObserverEntry) => void;

interface ObserveOptions {
  /** If true, fires once when entering view and then unobserves. Default true. */
  once?: boolean;
  /** Callback fired whenever element enters or leaves view. */
  onChange?: (isIntersecting: boolean, entry: IntersectionObserverEntry) => void;
}

const callbacks = new Map<Element, { options: ObserveOptions; callback?: VisibilityCallback }>();

let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return null;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const config = callbacks.get(entry.target);
          if (!config) continue;

          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            if (config.callback) {
              config.callback(entry);
            }
            if (config.options.onChange) {
              config.options.onChange(true, entry);
            }
            if (config.options.once !== false) {
              sharedObserver?.unobserve(entry.target);
              callbacks.delete(entry.target);
            }
          } else {
            if (config.options.onChange) {
              config.options.onChange(false, entry);
            }
          }
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -8% 0px', // Trigger slightly before full bottom
        threshold: [0, 0.1, 0.5],
      },
    );

    window.addEventListener('pagehide', () => {
      sharedObserver?.disconnect();
      sharedObserver = null;
      callbacks.clear();
    });
  }

  return sharedObserver;
}

/**
 * Register an element for viewport reveal or continuous visibility tracking.
 */
export function observeElement(
  element: Element,
  callbackOrOptions?: VisibilityCallback | ObserveOptions,
): () => void {
  const observer = getObserver();
  if (!observer) {
    // If IntersectionObserver is not supported, mark visible immediately
    element.classList.add('is-visible');
    return () => {};
  }

  let options: ObserveOptions = { once: true };
  let callback: VisibilityCallback | undefined;

  if (typeof callbackOrOptions === 'function') {
    callback = callbackOrOptions;
  } else if (callbackOrOptions) {
    options = { ...options, ...callbackOrOptions };
  }

  callbacks.set(element, { options, callback });
  observer.observe(element);

  return () => {
    observer.unobserve(element);
    callbacks.delete(element);
  };
}
