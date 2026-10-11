// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/components/common/SegmentedControl.tsx
//
// Preact SegmentedControl with native radio inputs, arrow-key navigation,
// and accessible radiogroup semantics.
// ──────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'preact/hooks';

export interface SegmentedOption {
  value: string;
  label: string;
  title?: string;
}

export interface SegmentedControlProps {
  name: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  id?: string;
}

export function SegmentedControl({
  name,
  options,
  value,
  onChange,
  ariaLabel,
  id,
}: SegmentedControlProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent, currentIndex: number) => {
      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % options.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      }

      if (nextIndex !== currentIndex) {
        const nextVal = options[nextIndex].value;
        onChange(nextVal);
        const nextInput = document.getElementById(`${name}-${nextVal}`) as HTMLInputElement | null;
        nextInput?.focus();
      }
    },
    [name, options, onChange],
  );

  return (
    <div class="segmented-control" role="radiogroup" aria-label={ariaLabel} id={id}>
      {options.map((opt, idx) => {
        const inputId = `${name}-${opt.value}`;
        const isChecked = opt.value === value;
        return (
          <span key={opt.value} style={{ display: 'contents' }}>
            <input
              type="radio"
              id={inputId}
              name={name}
              value={opt.value}
              checked={isChecked}
              class="segmented-control__input"
              onChange={() => onChange(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            />
            <label
              for={inputId}
              class="segmented-control__label"
              title={opt.title ?? opt.label}
            >
              {opt.label}
            </label>
          </span>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
