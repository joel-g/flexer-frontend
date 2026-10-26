import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
export function LandingPage() {
  return (
    <div className="training-landing">
      <a className="training-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link className="training-brand" to="/" aria-label="Flexer home">
          <span className="training-brand-mark">f</span>flexer
          <span className="training-brand-dot">.</span>
        </Link>
        <SignInButton mode="modal">
          <button className="btn btn-secondary">
            Sign in <AppIcon name="arrow" size={18} />
          </button>
        </SignInButton>
      </header>
      <main id="landing-main" className="landing-editorial">
        <div className="landing-intro">
          <p className="training-eyebrow">YOUR PERSONAL TRAINING SPACE</p>
          <h1>
            Make time.
            <br />
            Make progress.
          </h1>
          <p className="landing-description">
            A workout plan that fits your life. A clear next set. A record of
            the work you put in.
          </p>
          <div className="landing-cta">
            <SignUpButton mode="modal">
              <button className="btn btn-primary">
                Build your training plan <AppIcon name="arrow" />
              </button>
            </SignUpButton>
            <span>Bring your goals. Find your rhythm.</span>
          </div>
        </div>
        <section className="landing-method" aria-labelledby="method-title">
          <p className="training-eyebrow">FROM PLAN TO PRACTICE</p>
          <h2 id="method-title">
            Less guesswork.
            <br />
            More showing up.
          </h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Make it yours</h3>
                <p>
                  Turn your goals, equipment and experience into a prompt for
                  your preferred AI assistant.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Bring your plan</h3>
                <p>
                  Import the workout JSON, review your sessions and start when
                  you’re ready.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Train with intention</h3>
                <p>
                  Follow each exercise, log your sets, time your rest and look
                  back at your progress.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>
      <footer className="landing-bottom">
        <span>FLEXER / ONE SET AT A TIME.</span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
