import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useLicenseStore } from '../../stores/license.store';
import { useCountryStore } from '../../stores/country.store';
import Sidebar from './Sidebar';
import Header from './Header';
import LicenseExpiryBanner from '../license/LicenseExpiryBanner';
import TaxRegionSettingsSync from '../tax/TaxRegionSettingsSync';

const HARD_LOCKOUT_STATES = ['unlicensed', 'invalid', 'expired_hard'];

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { status, isLoading, fetch: fetchLicense } = useLicenseStore();
  // Re-render layout when country changes so amounts and icons update everywhere.
  useCountryStore((s) => s.countryId);

  // Re-check license on every protected-layout mount so expiry is caught
  // without requiring an app restart (e.g. app left open past expiry date).
  useEffect(() => {
    fetchLicense();
  }, []);

  // Still fetching license status on first load — show nothing to avoid flash
  if (isLoading || status === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Hard lockout: no license, invalid key, or past grace period
  if (HARD_LOCKOUT_STATES.includes(status.state)) {
    return <Navigate to="/activate" replace />;
  }

  // Not logged in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <TaxRegionSettingsSync />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {/* License expiry warning banner */}
        {(status.state === 'expiring_soon' || status.state === 'expired_grace') && (
          <LicenseExpiryBanner status={status} />
        )}
        <Header />
        <main className="flex-1 overflow-hidden bg-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;
