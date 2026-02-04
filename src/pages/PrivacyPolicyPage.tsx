import { useNavigate } from 'react-router-dom';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <h1>Privacy Policy</h1>
      </header>

      <div className="privacy-content">
        <p className="last-updated">Last updated: February 2026</p>

        <section className="privacy-section">
          <h2>Our Commitment to Your Privacy</h2>
          <p>
            At Flexer, we take your privacy seriously. We understand that you're trusting us 
            with personal information about your health and fitness, and we're committed to 
            protecting that trust.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Information We Collect</h2>
          <p>To provide you with a personalized workout experience, we collect:</p>
          <ul>
            <li><strong>Account Information:</strong> Email address and name for authentication</li>
            <li><strong>Physical Information:</strong> Age, height, weight, and fitness level to customize your workout plan</li>
            <li><strong>Workout Data:</strong> Your progress, completed workouts, and exercise history</li>
            <li><strong>Preferences:</strong> Your goals, available equipment, and workout preferences</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>How We Use Your Information</h2>
          <p>Your information is used exclusively to:</p>
          <ul>
            <li>Generate personalized workout plans tailored to your goals and fitness level</li>
            <li>Track your progress and adjust recommendations accordingly</li>
            <li>Provide you with a seamless app experience across devices</li>
            <li>Send you important updates about your account (if you opt in)</li>
          </ul>
        </section>

        <section className="privacy-section highlight">
          <h2>We Never Share Your Data</h2>
          <p>
            <strong>Your personal information will never be sold, shared, or disclosed to any 
            third parties.</strong> This includes:
          </p>
          <ul>
            <li>No selling of data to advertisers or marketers</li>
            <li>No sharing with data brokers</li>
            <li>No disclosure to partners or affiliates</li>
            <li>No use of your data for purposes other than improving your Flexer experience</li>
          </ul>
          <p>
            Your health and fitness data is yours alone. We simply provide the platform to help 
            you reach your goals.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your information, including:
          </p>
          <ul>
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Secure authentication through Clerk</li>
            <li>Regular security audits and updates</li>
            <li>Limited access to personal data on a need-to-know basis</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any 
            significant changes through the app or via email. Continued use of Flexer after 
            changes constitutes acceptance of the updated policy.
          </p>
        </section>
        
      </div>
    </div>
  );
}
