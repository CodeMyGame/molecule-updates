import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import UpdateNotification from './components/common/UpdateNotification';
import { useLicenseStore } from './stores/license.store';
import { useAuthStore } from './stores/auth.store';
import { isBrowserMode } from './lib/kitchenApi';

// Lazy-loaded pages
const Login = lazy(() => import('./pages/Login'));
const Activate = lazy(() => import('./pages/Activate'));
const Billing = lazy(() => import('./pages/Billing'));
const Tables = lazy(() => import('./pages/Tables'));
const Menu = lazy(() => import('./pages/Menu'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Staff = lazy(() => import('./pages/Staff'));
const Reports = lazy(() => import('./pages/Reports'));
const Customers = lazy(() => import('./pages/Customers'));
const Kitchen = lazy(() => import('./pages/Kitchen'));
const TakeOrder = lazy(() => import('./pages/TakeOrder'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-gray-100">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Loading...</span>
    </div>
  </div>
);

// Browser-mode tablet apps: no electronAPI, no license, no auth.
// The server URL path picks the role: /kitchen → Kitchen, /take-order → TakeOrder.
// The h-screen wrapper matches what ProtectedRoute provides in Electron so the
// kitchen layout has a height context for h-full / overflow scrolling.
const KitchenOnlyApp: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="*" element={<Kitchen />} />
          </Routes>
        </main>
      </div>
    </div>
  </Suspense>
);

const TakeOrderOnlyApp: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="*" element={<TakeOrder />} />
    </Routes>
  </Suspense>
);

function browserRole(): 'kitchen' | 'take-order' {
  if (typeof window === 'undefined') return 'kitchen';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/take-order')) return 'take-order';
  return 'kitchen';
}

const ElectronApp: React.FC = () => {
  const fetchLicense = useLicenseStore((s) => s.fetch);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Fetch license status once on app start (before any route renders)
  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  // Periodic license check (every 12 hours) — force logout if expired
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetchLicense();
      const currentStatus = useLicenseStore.getState().status;
      
      // If license is hard-expired, force logout and redirect to activation
      if (currentStatus?.state === 'expired_hard') {
        logout();
        navigate('/activate', { replace: true });
      }
    }, 12 * 60 * 60 * 1000); // Check every 12 hours

    return () => clearInterval(interval);
  }, [fetchLicense, logout, navigate]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes — no auth or license required */}
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<Activate />} />

        {/* Protected routes — require valid license + staff login */}
        <Route element={<ProtectedRoute />}>
          <Route path="/billing" element={<Billing />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/billing" replace />} />
        <Route path="*" element={<Navigate to="/billing" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  if (isBrowserMode()) {
    return browserRole() === 'take-order' ? <TakeOrderOnlyApp /> : <KitchenOnlyApp />;
  }
  return (
    <>
      <ElectronApp />
      <UpdateNotification />
    </>
  );
};

export default App;
