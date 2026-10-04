import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

interface CustomerPageProps {
  subline?: string;
  /** Leave room under the content for the sticky cart bar. */
  reserveCartBar?: boolean;
  children: ReactNode;
}

/** Header + centred single-column main area shared by every customer page. */
export function CustomerPage({ subline, reserveCartBar = false, children }: CustomerPageProps) {
  return (
    <>
      <AppHeader subline={subline} />
      <main
        className={[
          'mx-auto max-w-120 px-4 pt-4',
          reserveCartBar ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'pb-4',
        ].join(' ')}
      >
        {children}
      </main>
    </>
  );
}
