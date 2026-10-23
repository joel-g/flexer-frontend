import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/clerk-react";
import { AppIcon } from "./AppIcon";

export function DesktopHeader() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try {
      await signOut();
      navigate("/");
    } catch {
      setError("Sign out failed. Please try again.");
      setSigningOut(false);
    }
  }
  const initials =
    user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "F";
  const links = [
    { to: "/dashboard", name: "Today", icon: "today" },
    { to: "/plan", name: "My plan", icon: "plan" },
    { to: "/history", name: "History", icon: "history" },
    { to: "/onboarding", name: "Build a plan", icon: "build" },
    { to: "/profile", name: "Profile", icon: "profile" },
  ];
  return (
    <aside className="training-rail" aria-label="Training navigation">
      <Link className="training-brand" to="/dashboard" aria-label="Flexer home">
        <span className="training-brand-mark">f</span>flexer
        <span className="training-brand-dot">.</span>
      </Link>
      <p className="rail-caption">YOUR TRAINING SPACE</p>
      <nav className="training-navigation" aria-label="Main navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive ? "training-nav-link active" : "training-nav-link"
            }
          >
            <AppIcon name={link.icon} />
            <span>{link.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="training-account">
        <div className="account-summary">
          <span className="account-monogram">{initials.toUpperCase()}</span>
          <div>
            <strong>{user?.firstName || "Your account"}</strong>
            <Link to="/profile">Profile & preferences</Link>
          </div>
        </div>
        <button
          className="training-signout"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <AppIcon name="exit" size={18} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </aside>
  );
}
