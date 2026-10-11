// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/ToggleButton.tsx
//
// Preact toggle button with aria-pressed semantics.
// ──────────────────────────────────────────────────────────────────────────────

import type { ComponentChildren } from 'preact';
import { resolveButtonContract, type BaseButtonProps } from './button-builder.js';

export interface ToggleButtonProps extends Omit<BaseButtonProps, 'href' | 'type'> {
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  children: ComponentChildren;
  leadingIcon?: ComponentChildren;
}

export function ToggleButton({
  pressed,
  onToggle,
  children,
  leadingIcon,
  variant = 'secondary',
  size = 'md',
  ...rest
}: ToggleButtonProps) {
  const contract = resolveButtonContract({
    ...rest,
    variant,
    size,
    type: 'button',
  });

  return (
    <button
      {...contract.attrs}
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
    >
      {leadingIcon && (
        <span class="btn__icon--leading" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      {children}
    </button>
  );
}

export default ToggleButton;
