import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ErrorState } from '../../../components/ErrorState';
import { Skeleton } from '../../../components/Skeleton';
import { copy } from '../../../copy';
import { setUnauthorizedHandler } from '../../../lib/api';
import { useAdminSession, useClearSwrCache } from './useAdminSession';

function FullScreenSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-120 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label={copy.common.loading}
    >
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Guards every /admin page except login. This is UX only: the real protection is requireAdmin
 * on the server (Batch 1 §9.1).
 */
export function RequireAdmin() {
  const { data, error, isLoading, mutate } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const clearCache = useClearSwrCache();

  const goToLogin = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    void navigate(`/admin/login?next=${next}`, { replace: true });
  };

  // Any later admin request that comes back 401 (session expired mid-use) lands here too.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearCache();
      goToLogin();
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const unauthenticated = error?.status === 401;
  useEffect(() => {
    if (unauthenticated) goToLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unauthenticated]);

  if (isLoading || unauthenticated) return <FullScreenSkeleton />;
  if (error || !data) {
    return (
      <ErrorState
        title={copy.admin.sessionLoadError}
        message={copy.common.networkError}
        onRetry={() => void mutate()}
      />
    );
  }
  return <Outlet />;
}
