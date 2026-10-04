import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import logo96 from '../../../assets/logo-96.webp';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { copy } from '../../../copy';
import { api } from '../../../lib/api';
import { useClearSwrCache } from '../auth/useAdminSession';

const TABS = ['today', 'stock', 'menu', 'settings'] as const;

/** Top bar, page area and bottom tabs. Batch 6 turns the disabled tabs into real screens. */
export function AdminShell() {
  const navigate = useNavigate();
  const clearCache = useClearSwrCache();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      await api<void>('/api/admin/logout', { method: 'POST' });
      await clearCache();
      void navigate('/admin/login', { replace: true });
    } catch {
      setError(copy.common.networkError);
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-120 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-sun px-4 py-2">
        <img src={logo96} width={40} height={40} alt="" className="size-10 rounded-control" />
        <span className="display flex-1 text-lg">{copy.admin.shellTitle}</span>
        <Button variant="ghost" onClick={() => void logout()} loading={loggingOut}>
          {loggingOut ? copy.admin.loggingOut : copy.admin.logout}
        </Button>
      </header>

      <main className="flex-1 px-4 pb-20 pt-4">
        {error && (
          <Banner tone="danger" className="mb-4">
            {error}
          </Banner>
        )}
        <Outlet />
      </main>

      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-120 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-bar"
      >
        <ul className="grid h-14 grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab} className="flex">
              <button
                type="button"
                disabled
                className="flex-1 text-sm font-semibold text-ink-muted disabled:opacity-60"
              >
                {copy.admin.tabs[tab]}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
