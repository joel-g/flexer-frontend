import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { PlanOverviewPage } from './pages/PlanOverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import './App.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Protected route wrapper
function ProtectedRoute() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/plan" element={<PlanOverviewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;
