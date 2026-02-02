import { SignIn } from '@clerk/clerk-react';

export function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-logo">Flexer</h1>
        <p className="auth-tagline">Your AI-Powered Workout Companion</p>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
        />
      </div>
    </div>
  );
}
