import type { ComponentProps, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: 'bg-info-soft text-info border-info/30', icon: 'info' },
  warning: { box: 'bg-warning-soft text-warning border-warning/30', icon: 'alert' },
  // Errors never use the brand red: danger colour + icon + soft background.
  danger: { box: 'bg-danger-soft text-danger border-danger/30', icon: 'alert' },
  success: { box: 'bg-success-soft text-success border-success/30', icon: 'check' },
};

interface BannerProps extends Omit<ComponentProps<'div'>, 'role'> {
  tone: Tone;
  /** Defaults to `alert` for danger and `status` otherwise. */
  role?: 'status' | 'alert';
  children: ReactNode;
  /** Optional action, e.g. a retry button. */
  action?: ReactNode;
}

export function Banner({ tone, role, children, action, className = '', ...rest }: BannerProps) {
  const { box, icon } = TONES[tone];
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      // Focusable by script so a screen reader (and keyboard user) lands on a new error.
      tabIndex={-1}
      className={`flex items-start gap-3 rounded-control border p-3 text-sm font-medium ${box} ${className}`}
      {...rest}
    >
      <Icon name={icon} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
