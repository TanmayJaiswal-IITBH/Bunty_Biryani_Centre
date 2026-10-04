import type { ComponentProps } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-gold-soft active:bg-gold-soft',
  ghost: 'text-ink hover:bg-gold-soft active:bg-gold-soft',
  // For destructive confirmations only.
  danger: 'bg-danger text-on-brand hover:opacity-90 active:opacity-90',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Icon name="spinner" className="motion-safe:animate-spin" />}
      {children}
    </button>
  );
}
