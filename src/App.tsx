import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider, useProfiles } from '@/contexts/ProfileContext';
import { Layout } from '@/components/Layout';
import { Onboarding } from '@/pages/Onboarding';
import { Inventory } from '@/pages/Inventory';
import { AddGarment } from '@/pages/AddGarment';
import { Outfits } from '@/pages/Outfits';

// AppRoutes is a child of ProfileProvider so it can read profile state.
function AppRoutes() {
  const { hasCompletedOnboarding, isLoading } = useProfiles();

  if (isLoading) {
    // Dexie hasn't resolved yet — render nothing to avoid a flash to onboarding.
    return null;
  }

  if (!hasCompletedOnboarding) {
    // No profiles in DB yet → always send to onboarding.
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Navigate to="/inventory" replace />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/add"       element={<AddGarment />} />
        <Route path="/outfits"   element={<Outfits />} />
        <Route path="*"          element={<Navigate to="/inventory" replace />} />
      </Routes>
    </Layout>
  );
}

// HashRouter keeps routing entirely client-side, so GitHub Pages and other
// static hosts work without any server-side rewrite config.
export function App() {
  return (
    <HashRouter>
      <ProfileProvider>
        <AppRoutes />
      </ProfileProvider>
    </HashRouter>
  );
}
