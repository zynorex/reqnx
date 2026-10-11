// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/IconButton.tsx
//
// Preact component for square icon-only buttons with required accessible name.
// ──────────────────────────────────────────────────────────────────────────────

import type { ComponentChildren } from 'preact';
import { resolveButtonContract, type BaseButtonProps } from './button-builder.js';

export interface IconButtonProps extends Omit<BaseButtonProps, 'ariaLabel' | 'iconOnly'> {
  ariaLabel: string;
  children: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  tooltip?: string;
}

export function IconButton({
  ariaLabel,
  children,
  onClick,
  tooltip,
  size = 'md',
  ...rest
}: IconButtonProps) {
  const contract = resolveButtonContract({
    ...rest,
    size,
    iconOnly: true,
    ariaLabel,
    title: tooltip ?? ariaLabel,
  });

  const { isAnchor, attrs } = contract;

  const content = isAnchor ? (
    <a {...attrs} onClick={onClick as any}>
      {children}
    </a>
  ) : (
    <button {...attrs} onClick={onClick as any}>
      {children}
    </button>
  );

  if (tooltip) {
    return (
      <span class="btn-tooltip-wrapper">
        {content}
        <span class="btn-tooltip" role="tooltip" aria-hidden="true">
          {tooltip}
        </span>
      </span>
    );
  }

  return content;
}

export default IconButton;
