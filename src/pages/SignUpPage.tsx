import { SignUp } from '@clerk/clerk-react';

export function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-logo">Flexer</h1>
        <p className="auth-tagline">Your AI-Powered Workout Companion</p>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/onboarding"
        />
      </div>
    </div>
  );
}
