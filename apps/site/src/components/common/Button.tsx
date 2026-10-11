// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/Button.tsx
//
// Preact component for Button primitive.
// ──────────────────────────────────────────────────────────────────────────────

import type { ComponentChildren } from 'preact';
import { resolveButtonContract, type BaseButtonProps } from './button-builder.js';

export interface ButtonProps extends BaseButtonProps {
  children?: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  leadingIcon?: ComponentChildren;
  trailingIcon?: ComponentChildren;
  kbd?: string;
}

export function Button({
  children,
  onClick,
  leadingIcon,
  trailingIcon,
  kbd,
  loading,
  ...rest
}: ButtonProps) {
  const contract = resolveButtonContract({ ...rest, loading });
  const { isAnchor, isExternal, attrs } = contract;

  if (isAnchor) {
    return (
      <a {...attrs} onClick={onClick as any}>
        {loading && <span class="btn__spinner" aria-hidden="true" />}
        {!loading && leadingIcon && (
          <span class="btn__icon--leading" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        {children}
        {kbd && <kbd class="btn__kbd">{kbd}</kbd>}
        {trailingIcon && (
          <span class="btn__icon--trailing" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
        {isExternal && (
          <>
            <span class="btn__icon--trailing" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
            <span class="rx-sr-only">(opens in a new tab)</span>
          </>
        )}
      </a>
    );
  }

  return (
    <button {...attrs} onClick={onClick as any}>
      {loading && <span class="btn__spinner" aria-hidden="true" />}
      {!loading && leadingIcon && (
        <span class="btn__icon--leading" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      {children}
      {kbd && <kbd class="btn__kbd">{kbd}</kbd>}
      {trailingIcon && (
        <span class="btn__icon--trailing" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}

export default Button;
