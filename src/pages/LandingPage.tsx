import { SignInButton, SignUpButton } from '@clerk/clerk-react';

export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="landing-logo">Flexer</h1>
        <p className="landing-tagline">Your AI-Powered Workout Companion</p>

        <div className="landing-features">
          <div className="landing-feature">
            <span className="feature-icon">🏋️</span>
            <span>Personalized workout plans</span>
          </div>
          <div className="landing-feature">
            <span className="feature-icon">🤖</span>
            <span>AI-generated training programs</span>
          </div>
          <div className="landing-feature">
            <span className="feature-icon">📊</span>
            <span>Track your progress</span>
          </div>
        </div>

        <div className="landing-buttons">
          <SignInButton mode="modal">
            <button className="btn btn-primary">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn btn-secondary">Create Account</button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
