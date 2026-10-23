import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api } from './services/api';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { PlanOverviewPage } from './pages/PlanOverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { HistoryPage } from './pages/HistoryPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import './App.css';
import './production.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Do not mount any data-fetching page until its token getter is installed.
function ApiAuthBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, userId, getToken } = useAuth();
  const [readyUser, setReadyUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    api.setTokenGetter(userId ? getToken : null);
    setReadyUser(userId);
    return () => api.setTokenGetter(null);
  }, [isLoaded, userId, getToken]);
  if (!isLoaded || readyUser !== userId) return <p role="status">Loading your account...</p>;
  return <div key={userId ?? 'signed-out'}>{children}</div>;
}

// Protected route wrapper
function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <Navigate to="/" replace />
      </SignedOut>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing page for unauthenticated users */}
      <Route path="/" element={
        <>
          <SignedIn>
            <Navigate to="/dashboard" replace />
          </SignedIn>
          <SignedOut>
            <LandingPage />
          </SignedOut>
        </>
      } />

      {/* Public routes */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/plan" element={<PlanOverviewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  // Check if Clerk key is configured
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="config-error">
        <h1>Configuration Required</h1>
        <p>Please set VITE_CLERK_PUBLISHABLE_KEY in your .env file</p>
        <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ThemeProvider>
        <BrowserRouter>
          <ApiAuthBoundary><AppRoutes /></ApiAuthBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;
