# REQNX Button System Documentation

The REQNX Button System is the single, unified control system applied across the entire site (Landing page, 404, Playground, Console, and Starlight Documentation).

It provides accessible, high-performance button and control primitives with zero third-party UI dependencies, adhering to strict WCAG 2.2 AA accessibility, contrast, and semantic standards.

---

## 1. Design Tokens & Geometry

All button styling is driven by custom properties declared in `apps/site/src/styles/global.css` under `@layer tokens`:

| Token | Dark Theme | Light Theme | Description |
| :--- | :--- | :--- | :--- |
| `--rx-btn-radius` | `6px` (`--rx-radius-sm`) | `6px` | Uniform corner radius across all buttons |
| `--rx-btn-gap` | `8px` | `8px` | Gap between icon slots and text labels |
| `--rx-btn-primary-bg` | `#4f46e5` (`--rx-accent-indigo`) | `#4338ca` | Primary brand background fill |
| `--rx-btn-primary-text`| `#ffffff` | `#ffffff` | Primary text color (6.29:1+ contrast) |
| `--rx-btn-primary-highlight` | `inset 0 1px 0 rgba(255,255,255,0.22)` | `inset 0 1px 0 rgba(255,255,255,0.22)` | Option A subtle top edge highlight |
| `--rx-btn-secondary-bg`| `#161923` (`--rx-surface-2`) | `#ffffff` | Secondary control surface fill |
| `--rx-btn-secondary-border`| `rgba(255,255,255,0.08)` | `rgba(15,23,42,0.08)` | Secondary subtle border |
| `--rx-btn-focus-ring` | `2px solid #4f46e5` | `2px solid #4338ca` | High-contrast outline focus indicator |
| `--rx-btn-focus-offset`| `2px` | `2px` | Focus outline offset |

### Size Geometries

| Size | Minimum Height | Horizontal Padding | Font Size | Icon Size | Typical Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sm` | **32px** | `12px` (`0.75rem`) | `13px` (`0.8125rem`) | `16px` | Header actions, table toolbars, console triggers |
| `md` | **40px** | `16px` (`1rem`) | `14px` (`0.875rem`) | `18px` | Default controls, playground buttons, form actions |
| `lg` | **48px** | `20px` (`1.25rem`) | `16px` (`1rem`) | `20px` | Hero CTAs, final call-to-action bands |

### Shape Modifiers

| Shape | Attribute | Radius | Description & Usage |
| :--- | :--- | :--- | :--- |
| `default` | *none* | `var(--rx-btn-radius)` (`6px`) | Standard rectangular rounded geometry used across docs, playground, and forms. |
| `pill` | `data-shape="pill"` | `var(--rx-radius-pill)` (`9999px`) | Flagship full-pill curvature used on the Landing v3 for primary CTAs, chips, and tabs. |

### Coarse Touch Target Guarantee

On mobile and touch devices (`@media (pointer: coarse)`), buttons ensure a minimum interactive target of $\ge 44 \times 44\text{ px}$ via an expanded pseudo-element:
```css
@media (pointer: coarse) {
  .btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
    width: 100%;
    height: 100%;
  }
}
```

---

## 2. Semantic Rules & HTML Contracts

1. **Links Navigate (`<a>`)**:
   - Supplying an `href` prop automatically renders an `<a>` element.
   - External links (`https://...` outside the site origin) automatically append `target="_blank"`, `rel="noopener noreferrer"`, an external link icon, and an accessible screen-reader warning: `<span class="rx-sr-only">(opens in a new tab)</span>`.
   - Never use `role="button"` on anchors. Never use `href="#"` or `javascript:void(0)`.

2. **Buttons Act (`<button type="button">`)**:
   - Actions without navigation render a `<button type="button">` (preventing accidental form submission).
   - Icon-only buttons strictly require an accessible label via `ariaLabel` (enforced at build time via TypeScript and runtime linter).

3. **Disability States**:
   - Native buttons use the `disabled` attribute (`<button disabled>`).
   - Anchor links cannot be disabled natively; they receive `aria-disabled="true"`, omit the `href` attribute, and set `tabindex="-1"`.

---

## 3. Component Primitives

The system provides identical contracts across Astro and Preact:

### Astro Primitives (`apps/site/src/components/common/`)
- `Button.astro`: Core polymorphic button and link primitive.
- `IconButton.astro`: Square icon button with mandatory accessible name.
- `ButtonGroup.astro`: Container supporting spaced (`gap: 8px`) or attached segmented layouts.
- `SegmentedControl.astro`: Accessible single-select group with keyboard navigation.
- `Tooltip.astro`: Micro-tooltip adhering to WCAG 1.4.13 (dismissible via Escape, hoverable).

### Preact Primitives (`apps/site/src/components/common/`)
- `Button.tsx`: Interactive Preact button primitive.
- `IconButton.tsx`: Interactive Preact icon-only button.
- `ToggleButton.tsx`: Two-state toggle button with `aria-pressed`.
- `SegmentedControl.tsx`: Interactive segmented control.
- `CopyButton.tsx`: Accessible copy-to-clipboard button with visual checkmark transition and live announcement.

---

## 4. Verification & Audit Scripts

The button system is guarded by automated scripts in `apps/site/scripts/`:

```bash
# 1. Lint CSS, source code, and button label conventions
pnpm --filter @reqnx/site run lint:buttons

# 2. Audit compiled HTML output for semantic tag correctness
pnpm --filter @reqnx/site run audit:buttons

# 3. Verify min-height and 44x44px touch targets in headless browser
pnpm --filter @reqnx/site run buttons:targets

# 4. Verify WCAG AA 4.5:1 contrast ratios across dark and light palettes
pnpm --filter @reqnx/site run buttons:contrast

# 5. Run full Axe Core automated accessibility audit
pnpm --filter @reqnx/site run buttons:a11y

# 6. Capture visual contact sheet screenshots
pnpm --filter @reqnx/site run buttons:shots
```
