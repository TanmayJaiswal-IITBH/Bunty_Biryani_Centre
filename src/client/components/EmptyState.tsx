import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon = 'info', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-ink">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="display text-lg">{title}</h2>
      {message && <p className="text-ink-muted">{message}</p>}
      {action}
    </div>
  );
}
