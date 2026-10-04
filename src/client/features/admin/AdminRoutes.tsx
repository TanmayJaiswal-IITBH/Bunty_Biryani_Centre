import { Route, Routes } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { copy } from '../../copy';
import { NotFound } from '../../NotFound';
import { LoginPage } from './auth/LoginPage';
import { RequireAdmin } from './auth/RequireAdmin';
import { AdminShell } from './layout/AdminShell';

/** Everything under /admin. Loaded with React.lazy, so the customer bundle never contains it. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminShell />}>
          <Route
            index
            element={
              <EmptyState
                title={copy.admin.tabs.today}
                message={copy.admin.todayPlaceholder}
                icon="clock"
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
