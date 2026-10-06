import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes } from 'react-router';
import { CustomerPage } from './components/CustomerPage';
import { Skeleton } from './components/Skeleton';
import { CartProvider } from './features/customer/cart/CartProvider';
import { CheckoutPage } from './features/customer/checkout/CheckoutPage';
import { MenuPage } from './features/customer/menu/MenuPage';
import { NotFound } from './NotFound';

// The admin app is its own chunk: customers never download it.
const AdminRoutes = lazy(() => import('./features/admin/AdminRoutes'));

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
        element={
          <CartProvider>
            <Outlet />
          </CartProvider>
        }
      >
        <Route path="/" element={<MenuPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route
          path="*"
          element={
            <CustomerPage>
              <NotFound />
            </CustomerPage>
          }
        />
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<AdminFallback />}>
            <AdminRoutes />
          </Suspense>
        }
      />
    </Routes>
  );
}
