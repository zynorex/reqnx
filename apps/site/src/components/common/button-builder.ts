// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/button-builder.ts
//
// Typed class builder, external URL detector, and prop validator
// for the REQNX Unified Button System.
// ──────────────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'link'
  | 'on-accent-primary'
  | 'on-accent-secondary';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  ariaDisabled?: boolean;
  ariaDescribedBy?: string;
  loading?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
  title?: string;
}

export interface ResolvedButtonContract {
  isAnchor: boolean;
  isExternal: boolean;
  tag: 'a' | 'button';
  attrs: {
    class: string;
    'data-variant': ButtonVariant;
    'data-size': ButtonSize;
    'data-loading'?: 'true';
    'data-block'?: 'true';
    'data-icon-only'?: 'true';
    href?: string;
    target?: string;
    rel?: string;
    download?: string | boolean;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    'aria-disabled'?: 'true';
    'aria-describedby'?: string;
    'aria-busy'?: 'true';
    'aria-label'?: string;
    title?: string;
    id?: string;
  };
}

/**
 * Checks whether an href points to an external destination.
 */
export function isExternalUrl(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return false;
  }
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  try {
    const url = new URL(href, 'https://reqnx.dev');
    return url.origin !== 'https://reqnx.dev';
  } catch {
    return false;
  }
}

/**
 * Validates props and resolves semantic HTML attributes for Button and IconButton.
 */
export function resolveButtonContract(props: BaseButtonProps): ResolvedButtonContract {
  const {
    variant = 'secondary',
    size = 'md',
    href,
    target: explicitTarget,
    rel: explicitRel,
    download,
    type = 'button',
    disabled,
    ariaDisabled: explicitAriaDisabled,
    ariaDescribedBy,
    loading,
    block,
    iconOnly,
    ariaLabel,
    className,
    id,
    title,
  } = props;

  // Enforce accessible name for icon-only buttons
  if (iconOnly && !ariaLabel) {
    throw new Error('Icon-only buttons require an accessible name via ariaLabel');
  }

  const isAnchor = Boolean(href);
  const isExternal = isAnchor && isExternalUrl(href!);

  // Policy: Anchors with disabled become aria-disabled so keyboard users still discover them
  const effectiveAriaDisabled =
    explicitAriaDisabled || (isAnchor && disabled) || undefined;
  const effectiveDisabled = !isAnchor && disabled ? true : undefined;

  const resolvedTarget = isAnchor
    ? explicitTarget ?? (isExternal ? '_blank' : undefined)
    : undefined;

  const resolvedRel = isAnchor
    ? explicitRel ?? (isExternal ? 'noopener noreferrer' : undefined)
    : undefined;

  const classNames = ['btn', className].filter(Boolean).join(' ');

  const attrs: ResolvedButtonContract['attrs'] = {
    class: classNames,
    'data-variant': variant,
    'data-size': size,
  };

  if (loading) {
    attrs['data-loading'] = 'true';
    attrs['aria-busy'] = 'true';
  }

  if (block) {
    attrs['data-block'] = 'true';
  }

  if (iconOnly) {
    attrs['data-icon-only'] = 'true';
  }

  if (ariaLabel) {
    attrs['aria-label'] = ariaLabel;
  }

  if (title) {
    attrs.title = title;
  }

  if (id) {
    attrs.id = id;
  }

  if (ariaDescribedBy) {
    attrs['aria-describedby'] = ariaDescribedBy;
  }

  if (effectiveAriaDisabled) {
    attrs['aria-disabled'] = 'true';
  }

  if (isAnchor) {
    attrs.href = effectiveAriaDisabled ? undefined : href;
    if (resolvedTarget) attrs.target = resolvedTarget;
    if (resolvedRel) attrs.rel = resolvedRel;
    if (download !== undefined) attrs.download = download;
  } else {
    attrs.type = type;
    if (effectiveDisabled) attrs.disabled = true;
  }

  return {
    isAnchor,
    isExternal,
    tag: isAnchor ? 'a' : 'button',
    attrs,
  };
}
