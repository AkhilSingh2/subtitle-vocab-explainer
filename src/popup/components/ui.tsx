import type { ReactNode } from 'react';
import { levelBadge } from '../../shared/tokens';
import type { Cefr } from '../../shared/types';

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent dark:focus-visible:outline-accent';

export function Switch(props: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}): ReactNode {
  const { checked, onChange, label } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 flex-none rounded-full transition-colors ${focusRing} ${
        checked ? 'bg-light-accent dark:bg-accent' : 'bg-light-border dark:bg-white/20'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  label: string;
}): ReactNode {
  const { value, options, onChange, label } = props;
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-light-border p-0.5 dark:bg-white/10">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${focusRing} ${
            option === value
              ? 'bg-white text-light-text shadow dark:bg-dark-bg dark:text-dark-text'
              : 'text-light-secondary dark:text-dark-secondary'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function LevelBadge(props: { level: Cefr; estimated?: boolean }): ReactNode {
  const colors = levelBadge[props.level];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: colors.bg, color: colors.text }}
    >
      {props.estimated ? `est. ${props.level}` : props.level}
    </span>
  );
}

export function Row(props: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="text-sm text-light-secondary dark:text-dark-secondary">{props.label}</span>
      <div className="flex items-center">{props.children}</div>
    </div>
  );
}

export const buttonClass = `rounded-lg border border-light-border px-3 py-1.5 text-sm font-semibold hover:border-light-accent dark:border-white/15 dark:hover:border-accent disabled:opacity-50 ${focusRing}`;
