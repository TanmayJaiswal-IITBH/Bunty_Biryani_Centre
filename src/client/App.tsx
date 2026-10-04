import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { EmptyState } from './components/EmptyState';
import { Skeleton } from './components/Skeleton';
import { copy } from './copy';
import { NotFound } from './NotFound';

// The admin app is its own chunk: customers never download it.
const AdminRoutes = lazy(() => import('./features/admin/AdminRoutes'));

function CustomerPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-120 px-4 py-4">{children}</main>
    </>
  );
}

function AdminFallback() {
  return (
    <div className="mx-auto flex max-w-120 flex-col gap-4 p-4" aria-busy="true">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <CustomerPage>
            {/* Batch 3 replaces this placeholder with the menu. */}
            <EmptyState
              title={copy.customer.homeTitle}
              message={copy.customer.homeComingSoon}
              icon="clock"
            />
          </CustomerPage>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<AdminFallback />}>
            <AdminRoutes />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <CustomerPage>
            <NotFound />
          </CustomerPage>
        }
      />
    </Routes>
  );
}
